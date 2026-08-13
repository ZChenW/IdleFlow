use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ValidationError {
    #[error("standard idle inhibitors must remain enabled")]
    InhibitorsRequired,
    #[error("{profile}: {earlier} must happen before {later}")]
    StageOrder {
        profile: &'static str,
        earlier: &'static str,
        later: &'static str,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum LockError {
    #[error("lock was not confirmed: {0}")]
    NotConfirmed(String),
}

#[derive(Debug, Error)]
pub enum SuspendError {
    #[error(transparent)]
    Lock(#[from] LockError),
    #[error("suspend request failed: {0}")]
    Suspend(String),
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("cannot access policy file: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid policy TOML: {0}")]
    Decode(#[from] toml::de::Error),
    #[error("cannot encode policy TOML: {0}")]
    Encode(#[from] toml::ser::Error),
}

#[derive(Debug, Clone)]
pub struct ConfigStore {
    path: PathBuf,
}

impl ConfigStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<Policy, StoreError> {
        Ok(toml::from_str(&fs::read_to_string(&self.path)?)?)
    }

    pub fn load_or_default(&self) -> Result<Policy, StoreError> {
        match self.load() {
            Ok(policy) => Ok(policy),
            Err(StoreError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(Policy::default())
            }
            Err(error) => Err(error),
        }
    }

    pub fn save(&self, policy: &Policy) -> Result<(), StoreError> {
        policy.validate().map_err(|error| {
            StoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidInput, error))
        })?;
        let parent = self.path.parent().unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(parent)?;
        let temporary = self.path.with_extension("toml.tmp");
        let mut file = fs::File::create(&temporary)?;
        file.write_all(toml::to_string_pretty(policy)?.as_bytes())?;
        file.sync_all()?;
        fs::rename(temporary, &self.path)?;
        Ok(())
    }
}

pub trait Locker {
    fn lock_and_confirm(&self) -> Result<(), LockError>;
}

pub trait Suspender {
    fn suspend(&self) -> Result<(), String>;
}

pub fn suspend_after_lock(
    locker: &impl Locker,
    suspender: &impl Suspender,
) -> Result<(), SuspendError> {
    locker.lock_and_confirm()?;
    suspender.suspend().map_err(SuspendError::Suspend)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub lock_after_seconds: u64,
    pub display_off_after_seconds: u64,
    pub suspend_after_seconds: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Policy {
    pub enabled: bool,
    pub respect_inhibitors: bool,
    pub battery: Profile,
    pub ac: Profile,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PowerSource {
    Ac,
    Battery,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeStatus {
    pub enabled: bool,
    pub inhibited: bool,
    pub power_source: PowerSource,
    pub managed_swayidle_pid: Option<u32>,
    pub external_swayidle_detected: bool,
    pub last_error: Option<String>,
}

impl Policy {
    pub fn profile(&self, source: PowerSource) -> &Profile {
        match source {
            PowerSource::Battery => &self.battery,
            PowerSource::Ac | PowerSource::Unknown => &self.ac,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SwayidlePlan {
    pub args: Vec<String>,
}

impl SwayidlePlan {
    pub fn for_profile(profile: &Profile, helper: &str) -> Self {
        let lock_command = format!("{} lock", shell_word(helper));
        let mut args = vec![
            "-w".into(),
            "timeout".into(),
            profile.lock_after_seconds.to_string(),
            lock_command.clone(),
            "timeout".into(),
            profile.display_off_after_seconds.to_string(),
            "niri msg action power-off-monitors".into(),
            "resume".into(),
            "niri msg action power-on-monitors".into(),
        ];
        if let Some(suspend_after) = profile.suspend_after_seconds {
            args.extend([
                "timeout".into(),
                suspend_after.to_string(),
                format!("{} suspend", shell_word(helper)),
            ]);
        }
        Self { args }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SleepGuardPlan {
    pub args: Vec<String>,
}

impl SleepGuardPlan {
    pub fn new(helper: &str) -> Self {
        Self {
            args: vec![
                "-w".into(),
                "before-sleep".into(),
                format!("{} lock", shell_word(helper)),
            ],
        }
    }
}

fn shell_word(value: &str) -> String {
    if value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || b"/_-.".contains(&byte))
    {
        return value.to_owned();
    }
    format!("'{}'", value.replace('\'', "'\\''"))
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            enabled: false,
            respect_inhibitors: true,
            battery: Profile {
                lock_after_seconds: 10 * 60,
                display_off_after_seconds: 15 * 60,
                suspend_after_seconds: Some(30 * 60),
            },
            ac: Profile {
                lock_after_seconds: 15 * 60,
                display_off_after_seconds: 30 * 60,
                suspend_after_seconds: Some(2 * 60 * 60),
            },
        }
    }
}

impl Policy {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if !self.respect_inhibitors {
            return Err(ValidationError::InhibitorsRequired);
        }
        validate_profile("battery", &self.battery)?;
        validate_profile("ac", &self.ac)
    }
}

fn validate_profile(name: &'static str, profile: &Profile) -> Result<(), ValidationError> {
    if profile.lock_after_seconds >= profile.display_off_after_seconds {
        return Err(ValidationError::StageOrder {
            profile: name,
            earlier: "lock",
            later: "display_off",
        });
    }
    if profile
        .suspend_after_seconds
        .is_some_and(|suspend| profile.display_off_after_seconds >= suspend)
    {
        return Err(ValidationError::StageOrder {
            profile: name,
            earlier: "display_off",
            later: "suspend",
        });
    }
    Ok(())
}

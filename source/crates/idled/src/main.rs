use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use idle_control_core::{
    ConfigStore, LockError, Locker, Policy, PowerSource, RuntimeStatus, SleepGuardPlan, Suspender,
    SwayidlePlan, suspend_after_lock,
};

struct Runtime {
    store: ConfigStore,
    policy: Policy,
    inhibited: bool,
    source: PowerSource,
    policy_child: Option<Child>,
    guard_child: Option<Child>,
    last_error: Option<String>,
    marker: PathBuf,
    helper: PathBuf,
}

impl Runtime {
    fn status(&mut self) -> RuntimeStatus {
        let policy_exited = self
            .policy_child
            .as_mut()
            .is_some_and(|child| child.try_wait().ok().flatten().is_some());
        let guard_exited = self
            .guard_child
            .as_mut()
            .is_some_and(|child| child.try_wait().ok().flatten().is_some());
        if policy_exited {
            self.policy_child = None;
            self.last_error = Some("managed swayidle exited unexpectedly".into());
        }
        if guard_exited {
            self.guard_child = None;
            self.last_error = Some("pre-sleep lock guard exited unexpectedly".into());
        }
        let managed_pids = self.managed_pids();
        RuntimeStatus {
            enabled: self.policy.enabled,
            inhibited: self.inhibited,
            power_source: self.source,
            managed_swayidle_pid: self
                .policy_child
                .as_ref()
                .or(self.guard_child.as_ref())
                .map(Child::id),
            external_swayidle_detected: external_swayidle_detected(&managed_pids),
            last_error: self.last_error.clone(),
        }
    }

    fn managed_pids(&self) -> Vec<u32> {
        self.policy_child
            .iter()
            .chain(self.guard_child.iter())
            .map(Child::id)
            .collect()
    }

    fn stop_policy(&mut self) {
        if let Some(mut child) = self.policy_child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    fn stop_all(&mut self) {
        self.stop_policy();
        if let Some(mut child) = self.guard_child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    fn reconcile(&mut self) -> Result<()> {
        self.source = detect_power_source(Path::new("/sys/class/power_supply"));
        if !self.policy.enabled {
            self.stop_all();
            return Ok(());
        }
        if self.guard_child.is_none() {
            if external_swayidle_detected(&self.managed_pids()) {
                bail!(
                    "another swayidle process is active; use explicit takeover or disable its owner"
                );
            }
            let plan = SleepGuardPlan::new(&self.helper.to_string_lossy());
            self.guard_child = Some(spawn_swayidle(plan.args)?);
        }
        if self.inhibited {
            self.stop_policy();
            return Ok(());
        }
        if self.policy_child.is_some() {
            return Ok(());
        }
        if external_swayidle_detected(&self.managed_pids()) {
            bail!("another swayidle process is active; use explicit takeover or disable its owner");
        }
        let plan = SwayidlePlan::for_profile(
            self.policy.profile(self.source),
            &self.helper.to_string_lossy(),
        );
        self.policy_child = Some(spawn_swayidle(plan.args)?);
        Ok(())
    }

    fn persist(&self) -> Result<()> {
        self.store.save(&self.policy).map_err(Into::into)
    }

    fn set_marker(&self, active: bool) -> Result<()> {
        if active {
            if let Some(parent) = self.marker.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&self.marker, b"managed-by-idled\n")?;
        } else if let Err(error) = fs::remove_file(&self.marker)
            && error.kind() != std::io::ErrorKind::NotFound
        {
            return Err(error.into());
        }
        Ok(())
    }

    fn restore_previous_owner(&mut self) -> Result<()> {
        self.policy.enabled = false;
        self.inhibited = false;
        let mut failures = Vec::new();
        if let Err(error) = self.persist() {
            failures.push(error.to_string());
        }
        self.stop_all();
        if let Err(error) = self.set_marker(false) {
            failures.push(error.to_string());
        }
        if let Err(error) = set_quickshell_external_owner(false) {
            failures.push(error.to_string());
        }
        if let Err(error) = restore_saved_desktop_shell() {
            failures.push(error.to_string());
        }
        if failures.is_empty() {
            Ok(())
        } else {
            bail!(
                "previous-owner restoration was incomplete: {}",
                failures.join("; ")
            )
        }
    }
}

impl Drop for Runtime {
    fn drop(&mut self) {
        self.stop_all();
    }
}

#[derive(Clone)]
struct Service {
    runtime: Arc<Mutex<Runtime>>,
}

impl Service {
    fn with_runtime<T>(
        &self,
        action: impl FnOnce(&mut Runtime) -> Result<T>,
    ) -> zbus::fdo::Result<T> {
        let mut runtime = self.runtime.lock().map_err(|_| {
            zbus::fdo::Error::Failed("idle-control runtime lock is poisoned".into())
        })?;
        action(&mut runtime).map_err(|error| zbus::fdo::Error::Failed(error.to_string()))
    }

    fn status_json(runtime: &mut Runtime) -> Result<String> {
        Ok(serde_json::to_string(&runtime.status())?)
    }
}

#[zbus::interface(name = "dev.chakew.IdleControl1")]
impl Service {
    fn status(&self) -> zbus::fdo::Result<String> {
        self.with_runtime(Service::status_json)
    }

    fn policy(&self) -> zbus::fdo::Result<String> {
        self.with_runtime(|runtime| Ok(serde_json::to_string(&runtime.policy)?))
    }

    fn save_policy(&self, json: String) -> zbus::fdo::Result<String> {
        self.with_runtime(|runtime| {
            let policy: Policy = serde_json::from_str(&json)?;
            policy.validate()?;
            if policy.enabled != runtime.policy.enabled {
                bail!("SavePolicy cannot change ownership; use TakeOver or Rollback");
            }
            let restart = runtime.policy != policy;
            runtime.policy = policy;
            runtime.persist()?;
            if restart {
                runtime.stop_policy();
            }
            let reconcile = runtime.reconcile();
            if runtime.policy.enabled && reconcile.is_ok() {
                runtime.set_marker(true)?;
                set_quickshell_external_owner(true)?;
            }
            runtime.last_error = reconcile.err().map(|error| error.to_string());
            Service::status_json(runtime)
        })
    }

    fn set_enabled(&self, enabled: bool) -> zbus::fdo::Result<String> {
        self.with_runtime(|runtime| {
            if enabled {
                bail!("enabling requires explicit TakeOver");
            }
            runtime.restore_previous_owner()?;
            runtime.last_error = None;
            Service::status_json(runtime)
        })
    }

    fn set_inhibited(&self, inhibited: bool) -> zbus::fdo::Result<String> {
        self.with_runtime(|runtime| {
            runtime.inhibited = inhibited;
            runtime.last_error = runtime.reconcile().err().map(|error| error.to_string());
            Service::status_json(runtime)
        })
    }

    fn take_over(&self) -> zbus::fdo::Result<String> {
        self.with_runtime(|runtime| {
            let takeover = (|| -> Result<()> {
                runtime.stop_all();
                stop_external_swayidle()?;
                runtime.set_marker(true)?;
                set_quickshell_external_owner(true)?;
                runtime.policy.enabled = true;
                runtime.persist()?;
                runtime.reconcile()
            })();
            if let Err(error) = takeover {
                let restore = runtime.restore_previous_owner();
                bail!(
                    "takeover failed: {error}; previous-owner restoration: {}",
                    restore
                        .map(|_| "requested".to_owned())
                        .unwrap_or_else(|restore_error| restore_error.to_string())
                );
            }
            runtime.last_error = None;
            Service::status_json(runtime)
        })
    }

    fn rollback(&self) -> zbus::fdo::Result<String> {
        self.with_runtime(|runtime| {
            runtime.restore_previous_owner()?;
            runtime.last_error = None;
            Service::status_json(runtime)
        })
    }

    fn lock(&self) -> zbus::fdo::Result<String> {
        SystemLocker
            .lock_and_confirm()
            .map(|_| "LOCKED".to_owned())
            .map_err(|error| zbus::fdo::Error::Failed(error.to_string()))
    }

    fn suspend(&self) -> zbus::fdo::Result<String> {
        suspend_after_lock(&SystemLocker, &SystemSuspender)
            .map(|_| "SUSPEND_REQUESTED".to_owned())
            .map_err(|error| zbus::fdo::Error::Failed(error.to_string()))
    }
}

struct SystemLocker;

impl Locker for SystemLocker {
    fn lock_and_confirm(&self) -> Result<(), LockError> {
        let quickshell_path = std::env::var_os("IDLE_CONTROL_QUICKSHELL_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| data_home().join("quickshell/clavis"));
        let open = Command::new("qs")
            .args(["ipc", "--path"])
            .arg(&quickshell_path)
            .args(["call", "lock", "open"])
            .output();
        if let Ok(output) = open
            && output.status.success()
        {
            let result = String::from_utf8_lossy(&output.stdout);
            if result.contains("LOCKED") || result.contains("ALREADY_LOCKED") {
                for _ in 0..40 {
                    let confirmed = Command::new("qs")
                        .args(["ipc", "--path"])
                        .arg(&quickshell_path)
                        .args(["call", "lock", "isLocked"])
                        .output();
                    if confirmed.is_ok_and(|confirmation| {
                        confirmation.status.success()
                            && String::from_utf8_lossy(&confirmation.stdout).trim() == "true"
                    }) {
                        return Ok(());
                    }
                    thread::sleep(Duration::from_millis(50));
                }
                return Err(LockError::NotConfirmed(
                    "QuickShell accepted the request but did not confirm the session lock".into(),
                ));
            }
        }

        let status = Command::new("swaylock")
            .arg("-f")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|error| LockError::NotConfirmed(error.to_string()))?;
        if status.success() {
            Ok(())
        } else {
            Err(LockError::NotConfirmed(format!(
                "swaylock did not report readiness: {status}"
            )))
        }
    }
}

struct SystemSuspender;

impl Suspender for SystemSuspender {
    fn suspend(&self) -> Result<(), String> {
        Command::new("systemctl")
            .arg("suspend")
            .status()
            .map_err(|error| error.to_string())?
            .success()
            .then_some(())
            .ok_or_else(|| "systemctl suspend returned a failure status".into())
    }
}

fn config_home() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir().join(".config"))
}

fn state_home() -> PathBuf {
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir().join(".local/state"))
}

fn data_home() -> PathBuf {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir().join(".local/share"))
}

fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/"))
}

fn detect_power_source(root: &Path) -> PowerSource {
    let Ok(entries) = fs::read_dir(root) else {
        return PowerSource::Unknown;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let kind = fs::read_to_string(path.join("type")).unwrap_or_default();
        let online = fs::read_to_string(path.join("online")).unwrap_or_default();
        if kind.trim() == "Mains" && online.trim() == "1" {
            return PowerSource::Ac;
        }
    }
    PowerSource::Battery
}

fn external_swayidle_detected(managed_pids: &[u32]) -> bool {
    let Ok(output) = Command::new("pgrep").args(["-x", "swayidle"]).output() else {
        return false;
    };
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .any(|pid| !managed_pids.contains(&pid))
}

fn spawn_swayidle(args: Vec<String>) -> Result<Child> {
    Command::new("swayidle")
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("cannot start swayidle")
}

fn stop_external_swayidle() -> Result<()> {
    let status = Command::new("pkill")
        .args(["-TERM", "-x", "swayidle"])
        .status()?;
    if !status.success() && status.code() != Some(1) {
        bail!("could not stop the previous swayidle owner");
    }
    thread::sleep(Duration::from_millis(250));
    Ok(())
}

fn set_quickshell_external_owner(active: bool) -> Result<()> {
    let path = data_home().join("quickshell/clavis");
    let running = Command::new("qs")
        .args(["ipc", "--path"])
        .arg(&path)
        .arg("show")
        .output();
    if !running.is_ok_and(|output| output.status.success()) {
        return Ok(());
    }
    let status = Command::new("qs")
        .args(["ipc", "--path"])
        .arg(path)
        .args([
            "call",
            "idle",
            "setExternalOwner",
            if active { "true" } else { "false" },
        ])
        .status()
        .context("could not synchronize QuickShell idle ownership")?;
    if !status.success() {
        bail!("QuickShell rejected the idle ownership transition: {status}");
    }
    Ok(())
}

fn restore_saved_desktop_shell() -> Result<()> {
    let status = Command::new("desktop-shell")
        .arg("start")
        .status()
        .context("could not request restoration of the saved desktop shell")?;
    if !status.success() {
        bail!("desktop-shell rejected the restoration request: {status}");
    }
    Ok(())
}

fn main() -> Result<()> {
    let store = ConfigStore::new(config_home().join("idle-control/config.toml"));
    let policy = store.load_or_default()?;
    let helper = std::env::var_os("IDLE_CONTROL_HELPER")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("idlectl"));
    let runtime = Arc::new(Mutex::new(Runtime {
        store,
        policy,
        inhibited: false,
        source: detect_power_source(Path::new("/sys/class/power_supply")),
        policy_child: None,
        guard_child: None,
        last_error: None,
        marker: state_home().join("idle-control/active"),
        helper,
    }));
    {
        let mut state = runtime.lock().unwrap();
        let reconcile = state.reconcile();
        if state.policy.enabled && reconcile.is_ok() {
            state.set_marker(true)?;
            set_quickshell_external_owner(true)?;
        } else if !state.policy.enabled {
            state.set_marker(false)?;
            set_quickshell_external_owner(false)?;
        }
        state.last_error = reconcile.err().map(|error| error.to_string());
    }

    let service = Service {
        runtime: runtime.clone(),
    };
    let _connection = zbus::blocking::connection::Builder::session()?
        .name(idle_control_dbus::SERVICE)?
        .serve_at(idle_control_dbus::PATH, service)?
        .build()?;

    let running = Arc::new(AtomicBool::new(true));
    let signal = running.clone();
    ctrlc::set_handler(move || signal.store(false, Ordering::SeqCst))?;
    while running.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_secs(3));
        let mut state = runtime.lock().unwrap();
        let previous = state.source;
        state.source = detect_power_source(Path::new("/sys/class/power_supply"));
        if state.source != previous {
            state.stop_policy();
        }
        state.last_error = state.reconcile().err().map(|error| error.to_string());
    }
    runtime.lock().unwrap().stop_all();
    Ok(())
}

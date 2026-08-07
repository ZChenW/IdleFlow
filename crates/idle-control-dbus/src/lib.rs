use anyhow::{Context, Result};
use idle_control_core::{Policy, RuntimeStatus};

pub const SERVICE: &str = "dev.chakew.IdleControl1";
pub const PATH: &str = "/dev/chakew/IdleControl1";
pub const INTERFACE: &str = "dev.chakew.IdleControl1";

pub struct Client {
    connection: zbus::blocking::Connection,
}

impl Client {
    pub fn session() -> Result<Self> {
        Ok(Self {
            connection: zbus::blocking::Connection::session()
                .context("cannot connect to the user D-Bus")?,
        })
    }

    fn proxy(&self) -> Result<zbus::blocking::Proxy<'_>> {
        zbus::blocking::Proxy::new(&self.connection, SERVICE, PATH, INTERFACE)
            .context("idled is not available on the user D-Bus")
    }

    pub fn status(&self) -> Result<RuntimeStatus> {
        let json: String = self.proxy()?.call("Status", &())?;
        serde_json::from_str(&json).context("idled returned invalid status JSON")
    }

    pub fn policy(&self) -> Result<Policy> {
        let json: String = self.proxy()?.call("Policy", &())?;
        serde_json::from_str(&json).context("idled returned invalid policy JSON")
    }

    pub fn save_policy(&self, policy: &Policy) -> Result<RuntimeStatus> {
        let json = serde_json::to_string(policy)?;
        let status: String = self.proxy()?.call("SavePolicy", &(json,))?;
        serde_json::from_str(&status).context("idled returned invalid status JSON")
    }

    pub fn set_enabled(&self, enabled: bool) -> Result<RuntimeStatus> {
        let status: String = self.proxy()?.call("SetEnabled", &(enabled,))?;
        serde_json::from_str(&status).context("idled returned invalid status JSON")
    }

    pub fn set_inhibited(&self, inhibited: bool) -> Result<RuntimeStatus> {
        let status: String = self.proxy()?.call("SetInhibited", &(inhibited,))?;
        serde_json::from_str(&status).context("idled returned invalid status JSON")
    }

    pub fn take_over(&self) -> Result<RuntimeStatus> {
        let status: String = self.proxy()?.call("TakeOver", &())?;
        serde_json::from_str(&status).context("idled returned invalid status JSON")
    }

    pub fn rollback(&self) -> Result<RuntimeStatus> {
        let status: String = self.proxy()?.call("Rollback", &())?;
        serde_json::from_str(&status).context("idled returned invalid status JSON")
    }

    pub fn lock(&self) -> Result<String> {
        self.proxy()?.call("Lock", &()).map_err(Into::into)
    }

    pub fn suspend(&self) -> Result<String> {
        self.proxy()?.call("Suspend", &()).map_err(Into::into)
    }
}

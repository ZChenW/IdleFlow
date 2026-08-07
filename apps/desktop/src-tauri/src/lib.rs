use idle_control_core::{Policy, RuntimeStatus};
use idle_control_dbus::Client;
use serde::Serialize;

#[derive(Serialize)]
struct Snapshot {
    policy: Policy,
    status: RuntimeStatus,
}

fn snapshot_with(client: &Client, status: Option<RuntimeStatus>) -> Result<Snapshot, String> {
    Ok(Snapshot {
        policy: client.policy().map_err(|error| error.to_string())?,
        status: match status {
            Some(status) => status,
            None => client.status().map_err(|error| error.to_string())?,
        },
    })
}

#[tauri::command]
fn get_snapshot() -> Result<Snapshot, String> {
    let client = Client::session().map_err(|error| error.to_string())?;
    snapshot_with(&client, None)
}

#[tauri::command]
fn save_policy(policy: Policy) -> Result<Snapshot, String> {
    let client = Client::session().map_err(|error| error.to_string())?;
    let status = client
        .save_policy(&policy)
        .map_err(|error| error.to_string())?;
    snapshot_with(&client, Some(status))
}

#[tauri::command]
fn set_enabled(enabled: bool) -> Result<Snapshot, String> {
    let client = Client::session().map_err(|error| error.to_string())?;
    let status = client
        .set_enabled(enabled)
        .map_err(|error| error.to_string())?;
    snapshot_with(&client, Some(status))
}

#[tauri::command]
fn set_inhibited(inhibited: bool) -> Result<Snapshot, String> {
    let client = Client::session().map_err(|error| error.to_string())?;
    let status = client
        .set_inhibited(inhibited)
        .map_err(|error| error.to_string())?;
    snapshot_with(&client, Some(status))
}

#[tauri::command]
fn take_over() -> Result<Snapshot, String> {
    let client = Client::session().map_err(|error| error.to_string())?;
    let status = client.take_over().map_err(|error| error.to_string())?;
    snapshot_with(&client, Some(status))
}

#[tauri::command]
fn rollback() -> Result<Snapshot, String> {
    let client = Client::session().map_err(|error| error.to_string())?;
    let status = client.rollback().map_err(|error| error.to_string())?;
    snapshot_with(&client, Some(status))
}

#[tauri::command]
fn lock_now() -> Result<String, String> {
    Client::session()
        .and_then(|client| client.lock())
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            save_policy,
            set_enabled,
            set_inhibited,
            take_over,
            rollback,
            lock_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running IdleFlow");
}

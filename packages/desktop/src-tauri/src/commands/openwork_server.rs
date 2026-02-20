use tauri::State;

use crate::openwork_server::manager::OpenworkServerManager;
use crate::types::OpenworkServerInfo;

#[tauri::command]
pub fn openwork_server_info(
    manager: State<OpenworkServerManager>,
) -> Result<OpenworkServerInfo, String> {
    let mut state = manager
        .inner
        .lock()
        .map_err(|_| "openwork server state unavailable".to_string())?;
    Ok(OpenworkServerManager::snapshot_locked(&mut state))
}

// start/stop are handled by engine lifecycle

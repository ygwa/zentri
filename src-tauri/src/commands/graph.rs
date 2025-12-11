//! Graph 相关命令

use crate::storage;
use crate::graph;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_graph_data(state: State<AppState>) -> Result<graph::GraphData, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    let cards = storage::read_all_cards(&vault_path);
    Ok(graph::compute_layout(cards))
}

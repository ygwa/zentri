use crate::error::AppError;
use crate::models::canvas::{Canvas, CanvasListItem};
use crate::state::AppState;
use crate::storage;
use tauri::State;

#[tauri::command]
pub fn get_canvases(state: State<AppState>) -> Result<Vec<CanvasListItem>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| AppError::VaultPathNotSet.to_string())?;
    Ok(storage::read_all_canvases(&vault_path))
}

#[tauri::command]
pub fn get_canvas(state: State<AppState>, id: String) -> Result<Option<Canvas>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| AppError::VaultPathNotSet.to_string())?;
    Ok(storage::read_canvas(&vault_path, &id))
}

#[tauri::command]
pub fn create_canvas(state: State<AppState>, title: String) -> Result<Canvas, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| AppError::VaultPathNotSet.to_string())?;
    
    if title.trim().is_empty() {
        return Err(AppError::InvalidInput("标题不能为空".to_string()).to_string());
    }
    
    storage::create_canvas(&vault_path, &title)
        .map_err(|e| AppError::Storage(e).to_string())
}

#[tauri::command]
pub fn update_canvas(
    state: State<AppState>,
    id: String,
    title: Option<String>,
    nodes: Option<serde_json::Value>,
    edges: Option<serde_json::Value>,
) -> Result<Canvas, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| AppError::VaultPathNotSet.to_string())?;
    
    storage::update_canvas(&vault_path, &id, title, nodes, edges)
        .map_err(|e| AppError::Storage(e).to_string())
}

#[tauri::command]
pub fn delete_canvas(state: State<AppState>, id: String) -> Result<(), String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| AppError::VaultPathNotSet.to_string())?;
    
    storage::delete_canvas(&vault_path, &id)
        .map_err(|e| AppError::Storage(e).to_string())
}

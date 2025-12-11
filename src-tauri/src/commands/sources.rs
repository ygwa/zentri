//! Source 相关命令

use crate::models::{CreateSourceRequest, Source, UpdateSourceRequest};
use crate::state::AppState;
use tauri::State;

/// 获取所有文献源
#[tauri::command]
pub fn get_sources(state: State<AppState>) -> Result<Vec<Source>, String> {
    state.db.get_all_sources().map_err(|e| e.to_string())
}

/// 获取单个文献源
#[tauri::command]
pub fn get_source(state: State<AppState>, id: String) -> Result<Option<Source>, String> {
    state.db.get_source(&id).map_err(|e| e.to_string())
}

/// 创建文献源
#[tauri::command]
pub fn create_source(state: State<AppState>, req: CreateSourceRequest) -> Result<Source, String> {
    state.db.create_source(req).map_err(|e| e.to_string())
}

/// 更新文献源
#[tauri::command]
pub fn update_source(
    state: State<AppState>,
    id: String,
    req: UpdateSourceRequest,
) -> Result<Option<Source>, String> {
    state.db.update_source(&id, req).map_err(|e| e.to_string())
}

/// 删除文献源
#[tauri::command]
pub fn delete_source(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_source(&id).map_err(|e| e.to_string())
}


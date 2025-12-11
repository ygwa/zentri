//! Highlight 相关命令

use crate::models::{CreateHighlightRequest, Highlight};
use crate::state::AppState;
use tauri::State;

/// 获取文献源的高亮
#[tauri::command]
pub fn get_highlights_by_source(state: State<AppState>, source_id: String) -> Result<Vec<Highlight>, String> {
    state
        .db
        .get_highlights_by_source(&source_id)
        .map_err(|e| e.to_string())
}

/// 获取所有高亮
#[tauri::command]
pub fn get_all_highlights(state: State<AppState>) -> Result<Vec<Highlight>, String> {
    state.db.get_all_highlights().map_err(|e| e.to_string())
}

/// 创建高亮
#[tauri::command]
pub fn create_highlight(state: State<AppState>, req: CreateHighlightRequest) -> Result<Highlight, String> {
    state.db.create_highlight(req).map_err(|e| e.to_string())
}

/// 删除高亮
#[tauri::command]
pub fn delete_highlight(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_highlight(&id).map_err(|e| e.to_string())
}


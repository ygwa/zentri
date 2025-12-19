//! Highlight 相关命令

use crate::models::{CreateHighlightRequest, Highlight, UpdateHighlightRequest};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
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

/// 更新高亮
#[tauri::command]
pub fn update_highlight(
    state: State<AppState>,
    id: String,
    req: UpdateHighlightRequest,
) -> Result<Option<Highlight>, String> {
    state
        .db
        .update_highlight(&id, req)
        .map_err(|e| e.to_string())
}

/// 删除高亮
#[tauri::command]
pub fn delete_highlight(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_highlight(&id).map_err(|e| e.to_string())
}

/// 获取卡片关联的高亮
#[tauri::command]
pub fn get_highlights_by_card(state: State<AppState>, card_id: String) -> Result<Vec<Highlight>, String> {
    state
        .db
        .get_highlights_by_card(&card_id)
        .map_err(|e| e.to_string())
}

/// 反向链接信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceBacklink {
    pub card_id: String,
    pub card_title: String,
    pub highlight_id: String,
    pub highlight_content: String,
    pub page: Option<i32>,
    pub cfi: Option<String>,
}

/// 获取引用该文献源的所有笔记（反向链接）
#[tauri::command]
pub fn get_backlinks_for_source(
    state: State<AppState>,
    source_id: String,
) -> Result<Vec<SourceBacklink>, String> {
    state
        .db
        .get_backlinks_for_source(&source_id)
        .map_err(|e| e.to_string())
}


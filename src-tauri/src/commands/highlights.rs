//! Highlight 相关命令

use crate::models::{CreateHighlightRequest, Highlight, UpdateHighlightRequest};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

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

/// 获取文献源的高亮
#[tauri::command]
pub async fn get_highlights_by_source(state: State<'_, AppState>, source_id: String) -> Result<Vec<Highlight>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .highlight
        .get_by_source(&source_id)
        .await
        .map_err(|e| e.to_string())
}

/// 获取所有高亮
#[tauri::command]
pub async fn get_all_highlights(state: State<'_, AppState>) -> Result<Vec<Highlight>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.highlight.get_all().await.map_err(|e| e.to_string())
}

/// 创建高亮
#[tauri::command]
pub async fn create_highlight(state: State<'_, AppState>, req: CreateHighlightRequest) -> Result<Highlight, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.highlight.create(req).await.map_err(|e| e.to_string())
}

/// 更新高亮
#[tauri::command]
pub async fn update_highlight(
    state: State<'_, AppState>,
    id: String,
    req: UpdateHighlightRequest,
) -> Result<Option<Highlight>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .highlight
        .update(&id, req)
        .await
        .map_err(|e| e.to_string())
}

/// 删除高亮
#[tauri::command]
pub async fn delete_highlight(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.highlight.delete(&id).await.map_err(|e| e.to_string())
}

/// 获取卡片关联的高亮
#[tauri::command]
pub async fn get_highlights_by_card(state: State<'_, AppState>, card_id: String) -> Result<Vec<Highlight>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .highlight
        .get_by_card(&card_id)
        .await
        .map_err(|e| e.to_string())
}

/// 获取引用该文献源的所有笔记（反向链接）
#[tauri::command]
pub async fn get_backlinks_for_source(
    state: State<'_, AppState>,
    source_id: String,
) -> Result<Vec<SourceBacklink>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .highlight
        .get_backlinks(&source_id)
        .await
        .map_err(|e| e.to_string())
}


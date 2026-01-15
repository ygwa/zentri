//! Source 相关命令

use crate::models::{CreateSourceRequest, Source, UpdateSourceRequest};
use crate::state::AppState;
use tauri::State;

/// 获取所有文献源
#[tauri::command]
pub async fn get_sources(state: State<'_, AppState>) -> Result<Vec<Source>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.source.get_all().await.map_err(|e| e.to_string())
}

/// 获取单个文献源
#[tauri::command]
pub async fn get_source(state: State<'_, AppState>, id: String) -> Result<Option<Source>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.source.get_by_id(&id).await.map_err(|e| e.to_string())
}

/// 创建文献源
#[tauri::command]
pub async fn create_source(state: State<'_, AppState>, req: CreateSourceRequest) -> Result<Source, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.source.create(req).await.map_err(|e| e.to_string())
}

/// 更新文献源
#[tauri::command]
pub async fn update_source(
    state: State<'_, AppState>,
    id: String,
    req: UpdateSourceRequest,
) -> Result<Option<Source>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.source.update(&id, req).await.map_err(|e| e.to_string())
}

/// 删除文献源
#[tauri::command]
pub async fn delete_source(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.source.delete(&id).await.map_err(|e| e.to_string())
}


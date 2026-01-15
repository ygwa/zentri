//! Bookmark 相关命令

use crate::models::{Bookmark, CreateBookmarkRequest, UpdateBookmarkRequest};
use crate::state::AppState;
use tauri::State;

/// 获取文献源的所有书签
#[tauri::command]
pub async fn get_bookmarks_by_source(state: State<'_, AppState>, source_id: String) -> Result<Vec<Bookmark>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .bookmark
        .get_by_source(&source_id)
        .await
        .map_err(|e| e.to_string())
}

/// 获取所有书签
#[tauri::command]
pub async fn get_all_bookmarks(state: State<'_, AppState>) -> Result<Vec<Bookmark>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.bookmark.get_all().await.map_err(|e| e.to_string())
}

/// 创建书签
#[tauri::command]
pub async fn create_bookmark(state: State<'_, AppState>, req: CreateBookmarkRequest) -> Result<Bookmark, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.bookmark.create(req).await.map_err(|e| e.to_string())
}

/// 更新书签
#[tauri::command]
pub async fn update_bookmark(
    state: State<'_, AppState>,
    id: String,
    req: UpdateBookmarkRequest,
) -> Result<Option<Bookmark>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .bookmark
        .update(&id, req)
        .await
        .map_err(|e| e.to_string())
}

/// 删除书签
#[tauri::command]
pub async fn delete_bookmark(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.bookmark.delete(&id).await.map_err(|e| e.to_string())
}

/// 获取单个书签
#[tauri::command]
pub async fn get_bookmark(state: State<'_, AppState>, id: String) -> Result<Option<Bookmark>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.bookmark.get_by_id(&id).await.map_err(|e| e.to_string())
}





//! 网页阅读器相关命令

use crate::state::AppState;
use crate::web_reader::{FetchResult, WebSnapshot, WebpageMetadata};
use tauri::State;

/// 抓取并清洗网页（完整内容）
#[tauri::command]
pub fn fetch_webpage(state: State<AppState>, url: String) -> Result<FetchResult, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.web_reader.fetch_webpage(&url)
}

/// 快速获取网页元数据（用于表单自动填充）
#[tauri::command]
pub fn fetch_webpage_metadata(state: State<AppState>, url: String) -> Result<WebpageMetadata, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.web_reader.fetch_metadata(&url)
}

/// 保存网页快照
#[tauri::command]
pub async fn save_web_snapshot(
    state: State<'_, AppState>,
    source_id: String,
    url: String,
    fetch_result: FetchResult,
) -> Result<WebSnapshot, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .web_reader
        .save_snapshot(&source_id, &url, fetch_result)
        .await
}

/// 获取网页快照
#[tauri::command]
pub async fn get_web_snapshot(state: State<'_, AppState>, source_id: String) -> Result<Option<WebSnapshot>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .web_reader
        .get_snapshot(&source_id)
        .await
}

/// 将网页内容转换为 Markdown
#[tauri::command]
pub fn convert_to_markdown(state: State<AppState>, html: String) -> Result<String, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    Ok(services.web_reader.convert_to_markdown(&html))
}


//! 网页阅读器相关命令

use crate::state::AppState;
use crate::web_reader::{self, FetchResult, WebSnapshot, WebpageMetadata};
use tauri::State;
use uuid::Uuid;

/// 抓取并清洗网页（完整内容）
#[tauri::command]
pub fn fetch_webpage(url: String) -> Result<FetchResult, String> {
    web_reader::fetch_and_clean(&url).map_err(|e| e.to_string())
}

/// 快速获取网页元数据（用于表单自动填充）
#[tauri::command]
pub fn fetch_webpage_metadata(url: String) -> Result<WebpageMetadata, String> {
    web_reader::fetch_webpage_metadata(&url).map_err(|e| e.to_string())
}

/// 保存网页快照
#[tauri::command]
pub fn save_web_snapshot(
    state: State<AppState>,
    source_id: String,
    url: String,
    fetch_result: FetchResult,
) -> Result<WebSnapshot, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let snapshot = WebSnapshot {
        id: Uuid::new_v4().to_string(),
        source_id,
        original_url: url,
        title: fetch_result.title,
        author: fetch_result.author,
        site_name: fetch_result.site_name,
        content: fetch_result.content,
        text_content: fetch_result.text_content,
        excerpt: fetch_result.excerpt,
        created_at: now,
    };

    // 保存到数据库
    state
        .db
        .save_web_snapshot(&snapshot)
        .map_err(|e| e.to_string())?;

    Ok(snapshot)
}

/// 获取网页快照
#[tauri::command]
pub fn get_web_snapshot(state: State<AppState>, source_id: String) -> Result<Option<WebSnapshot>, String> {
    state
        .db
        .get_web_snapshot(&source_id)
        .map_err(|e| e.to_string())
}

/// 将网页内容转换为 Markdown
#[tauri::command]
pub fn convert_to_markdown(html: String) -> Result<String, String> {
    Ok(web_reader::html_to_markdown(&html))
}


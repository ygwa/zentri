//! 书籍处理相关命令
//! 前端只发送路径，Rust 负责所有处理

use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

/// 导入书籍
/// 前端只发送文件路径，Rust 负责：
/// - 解压 EPUB（ZIP）
/// - 提取元数据（content.opf）
/// - 提取封面并生成缩略图
/// - 建立搜索索引
/// - 存入数据库
#[tauri::command]
pub async fn import_book(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<crate::models::Source, String> {
    let path = PathBuf::from(&file_path);
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.book.import_book(&path, &state)
}

/// 获取章节内容
/// 从 EPUB ZIP 包中流式提取并清理 HTML
#[tauri::command]
pub async fn get_chapter_content(
    state: State<'_, AppState>,
    source_id: String,
    chapter_href: String,
) -> Result<String, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    let services = state.get_services().ok_or("Vault not initialized")?;
    services
        .book
        .get_chapter_content(&source_id, &chapter_href, &vault_path)
        .await
}


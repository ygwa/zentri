//! Zentri - 知识管理应用后端
//!
//! 模块结构:
//! - commands: Tauri 命令处理
//! - models: 数据模型
//! - state: 应用状态管理
//! - db: 数据库操作
//! - storage: 存储模块 (JSON 格式)
//! - search: 全文搜索
//! - graph: 知识图谱
//! - watcher: 文件监听

mod commands;
mod db;
mod graph;
mod models;
mod search;
mod state;
mod storage;
mod watcher;

use db::Database;
use state::AppState;
use std::path::PathBuf;
use watcher::VaultWatcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 获取应用数据目录
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zentri");

    // 初始化数据库
    let db_path = app_data_dir.join("zentri.db");
    let db = Database::open(&db_path).expect("Failed to open database");

    // 尝试从配置加载 vault_path
    let vault_path = db
        .get_config("vault_path")
        .ok()
        .flatten()
        .map(PathBuf::from);

    // 初始化索引器
    let indexer = if let Some(path) = &vault_path {
        let index_path = path.join(".zentri/index");
        search::Indexer::new(&index_path).ok()
    } else {
        None
    };

    // 初始化文件监听器
    let watcher = if let Some(path) = &vault_path {
        VaultWatcher::new(path).ok()
    } else {
        None
    };

    let state = AppState::new(db, vault_path, indexer, watcher);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Vault
            commands::set_vault_path,
            commands::get_vault_path,
            // Cards
            commands::get_cards,
            commands::get_card,
            commands::get_card_by_path,
            commands::create_card,
            commands::update_card,
            commands::delete_card,
            // Daily Notes
            commands::get_or_create_daily_note,
            commands::get_daily_note,
            commands::get_daily_notes,
            // Search & Watch
            commands::search_cards,
            commands::sync_index,
            commands::poll_file_changes,
            // Graph
            commands::get_graph_data,
            // Sources
            commands::get_sources,
            commands::get_source,
            commands::create_source,
            commands::update_source,
            commands::delete_source,
            // Highlights
            commands::get_highlights_by_source,
            commands::get_all_highlights,
            commands::create_highlight,
            commands::delete_highlight,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

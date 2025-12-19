//! Zentri - 知识管理应用后端
//!
//! 模块结构:
//! - commands: Tauri 命令处理
//! - models: 数据模型
//! - state: 应用状态管理
//! - db: 数据库操作
//! - storage: 存储模块 (JSON 格式)
//! - search: 全文搜索 (tantivy + jieba)
//! - graph: 知识图谱 (petgraph + PageRank)
//! - crdt: 协作编辑 (yrs/Y.js)
//! - watcher: 文件监听
//! - web_reader: 网页阅读器 (readability)

mod commands;
mod crdt;
mod db;
mod error;
mod graph;
mod menu;
mod models;
mod search;
mod state;
mod storage;
mod watcher;
mod web_reader;

use db::Database;
use state::AppState;
use std::path::PathBuf;
use tauri::Manager;
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
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .menu(menu::get_menu)
        .manage(state)
        .on_menu_event(move |app, event| {
            if event.id() == "open_vault" {
                // Open Vault Logic
                use tauri_plugin_dialog::DialogExt;
                let handle = app.clone();

                // Dialog must be run on main thread or safely?
                // tauri-plugin-dialog methods are usually async or callback based in JS,
                // but in Rust `file_dialog()` builder is available.
                // However, tauri-plugin-dialog 2.0 Rust API:
                handle.dialog().file().pick_folder(move |folder_path| {
                    if let Some(path) = folder_path {
                        // Need to update DB config
                        // Accessing DB from here is tricky because we need the State.
                        // But State<AppState> is available via handle.state().

                        let state_handle = handle.state::<AppState>();
                        // We need to implement update_vault_config in a way that doesn't conflict with other locks if possible.
                        // Or just reuse the logic from `commands::set_vault_path` but we are not in a command.
                        // We can assume we can get the DB from state and call a method.

                        // Note: `folder_path` from dialog is `FilePath`, we need `PathBuf` or similar.
                        // It seems `pick_folder` returns `Option<FilePath>`.
                        // Let's assume `into_path()` or similar exists or it matches `PathBuf`.
                        // Actually `tauri_plugin_dialog::FilePath` might be `PathBuf` wrapper.
                        // Let's check docs or assume standard behavior.
                        // Wait, `tauri-plugin-dialog` v2 Rust API:
                        // `app.dialog().file().pick_folder(...)`

                        // To be safe and simple, let's emit an event to frontend to handle the "reload" after we update,
                        // OR just do it all here.

                        let path_str = path.to_string(); // FilePath usually implements Display or has methods.
                        let path_buf = path
                            .into_path()
                            .ok()
                            .unwrap_or(std::path::PathBuf::from(path_str));

                        if let Err(e) = state_handle
                            .db
                            .set_config("vault_path", &path_buf.to_string_lossy())
                        {
                            eprintln!("Failed to update vault path: {}", e);
                            return;
                        }

                        // Reload window
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.eval("window.location.reload()");
                        }
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Vault
            commands::set_initial_vault_path,
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
            // Search (P1 增强)
            commands::search_cards,
            commands::search_cards_filtered,
            commands::fuzzy_search_cards,
            commands::search_by_tag,
            commands::search_by_type,
            commands::sync_index,
            commands::poll_file_changes,
            // Graph (P2 增强)
            commands::get_graph_data,
            commands::get_backlinks,
            commands::get_card_importance,
            commands::get_knowledge_clusters,
            commands::get_orphan_nodes,
            commands::rebuild_graph,
            // CRDT (P0 新增)
            commands::crdt_get_state,
            commands::crdt_get_state_vector,
            commands::crdt_apply_update,
            commands::crdt_get_diff,
            commands::crdt_sync,
            commands::crdt_save,
            commands::crdt_flush_all,
            commands::crdt_create_snapshot,
            commands::crdt_list_snapshots,
            commands::crdt_restore_snapshot,
            commands::crdt_unload,
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
            commands::update_highlight,
            commands::get_highlights_by_card,
            commands::get_backlinks_for_source,
            // Web Reader
            commands::fetch_webpage,
            commands::fetch_webpage_metadata,
            commands::save_web_snapshot,
            commands::get_web_snapshot,
            commands::convert_to_markdown,
            // Canvas
            commands::get_canvases,
            commands::get_canvas,
            commands::create_canvas,
            commands::update_canvas,
            commands::delete_canvas,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

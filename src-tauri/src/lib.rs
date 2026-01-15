//! Zentri - 知识管理应用后端
//!
//! 模块结构:
//! - commands: Tauri 命令处理
//! - models: 数据模型
//! - state: 应用状态管理
//! - db: 数据库操作
//! - storage: 存储模块 (Canvas 等非数据库数据，JSON 格式)
//! - search: 全文搜索 (tantivy + jieba)
//! - graph: 知识图谱 (petgraph + PageRank)
//! - crdt: 协作编辑 (yrs/Y.js)
//! - watcher: 文件监听
//! - web_reader: 网页阅读器 (readability)

mod ai;
mod book_processor;
mod commands;
mod config;
mod crdt;
mod database;
mod db;
mod error;
mod graph;
mod menu;
mod models;
mod search;
mod services;
mod state;
mod storage;
mod vault;
mod watcher;
mod web_reader;

use db::Database;
use config::ConfigManager;
use state::AppState;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use watcher::VaultWatcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 创建 Tokio runtime 用于异步操作
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    // 应用数据目录（用于存储应用配置）
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zentri");
    
    // 从配置文件读取 vault_path
    let config_manager = ConfigManager::new(&app_data_dir);
    let vault_path = config_manager
        .get_vault_path()
        .expect("Failed to load app config");
    
    // 根据是否有 vault_path 创建不同的状态
    let state = if let Some(vp) = vault_path {
        // 有 vault_path，初始化完整的应用状态
        // 确保 vault 结构存在
        if let Err(e) = storage::ensure_vault_structure(&vp) {
            eprintln!("Warning: Failed to initialize vault structure: {}", e);
            return;
        }
        
        let db_path = vault::get_database_path(&vp);
        let db = match rt.block_on(Database::open(&db_path)) {
            Ok(db) => std::sync::Arc::new(db),
            Err(e) => {
                eprintln!("Error: Failed to open vault database: {}", e);
                return;
            }
        };

        // 初始化索引器
        let index_path = vp.join(".zentri/index");
        let indexer = search::Indexer::new(&index_path).ok();

        // 初始化文件监听器
        let watcher = VaultWatcher::new(&vp).ok();

        AppState::new_with_vault(db, vp, indexer, watcher)
    } else {
        // 没有 vault_path，创建空状态（等待用户选择 vault）
        AppState::new_empty()
    };

    // 注意：如果需要创建快速采集窗口（如 Inbox），可以在创建窗口时设置：
    // 在 macOS 上：app.set_activation_policy(tauri::ActivationPolicy::Accessory)
    // 这样窗口不会出现在 Dock 栏，只在系统托盘显示
    // 示例：
    // let inbox_window = tauri::WindowBuilder::new(
    //     &app,
    //     "inbox",
    //     tauri::WindowUrl::App("inbox.html".into())
    // )
    // .decorations(false)
    // .transparent(true)
    // .build()?;
    // #[cfg(target_os = "macos")]
    // app.set_activation_policy(tauri::ActivationPolicy::Accessory);

    tauri::Builder::default()
        .setup(|_| {
            // 在 macOS 上，使用系统原生窗口控制按钮
            // 窗口装饰在 tauri.conf.json 中设置为 true，这样 macOS 会显示系统原生按钮
            // 在 Windows/Linux 上也会显示系统标题栏，但我们的自定义标题栏会覆盖它
            
            // 注意：文件拖拽已在 React 层面处理（通过 onDrop 事件）
            // 如果需要原生文件拖拽（从系统文件管理器拖入），可以在后续版本中实现
            // Tauri 2.0 的文件拖拽 API 可能需要特定的配置或插件
            
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .menu(menu::get_menu)
        .manage(state)
        .on_menu_event(move |app, event| {
            let event_id = event.id().as_ref();
            let window = app.get_webview_window("main");
            
            if let Some(win) = window {
                match event_id {
                    // File Menu
                    "new_permanent" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "permanent", "title": "Untitled Note"}}));
                    }
                    "new_fleeting" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "fleeting", "title": "Quick Note"}}));
                    }
                    "new_literature" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "literature", "title": "Literature Note"}}));
                    }
                    "new_project" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "project", "title": "New Project"}}));
                    }
                    "new_canvas" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCanvas"}));
                    }
                    "new_source" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createSource"}));
                    }
                    "import_book" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "importBook"}));
                    }
                    "open_vault" => {
                        use tauri_plugin_dialog::DialogExt;
                        let handle = app.clone();
                        handle.dialog().file().pick_folder(move |folder_path| {
                            if let Some(path) = folder_path {
                                let _state_handle = handle.state::<AppState>();
                                let path_str = path.to_string();
                                let path_buf = path
                                    .into_path()
                                    .ok()
                                    .unwrap_or(std::path::PathBuf::from(path_str));

                                // 使用 ConfigManager 设置配置
                                let app_data_dir = dirs::data_dir()
                                    .unwrap_or_else(|| PathBuf::from("."))
                                    .join("zentri");
                                let config_manager = ConfigManager::new(&app_data_dir);
                                if let Err(e) = config_manager.set_vault_path(Some(&path_buf)) {
                                    eprintln!("Failed to save vault path: {}", e);
                                }

                                if let Some(window) = handle.get_webview_window("main") {
                                    let _ = window.emit("menu-action", serde_json::json!({"action": "reloadWindow"}));
                                }
                            }
                        });
                    }
                    
                    // Edit Menu
                    "find" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "find"}));
                    }
                    "find_replace" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "findReplace"}));
                    }
                    
                    // View Menu
                    "view_dashboard" | "go_dashboard" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/dashboard"}}));
                    }
                    "view_library" | "go_library" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/library"}}));
                    }
                    "view_graph" | "go_graph" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/graph"}}));
                    }
                    "view_review" | "go_review" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/review"}}));
                    }
                    "view_tags" | "go_tags" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/tags"}}));
                    }
                    "view_settings" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/settings"}}));
                    }
                    "go_boards" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "navigate", "payload": {"path": "/boards"}}));
                    }
                    "toggle_sidebar" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "toggleSidebar"}));
                    }
                    "toggle_theme" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "toggleTheme"}));
                    }
                    "go_back" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "goBack"}));
                    }
                    "go_forward" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "goForward"}));
                    }
                    
                    // Card Menu
                    "card_new_permanent" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "permanent", "title": "Untitled Note"}}));
                    }
                    "card_new_fleeting" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "fleeting", "title": "Quick Note"}}));
                    }
                    "card_new_literature" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "literature", "title": "Literature Note"}}));
                    }
                    "card_new_project" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "createCard", "payload": {"type": "project", "title": "New Project"}}));
                    }
                    "card_delete" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "deleteCard"}));
                    }
                    "card_duplicate" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "duplicateCard"}));
                    }
                    "card_rename" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "renameCard"}));
                    }
                    
                    // Window Menu
                    "window_close_all" => {
                        // Close all windows except main
                        for (id, w) in app.webview_windows() {
                            if id.to_string() != "main" {
                                let _ = w.close();
                            }
                        }
                    }
                    
                    // Help Menu
                    "help_docs" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "openHelp"}));
                    }
                    "help_shortcuts" => {
                        let _ = win.emit("menu-action", serde_json::json!({"action": "showShortcuts"}));
                    }
                    
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Vault
            commands::set_initial_vault_path,
            commands::get_vault_path,
            commands::migrate_vault_structure,
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
            // Bookmarks
            commands::get_bookmarks_by_source,
            commands::get_all_bookmarks,
            commands::create_bookmark,
            commands::update_bookmark,
            commands::delete_bookmark,
            commands::get_bookmark,
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
            // Assets
            commands::save_image,
            commands::read_image,
            commands::delete_image,
            commands::read_local_file,
            commands::save_book_file,
            commands::get_book_file_url,
            commands::read_book_file,
            // Books
            commands::import_book,
            commands::get_chapter_content,
            // AI
            commands::ai_start_server,
            commands::ai_stop_server,
            commands::ai_check_status,
            commands::ai_list_models,
            commands::ai_list_downloaded_models,
            commands::ai_download_model,
            commands::ai_set_active_model,
            commands::ai_chat,
            commands::ai_explain_text,
            commands::ai_rag_query,
            commands::ai_index_source,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

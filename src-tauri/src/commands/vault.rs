//! Vault 相关命令 - 支持切换 vault

use crate::config::ConfigManager;
use crate::db::Database;
use crate::search;
use crate::state::AppState;
use crate::storage;
use crate::vault;
use crate::watcher::VaultWatcher;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

/// 设置 Vault 路径（支持切换）
#[tauri::command]
pub async fn set_initial_vault_path(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    // 尝试获取 vault 锁
    let _lock = vault::VaultLock::try_lock(&path)
        .map_err(|e| format!("Failed to lock vault: {}", e))?;

    // 初始化新的 vault 目录结构
    storage::ensure_vault_structure(&path).map_err(|e| format!("Failed to create vault structure: {}", e))?;

    // 复制迁移文件到 vault
    vault::copy_migrations_to_vault(&path).map_err(|e| format!("Failed to copy migrations: {}", e))?;

    // 打开新 vault 的数据库
    let db_path = vault::get_database_path(&path);
    
    // 确保数据库目录存在且可写
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory {}: {}", parent.display(), e))?;
        
        // 验证目录是否可写
        let test_file = parent.join(".zentri_write_test");
        if let Err(e) = std::fs::File::create(&test_file) {
            return Err(format!("Database directory is not writable: {}. Please check permissions.", e));
        }
        let _ = std::fs::remove_file(&test_file);
    }
    
    let new_db = Database::open(&db_path)
        .await
        .map_err(|e| format!("Failed to open vault database at {}: {}. Please check if the directory exists and is writable.", db_path.display(), e))?;
    let new_db_arc = Arc::new(new_db);

    // 初始化 Indexer
    let index_path = path.join(".zentri/index");
    std::fs::create_dir_all(&index_path).map_err(|e| e.to_string())?;

    let indexer = search::Indexer::new(&index_path).map_err(|e| e.to_string())?;

    // 初始化文件监听器
    let watcher = VaultWatcher::new(&path).ok();
    if watcher.is_none() {
        eprintln!("Warning: Failed to initialize file watcher");
    }

    // 更新状态
    *state.vault_path.lock().unwrap() = Some(path.clone());
    *state.indexer.lock().unwrap() = Some(indexer);
    *state.watcher.lock().unwrap() = watcher;
    *state.db.lock().unwrap() = Some(new_db_arc.clone());
    
    // 重新初始化服务层（使用新的数据库和 vault_path）
    use crate::services::Services;
    *state.services.lock().unwrap() = Some(Arc::new(Services::new(new_db_arc.clone(), Some(path.clone()))));
    
    // 重新初始化 AI 管理器
    use crate::ai::AIManager;
    if let Ok(ai_manager) = AIManager::new(new_db_arc.clone(), Some(path.clone())) {
        *state.ai_manager.lock().unwrap() = Some(Arc::new(ai_manager));
    }
    
    // 重新初始化 CRDT 和 GraphEngine
    use crate::crdt::CrdtManager;
    use crate::graph::GraphEngine;
    *state.crdt.lock().unwrap() = Some(Arc::new(CrdtManager::new(&path)));
    *state.graph_engine.lock().unwrap() = Some(Arc::new(GraphEngine::new(&path)));

    // 保存到应用配置文件（app_data 下）
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zentri");
    let config_manager = ConfigManager::new(&app_data_dir);
    config_manager
        .set_vault_path(Some(&path))
        .map_err(|e| format!("Failed to save vault path to config: {}", e))?;

    Ok(())
}

/// 获取 Vault 路径
#[tauri::command]
pub fn get_vault_path(state: State<AppState>) -> Option<String> {
    state
        .vault_path
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
}

//! Vault 相关命令

use crate::state::AppState;
use crate::search;
use crate::watcher::VaultWatcher;
use std::path::PathBuf;
use tauri::State;

/// 设置 Vault 路径
#[tauri::command]
pub fn set_vault_path(state: State<AppState>, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    
    // 初始化 Indexer
    let index_path = path.join(".zentri/index");
    let indexer = search::Indexer::new(&index_path).map_err(|e| e.to_string())?;
    
    // 初始化文件监听器
    let watcher = VaultWatcher::new(&path).ok();
    if watcher.is_none() {
        eprintln!("Warning: Failed to initialize file watcher");
    }
    
    *state.vault_path.lock().unwrap() = Some(path.clone());
    *state.indexer.lock().unwrap() = Some(indexer);
    *state.watcher.lock().unwrap() = watcher;

    // 保存到配置
    state
        .db
        .set_config("vault_path", &path.to_string_lossy())
        .map_err(|e| e.to_string())?;

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


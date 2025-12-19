//! Vault 相关命令 - 调整后仅支持首次设置，不支持多 vault

use crate::state::AppState;
use crate::search;
use crate::watcher::VaultWatcher;
use std::path::PathBuf;
use tauri::State;

/// 设置初始 Vault 路径（首次启动时）
#[tauri::command]
pub fn set_initial_vault_path(state: State<AppState>, path: String)
-> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    // 初始化 Indexer
    let index_path = path.join(".zentri");
    std::fs::create_dir_all(&index_path).map_err(|e| e.to_string())?;

    let indexer = search::Indexer::new(&index_path).map_err(|e| e.to_string())?;

    // 初始化文件监听器
    let watcher = VaultWatcher::new(&path).ok();
    if watcher.is_none() {
        eprintln!("Warning: Failed to initialize file watcher");
    }

    *state.vault_path.lock().unwrap() = Some(path.clone());
    *state.indexer.lock().unwrap() = Some(indexer);
    *state.watcher.lock().unwrap() = watcher;

    let path_str = path.to_string_lossy().to_string();

    // 保存到配置
    state
        .db
        .set_config("vault_path", &path_str)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取 Vault 路径
#[tauri::command]
pub fn get_vault_path(state: State<AppState>)
-> Option<String> {
    state
        .vault_path
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
}
//! File Watcher 相关命令

use crate::storage;
use crate::state::AppState;
use crate::watcher;
use tauri::State;

/// 文件变更信息
#[derive(serde::Serialize)]
pub struct FileChangeInfo {
    pub changed_ids: Vec<String>,
    pub removed_ids: Vec<String>,
}

/// 轮询文件变化并更新索引
#[tauri::command]
pub fn poll_file_changes(state: State<AppState>) -> Result<FileChangeInfo, String> {
    let vault_path = state.vault_path.lock().unwrap().clone()
        .ok_or("Vault path not set")?;
    
    let mut changed_ids = Vec::new();
    let mut removed_ids = Vec::new();
    
    // 获取文件变化
    let changes = {
        let watcher_guard = state.watcher.lock().unwrap();
        if let Some(watcher) = watcher_guard.as_ref() {
            watcher.poll_changes()
        } else {
            return Ok(FileChangeInfo { changed_ids, removed_ids });
        }
    };
    
    // 获取 indexer
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref();
    
    for change in changes {
        match change {
            watcher::FileChange::Modified(path) => {
                // 从路径提取 ID
                if let Some(id) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(card) = storage::read_card(&vault_path, id) {
                        if let Some(idx) = indexer {
                            idx.index_doc(
                                &card.id,
                                &card.title,
                                &card.content,
                                &card.tags,
                                &card.path,
                                card.modified_at,
                            ).ok();
                        }
                        changed_ids.push(card.id);
                    }
                }
            }
            watcher::FileChange::Removed(path) => {
                if let Some(id) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(idx) = indexer {
                        idx.delete_doc(id).ok();
                    }
                    removed_ids.push(id.to_string());
                }
            }
            watcher::FileChange::Renamed(old_path, new_path) => {
                // 删除旧的
                if let Some(old_id) = old_path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(idx) = indexer {
                        idx.delete_doc(old_id).ok();
                    }
                    removed_ids.push(old_id.to_string());
                }
                
                // 添加新的
                if let Some(new_id) = new_path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(card) = storage::read_card(&vault_path, new_id) {
                        if let Some(idx) = indexer {
                            idx.index_doc(
                                &card.id,
                                &card.title,
                                &card.content,
                                &card.tags,
                                &card.path,
                                card.modified_at,
                            ).ok();
                        }
                        changed_ids.push(card.id);
                    }
                }
            }
        }
    }
    
    Ok(FileChangeInfo { changed_ids, removed_ids })
}

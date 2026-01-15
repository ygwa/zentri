//! File Watcher 相关命令

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
pub async fn poll_file_changes(state: State<'_, AppState>) -> Result<FileChangeInfo, String> {
    let mut changed_ids = Vec::new();
    let mut removed_ids = Vec::new();
    
    // 获取文件变化（在锁外）
    let changes = {
        let watcher_guard = state.watcher.lock().unwrap();
        if let Some(watcher) = watcher_guard.as_ref() {
            watcher.poll_changes()
        } else {
            return Ok(FileChangeInfo { changed_ids, removed_ids });
        }
    };
    
    for change in changes {
        match change {
            watcher::FileChange::Modified(path) => {
                // 从路径提取 ID
                if let Some(id) = path.file_stem().and_then(|s| s.to_str()) {
                    // 在 await 之前释放所有锁
                    let services = match state.get_services() {
                        Some(s) => s,
                        None => continue, // 如果 vault 未初始化，跳过
                    };
                    if let Ok(Some(card)) = services.card.get_by_id(id).await {
                        let path_str = card.path.as_ref().map(|p| p.as_str()).unwrap_or("");
                        // 重新获取 indexer 锁
                        {
                            let indexer_guard = state.indexer.lock().unwrap();
                            if let Some(idx) = indexer_guard.as_ref() {
                                idx.index_doc_with_type(
                                    &card.id,
                                    &card.title,
                                    &card.plain_text,
                                    &card.tags,
                                    path_str,
                                    card.modified_at,
                                    Some(card.card_type.as_str()),
                                ).ok();
                            }
                        }
                        changed_ids.push(card.id);
                    }
                }
            }
            watcher::FileChange::Removed(path) => {
                if let Some(id) = path.file_stem().and_then(|s| s.to_str()) {
                    {
                        let indexer_guard = state.indexer.lock().unwrap();
                        if let Some(idx) = indexer_guard.as_ref() {
                            idx.delete_doc(id).ok();
                        }
                    }
                    removed_ids.push(id.to_string());
                }
            }
            watcher::FileChange::Renamed(old_path, new_path) => {
                // 删除旧的
                if let Some(old_id) = old_path.file_stem().and_then(|s| s.to_str()) {
                    {
                        let indexer_guard = state.indexer.lock().unwrap();
                        if let Some(idx) = indexer_guard.as_ref() {
                            idx.delete_doc(old_id).ok();
                        }
                    }
                    removed_ids.push(old_id.to_string());
                }
                
                // 添加新的
                if let Some(new_id) = new_path.file_stem().and_then(|s| s.to_str()) {
                    let services = match state.get_services() {
                        Some(s) => s,
                        None => continue, // 如果 vault 未初始化，跳过
                    };
                    if let Ok(Some(card)) = services.card.get_by_id(new_id).await {
                        let path_str = card.path.as_ref().map(|p| p.as_str()).unwrap_or("");
                        {
                            let indexer_guard = state.indexer.lock().unwrap();
                            if let Some(idx) = indexer_guard.as_ref() {
                                idx.index_doc_with_type(
                                    &card.id,
                                    &card.title,
                                    &card.plain_text,
                                    &card.tags,
                                    path_str,
                                    card.modified_at,
                                    Some(card.card_type.as_str()),
                                ).ok();
                            }
                        }
                        changed_ids.push(card.id);
                    }
                }
            }
        }
    }
    
    Ok(FileChangeInfo { changed_ids, removed_ids })
}

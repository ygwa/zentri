//! 文件监听器模块
//! 监听 Vault 目录的文件变化，自动触发索引更新

use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::time::Duration;

/// 文件变更事件
#[derive(Debug, Clone)]
pub enum FileChange {
    /// 文件被创建或修改
    Modified(PathBuf),
    /// 文件被删除
    Removed(PathBuf),
    /// 文件被重命名 (旧路径, 新路径)
    Renamed(PathBuf, PathBuf),
}

/// 文件监听器
pub struct VaultWatcher {
    _watcher: RecommendedWatcher,
    receiver: Receiver<Result<Event, notify::Error>>,
    vault_path: PathBuf,
}

impl VaultWatcher {
    /// 创建新的文件监听器
    pub fn new(vault_path: &Path) -> Result<Self, String> {
        let (tx, rx) = channel();
        
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        ).map_err(|e| format!("Failed to create watcher: {}", e))?;
        
        // 开始监听目录
        watcher.watch(vault_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;
        
        Ok(Self {
            _watcher: watcher,
            receiver: rx,
            vault_path: vault_path.to_path_buf(),
        })
    }
    
    /// 获取待处理的文件变更（非阻塞）
    pub fn poll_changes(&self) -> Vec<FileChange> {
        let mut changes = Vec::new();
        
        // 非阻塞地获取所有待处理的事件
        while let Ok(result) = self.receiver.try_recv() {
            if let Ok(event) = result {
                if let Some(change) = self.process_event(event) {
                    changes.push(change);
                }
            }
        }
        
        // 去重：对于同一文件的多次修改，只保留一次
        self.deduplicate_changes(changes)
    }
    
    /// 处理单个事件
    fn process_event(&self, event: Event) -> Option<FileChange> {
        // 只处理 .md 文件
        let paths: Vec<_> = event.paths.iter()
            .filter(|p| {
                p.extension().map(|e| e == "md").unwrap_or(false) &&
                !self.is_hidden_path(p)
            })
            .cloned()
            .collect();
        
        if paths.is_empty() {
            return None;
        }
        
        match event.kind {
            EventKind::Create(CreateKind::File) |
            EventKind::Modify(ModifyKind::Data(_)) |
            EventKind::Modify(ModifyKind::Any) => {
                paths.first().map(|p| FileChange::Modified(p.clone()))
            }
            EventKind::Remove(RemoveKind::File) => {
                paths.first().map(|p| FileChange::Removed(p.clone()))
            }
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => {
                if paths.len() >= 2 {
                    Some(FileChange::Renamed(paths[0].clone(), paths[1].clone()))
                } else {
                    None
                }
            }
            EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
                paths.first().map(|p| FileChange::Removed(p.clone()))
            }
            EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
                paths.first().map(|p| FileChange::Modified(p.clone()))
            }
            _ => None
        }
    }
    
    /// 检查路径是否在隐藏目录中
    fn is_hidden_path(&self, path: &Path) -> bool {
        if let Ok(relative) = path.strip_prefix(&self.vault_path) {
            relative.components().any(|c| {
                c.as_os_str().to_string_lossy().starts_with('.')
            })
        } else {
            false
        }
    }
    
    /// 去重变更事件
    fn deduplicate_changes(&self, changes: Vec<FileChange>) -> Vec<FileChange> {
        use std::collections::HashMap;
        
        let mut path_to_change: HashMap<PathBuf, FileChange> = HashMap::new();
        
        for change in changes {
            match &change {
                FileChange::Modified(p) | FileChange::Removed(p) => {
                    path_to_change.insert(p.clone(), change);
                }
                FileChange::Renamed(old, new) => {
                    path_to_change.remove(old);
                    path_to_change.insert(new.clone(), change);
                }
            }
        }
        
        path_to_change.into_values().collect()
    }
    
    /// 获取相对路径 ID
    pub fn get_relative_id(&self, path: &Path) -> Option<String> {
        path.strip_prefix(&self.vault_path)
            .ok()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
    }
}

/// 带防抖的文件监听器（用于减少频繁触发）
#[allow(dead_code)]
pub struct DebouncedVaultWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    receiver: Receiver<Result<Vec<DebouncedEvent>, notify::Error>>,
    vault_path: PathBuf,
}

impl DebouncedVaultWatcher {
    /// 创建带防抖的监听器（默认 500ms 防抖）
    #[allow(dead_code)]
    pub fn new(vault_path: &Path, debounce_ms: u64) -> Result<Self, String> {
        let (tx, rx) = channel();
        
        let debouncer = new_debouncer(
            Duration::from_millis(debounce_ms),
            move |res| {
                let _ = tx.send(res);
            },
        ).map_err(|e| format!("Failed to create debouncer: {}", e))?;
        
        // 在创建后立即开始监听
        let mut watcher = debouncer;
        watcher.watcher().watch(vault_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;
        
        Ok(Self {
            debouncer: watcher,
            receiver: rx,
            vault_path: vault_path.to_path_buf(),
        })
    }
    
    /// 获取待处理的文件变更（非阻塞）
    #[allow(dead_code)]
    pub fn poll_changes(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        
        while let Ok(result) = self.receiver.try_recv() {
            if let Ok(events) = result {
                for event in events {
                    let path = event.path;
                    // 只处理 .md 文件，且不在隐藏目录
                    if path.extension().map(|e| e == "md").unwrap_or(false) 
                        && !self.is_hidden_path(&path) 
                    {
                        if !paths.contains(&path) {
                            paths.push(path);
                        }
                    }
                }
            }
        }
        
        paths
    }
    
    /// 检查路径是否在隐藏目录中
    #[allow(dead_code)]
    fn is_hidden_path(&self, path: &Path) -> bool {
        if let Ok(relative) = path.strip_prefix(&self.vault_path) {
            relative.components().any(|c| {
                c.as_os_str().to_string_lossy().starts_with('.')
            })
        } else {
            false
        }
    }
    
    /// 获取相对路径 ID
    #[allow(dead_code)]
    pub fn get_relative_id(&self, path: &Path) -> Option<String> {
        path.strip_prefix(&self.vault_path)
            .ok()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[allow(unused_imports)]
    use std::fs;
    use tempfile::tempdir;
    
    #[test]
    fn test_watcher_creation() {
        let dir = tempdir().unwrap();
        let watcher = VaultWatcher::new(dir.path());
        assert!(watcher.is_ok());
    }
}


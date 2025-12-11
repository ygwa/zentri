//! 应用状态模块

use crate::db::Database;
use crate::search::Indexer;
use crate::watcher::VaultWatcher;
use std::path::PathBuf;
use std::sync::Mutex;

/// 应用全局状态
pub struct AppState {
    /// 数据库连接
    pub db: Database,
    /// Vault 路径
    pub vault_path: Mutex<Option<PathBuf>>,
    /// 搜索索引器
    pub indexer: Mutex<Option<Indexer>>,
    /// 文件监听器
    pub watcher: Mutex<Option<VaultWatcher>>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(db: Database, vault_path: Option<PathBuf>, indexer: Option<Indexer>, watcher: Option<VaultWatcher>) -> Self {
        Self {
            db,
            vault_path: Mutex::new(vault_path),
            indexer: Mutex::new(indexer),
            watcher: Mutex::new(watcher),
        }
    }
}


//! 应用状态模块

use crate::crdt::CrdtManager;
use crate::db::Database;
use crate::graph::GraphEngine;
use crate::search::Indexer;
use crate::watcher::VaultWatcher;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

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
    /// CRDT 管理器 (协作编辑)
    pub crdt: Mutex<Option<Arc<CrdtManager>>>,
    /// 图谱引擎 (增强版)
    pub graph_engine: Mutex<Option<Arc<GraphEngine>>>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(
        db: Database,
        vault_path: Option<PathBuf>,
        indexer: Option<Indexer>,
        watcher: Option<VaultWatcher>,
    ) -> Self {
        // 初始化 CRDT 和 GraphEngine
        let crdt = vault_path
            .as_ref()
            .map(|p| Arc::new(CrdtManager::new(p)));
        let graph_engine = vault_path
            .as_ref()
            .map(|p| Arc::new(GraphEngine::new(p)));

        Self {
            db,
            vault_path: Mutex::new(vault_path),
            indexer: Mutex::new(indexer),
            watcher: Mutex::new(watcher),
            crdt: Mutex::new(crdt),
            graph_engine: Mutex::new(graph_engine),
        }
    }

    /// 更新 Vault 路径时重新初始化相关组件
    pub fn reinitialize_for_vault(&self, new_path: &PathBuf) {
        // 重新初始化 CRDT
        let new_crdt = Arc::new(CrdtManager::new(new_path));
        *self.crdt.lock().unwrap() = Some(new_crdt);

        // 重新初始化 GraphEngine
        let new_graph = Arc::new(GraphEngine::new(new_path));
        *self.graph_engine.lock().unwrap() = Some(new_graph);
    }
}


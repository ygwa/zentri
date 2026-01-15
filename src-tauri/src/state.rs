//! 应用状态模块

use crate::ai::AIManager;
use crate::crdt::CrdtManager;
use crate::db::Database;
use crate::graph::GraphEngine;
use crate::search::Indexer;
use crate::services::Services;
use crate::watcher::VaultWatcher;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// 应用全局状态
pub struct AppState {
    /// 数据库连接（使用 Mutex<Option<Arc>> 以支持延迟初始化）
    pub db: Mutex<Option<Arc<Database>>>,
    /// 应用服务层（使用 Mutex<Option<Arc>> 以支持延迟初始化）
    pub services: Mutex<Option<Arc<Services>>>,
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
    /// AI 管理器
    pub ai_manager: Mutex<Option<Arc<AIManager>>>,
}

impl AppState {
    /// 创建新的应用状态（无 vault 时）
    pub fn new_empty() -> Self {
        Self {
            db: Mutex::new(None),
            services: Mutex::new(None),
            vault_path: Mutex::new(None),
            indexer: Mutex::new(None),
            watcher: Mutex::new(None),
            crdt: Mutex::new(None),
            graph_engine: Mutex::new(None),
            ai_manager: Mutex::new(None),
        }
    }

    /// 创建新的应用状态（有 vault 时）
    pub fn new_with_vault(
        db: Arc<Database>,
        vault_path: PathBuf,
        indexer: Option<Indexer>,
        watcher: Option<VaultWatcher>,
    ) -> Self {
        // 初始化 CRDT 和 GraphEngine
        let crdt = Some(Arc::new(CrdtManager::new(&vault_path)));
        let graph_engine = Some(Arc::new(GraphEngine::new(&vault_path)));

        // 初始化服务层
        let services = Arc::new(Services::new(db.clone(), Some(vault_path.clone())));
        
        // 初始化 AI 管理器
        let ai_manager = AIManager::new(db.clone(), Some(vault_path.clone()))
            .ok()
            .map(Arc::new);

        Self {
            db: Mutex::new(Some(db)),
            services: Mutex::new(Some(services)),
            vault_path: Mutex::new(Some(vault_path)),
            indexer: Mutex::new(indexer),
            watcher: Mutex::new(watcher),
            crdt: Mutex::new(crdt),
            graph_engine: Mutex::new(graph_engine),
            ai_manager: Mutex::new(ai_manager),
        }
    }

    /// 更新 Vault 路径时重新初始化相关组件
    #[allow(dead_code)]
    pub fn reinitialize_for_vault(&self, new_path: &PathBuf) {
        // 重新初始化 CRDT
        let new_crdt = Arc::new(CrdtManager::new(new_path));
        *self.crdt.lock().unwrap() = Some(new_crdt);

        // 重新初始化 GraphEngine
        let new_graph = Arc::new(GraphEngine::new(new_path));
        *self.graph_engine.lock().unwrap() = Some(new_graph);
    }

    /// 获取服务层（如果已初始化）
    pub fn get_services(&self) -> Option<Arc<Services>> {
        self.services.lock().unwrap().clone()
    }

    /// 获取数据库（如果已初始化）
    pub fn get_db(&self) -> Option<Arc<Database>> {
        self.db.lock().unwrap().clone()
    }

    /// 检查 vault 是否已初始化
    pub fn is_vault_initialized(&self) -> bool {
        self.vault_path.lock().unwrap().is_some()
    }
}


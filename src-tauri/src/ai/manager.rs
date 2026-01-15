//! AI 管理器
//! 统一管理 Sidecar、模型和 RAG 服务

use crate::ai::{SidecarManager, ModelManager, RAGService};
use crate::db::Database;
use std::sync::Arc;
use std::sync::Mutex;

/// AI 管理器
pub struct AIManager {
    sidecar: Arc<SidecarManager>,
    models: Arc<ModelManager>,
    rag: Arc<Mutex<Option<Arc<RAGService>>>>,
    db: Arc<Database>,
    port: Arc<Mutex<u16>>,
    vault_path: Arc<Mutex<Option<std::path::PathBuf>>>,
}

impl AIManager {
    pub fn new(db: Arc<Database>, vault_path: Option<std::path::PathBuf>) -> Result<Self, String> {
        let models = ModelManager::new().map_err(|e| e.to_string())?;
        
        Ok(Self {
            sidecar: Arc::new(SidecarManager::new()),
            models: Arc::new(models),
            rag: Arc::new(Mutex::new(None)),
            db,
            port: Arc::new(Mutex::new(8080)),
            vault_path: Arc::new(Mutex::new(vault_path)),
        })
    }

    pub fn set_vault_path(&self, vault_path: Option<std::path::PathBuf>) {
        *self.vault_path.lock().unwrap() = vault_path;
        // 重置 RAG 服务以使用新的 vault_path
        let mut rag_guard = self.rag.lock().unwrap();
        *rag_guard = None;
    }

    pub fn get_sidecar(&self) -> Arc<SidecarManager> {
        self.sidecar.clone()
    }

    pub fn get_models(&self) -> Arc<ModelManager> {
        self.models.clone()
    }

    pub fn get_rag(&self) -> Arc<RAGService> {
        let mut rag_guard = self.rag.lock().unwrap();
        if rag_guard.is_none() {
            let port = *self.port.lock().unwrap();
            let vault_path = self.vault_path.lock().unwrap().clone();
            let rag_service = Arc::new(RAGService::new(self.db.clone(), port, vault_path));
            *rag_guard = Some(rag_service.clone());
            rag_service
        } else {
            rag_guard.as_ref().unwrap().clone()
        }
    }

    pub fn set_port(&self, port: u16) {
        *self.port.lock().unwrap() = port;
        // 重置 RAG 服务以使用新端口
        let mut rag_guard = self.rag.lock().unwrap();
        *rag_guard = None;
    }

    pub fn get_port(&self) -> u16 {
        *self.port.lock().unwrap()
    }
}


//! CRDT 模块
//! 基于 Yrs (Y.js Rust 实现) 实现协作编辑和历史记录
//!
//! 核心功能:
//! - 文档状态管理
//! - 增量更新同步
//! - 历史快照与回滚
//! - 多窗口/多端协作

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{Doc, GetString, ReadTxn, StateVector, Text, Transact, Update};

/// CRDT 文档状态
#[derive(Clone)]
pub struct CrdtDocument {
    /// Yrs 文档
    pub doc: Doc,
    /// 文档 ID (对应卡片 ID)
    pub id: String,
    /// 是否有未保存的更改
    pub dirty: bool,
}

impl CrdtDocument {
    /// 创建新文档
    pub fn new(id: &str) -> Self {
        let doc = Doc::new();
        Self {
            doc,
            id: id.to_string(),
            dirty: false,
        }
    }

    /// 从二进制状态恢复
    pub fn from_state(id: &str, state: &[u8]) -> Result<Self, String> {
        let doc = Doc::new();
        {
            let mut txn = doc.transact_mut();
            let update = Update::decode_v1(state).map_err(|e| format!("Decode error: {:?}", e))?;
            txn.apply_update(update);
        }
        Ok(Self {
            doc,
            id: id.to_string(),
            dirty: false,
        })
    }

    /// 导出完整状态
    pub fn encode_state(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_state_as_update_v1(&StateVector::default())
    }

    /// 获取状态向量 (用于增量同步)
    pub fn state_vector(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }

    /// 应用增量更新
    pub fn apply_update(&mut self, update: &[u8]) -> Result<(), String> {
        let mut txn = self.doc.transact_mut();
        let update =
            Update::decode_v1(update).map_err(|e| format!("Decode update error: {:?}", e))?;
        txn.apply_update(update);
        self.dirty = true;
        Ok(())
    }

    /// 计算增量更新 (从给定状态向量)
    pub fn encode_diff(&self, sv_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let txn = self.doc.transact();
        let sv = StateVector::decode_v1(sv_bytes)
            .map_err(|e| format!("Decode state vector error: {:?}", e))?;
        Ok(txn.encode_state_as_update_v1(&sv))
    }

    /// 获取文本内容 (从 "content" 字段)
    pub fn get_text(&self) -> String {
        let text = self.doc.get_or_insert_text("content");
        let txn = self.doc.transact();
        text.get_string(&txn)
    }

    /// 设置文本内容
    pub fn set_text(&mut self, content: &str) {
        let text = self.doc.get_or_insert_text("content");
        let mut txn = self.doc.transact_mut();
        // 清空并设置新内容
        let len = text.len(&txn);
        if len > 0 {
            text.remove_range(&mut txn, 0, len);
        }
        text.insert(&mut txn, 0, content);
        self.dirty = true;
    }
}

/// 历史快照
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySnapshot {
    /// 快照 ID
    pub id: String,
    /// 创建时间戳
    pub timestamp: i64,
    /// 快照描述 (可选)
    pub description: Option<String>,
    /// 状态数据 (base64 编码)
    #[serde(skip)]
    pub state: Vec<u8>,
}

/// CRDT 管理器
/// 负责管理所有打开文档的 CRDT 状态
pub struct CrdtManager {
    /// 活跃文档缓存
    documents: RwLock<HashMap<String, Arc<RwLock<CrdtDocument>>>>,
    /// 存储路径
    storage_path: PathBuf,
}

impl CrdtManager {
    /// 创建新的 CRDT 管理器
    pub fn new(vault_path: &Path) -> Self {
        let storage_path = vault_path.join(".zentri/crdt");
        // 确保目录存在
        fs::create_dir_all(&storage_path).ok();

        Self {
            documents: RwLock::new(HashMap::new()),
            storage_path,
        }
    }

    /// 获取或创建文档
    pub fn get_or_create(&self, doc_id: &str) -> Arc<RwLock<CrdtDocument>> {
        // 先检查缓存
        {
            let docs = self.documents.read().unwrap();
            if let Some(doc) = docs.get(doc_id) {
                return doc.clone();
            }
        }

        // 尝试从磁盘加载
        let doc = self.load_from_disk(doc_id).unwrap_or_else(|| {
            // 创建新文档
            CrdtDocument::new(doc_id)
        });

        let arc_doc = Arc::new(RwLock::new(doc));

        // 添加到缓存
        {
            let mut docs = self.documents.write().unwrap();
            docs.insert(doc_id.to_string(), arc_doc.clone());
        }

        arc_doc
    }

    /// 从磁盘加载文档
    fn load_from_disk(&self, doc_id: &str) -> Option<CrdtDocument> {
        let file_path = self.storage_path.join(format!("{}.yrs", doc_id));
        if file_path.exists() {
            let state = fs::read(&file_path).ok()?;
            CrdtDocument::from_state(doc_id, &state).ok()
        } else {
            None
        }
    }

    /// 保存文档到磁盘
    pub fn save_to_disk(&self, doc_id: &str) -> Result<(), String> {
        let docs = self.documents.read().unwrap();
        if let Some(doc_arc) = docs.get(doc_id) {
            let doc = doc_arc.read().unwrap();
            let state = doc.encode_state();
            let file_path = self.storage_path.join(format!("{}.yrs", doc_id));
            fs::write(&file_path, &state).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// 应用来自前端的更新
    pub fn apply_update(&self, doc_id: &str, update: &[u8]) -> Result<(), String> {
        let doc_arc = self.get_or_create(doc_id);
        let mut doc = doc_arc.write().unwrap();
        doc.apply_update(update)?;
        Ok(())
    }

    /// 获取增量更新
    pub fn get_diff(&self, doc_id: &str, state_vector: &[u8]) -> Result<Vec<u8>, String> {
        let doc_arc = self.get_or_create(doc_id);
        let doc = doc_arc.read().unwrap();
        doc.encode_diff(state_vector)
    }

    /// 获取完整状态
    pub fn get_full_state(&self, doc_id: &str) -> Vec<u8> {
        let doc_arc = self.get_or_create(doc_id);
        let doc = doc_arc.read().unwrap();
        doc.encode_state()
    }

    /// 获取状态向量
    pub fn get_state_vector(&self, doc_id: &str) -> Vec<u8> {
        let doc_arc = self.get_or_create(doc_id);
        let doc = doc_arc.read().unwrap();
        doc.state_vector()
    }

    /// 创建历史快照
    pub fn create_snapshot(&self, doc_id: &str, description: Option<&str>) -> Result<HistorySnapshot, String> {
        let doc_arc = self.get_or_create(doc_id);
        let doc = doc_arc.read().unwrap();
        let state = doc.encode_state();
        
        let snapshot = HistorySnapshot {
            id: format!("{}-{}", doc_id, chrono::Utc::now().timestamp_millis()),
            timestamp: chrono::Utc::now().timestamp_millis(),
            description: description.map(String::from),
            state,
        };
        
        // 保存快照到磁盘
        let snapshots_dir = self.storage_path.join("snapshots").join(doc_id);
        fs::create_dir_all(&snapshots_dir).map_err(|e| e.to_string())?;
        
        let snapshot_path = snapshots_dir.join(format!("{}.yrs", snapshot.timestamp));
        fs::write(&snapshot_path, &snapshot.state).map_err(|e| e.to_string())?;
        
        // 保存元数据
        let meta_path = snapshots_dir.join(format!("{}.json", snapshot.timestamp));
        let meta = serde_json::json!({
            "id": snapshot.id,
            "timestamp": snapshot.timestamp,
            "description": snapshot.description,
        });
        fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap())
            .map_err(|e| e.to_string())?;
        
        Ok(snapshot)
    }

    /// 获取快照列表
    pub fn list_snapshots(&self, doc_id: &str) -> Vec<HistorySnapshot> {
        let snapshots_dir = self.storage_path.join("snapshots").join(doc_id);
        if !snapshots_dir.exists() {
            return vec![];
        }
        
        let mut snapshots = vec![];
        if let Ok(entries) = fs::read_dir(&snapshots_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "json").unwrap_or(false) {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                            snapshots.push(HistorySnapshot {
                                id: meta["id"].as_str().unwrap_or("").to_string(),
                                timestamp: meta["timestamp"].as_i64().unwrap_or(0),
                                description: meta["description"].as_str().map(String::from),
                                state: vec![], // 不加载完整状态
                            });
                        }
                    }
                }
            }
        }
        
        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        snapshots
    }

    /// 恢复到指定快照
    pub fn restore_snapshot(&self, doc_id: &str, snapshot_timestamp: i64) -> Result<(), String> {
        let snapshots_dir = self.storage_path.join("snapshots").join(doc_id);
        let snapshot_path = snapshots_dir.join(format!("{}.yrs", snapshot_timestamp));
        
        if !snapshot_path.exists() {
            return Err("Snapshot not found".to_string());
        }
        
        let state = fs::read(&snapshot_path).map_err(|e| e.to_string())?;
        
        // 创建新文档并替换
        let new_doc = CrdtDocument::from_state(doc_id, &state)?;
        
        let mut docs = self.documents.write().unwrap();
        docs.insert(doc_id.to_string(), Arc::new(RwLock::new(new_doc)));
        
        // 同时保存到主存储
        self.save_to_disk(doc_id)?;
        
        Ok(())
    }

    /// 保存所有脏文档
    pub fn flush_all(&self) -> Result<usize, String> {
        let docs = self.documents.read().unwrap();
        let mut count = 0;
        
        for (doc_id, doc_arc) in docs.iter() {
            let doc = doc_arc.read().unwrap();
            if doc.dirty {
                let state = doc.encode_state();
                let file_path = self.storage_path.join(format!("{}.yrs", doc_id));
                fs::write(&file_path, &state).map_err(|e| e.to_string())?;
                count += 1;
            }
        }
        
        Ok(count)
    }

    /// 从缓存移除文档
    pub fn unload(&self, doc_id: &str) {
        let mut docs = self.documents.write().unwrap();
        docs.remove(doc_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_crdt_document_basic() {
        let mut doc = CrdtDocument::new("test");
        doc.set_text("Hello, World!");
        assert_eq!(doc.get_text(), "Hello, World!");
    }

    #[test]
    fn test_crdt_sync() {
        let mut doc1 = CrdtDocument::new("test");
        let mut doc2 = CrdtDocument::new("test");

        doc1.set_text("Hello");
        let update = doc1.encode_state();
        doc2.apply_update(&update).unwrap();

        assert_eq!(doc2.get_text(), "Hello");
    }

    #[test]
    fn test_crdt_manager() {
        let dir = tempdir().unwrap();
        let manager = CrdtManager::new(dir.path());

        let doc = manager.get_or_create("test-doc");
        {
            let mut doc_guard = doc.write().unwrap();
            doc_guard.set_text("Test content");
        }

        manager.save_to_disk("test-doc").unwrap();

        // 验证可以重新加载
        let manager2 = CrdtManager::new(dir.path());
        let doc2 = manager2.get_or_create("test-doc");
        let doc_guard = doc2.read().unwrap();
        assert_eq!(doc_guard.get_text(), "Test content");
    }
}


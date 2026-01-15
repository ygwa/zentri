//! Config 数据访问层

use crate::db::Database;
use crate::error::AppResult;
use std::sync::Arc;

/// Config 数据访问层
pub struct ConfigRepository {
    db: Arc<Database>,
}

impl ConfigRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 获取配置
    pub async fn get(&self, key: &str) -> AppResult<Option<String>> {
        self.db.get_config(key).await
    }

    /// 设置配置
    pub async fn set(&self, key: &str, value: &str) -> AppResult<()> {
        self.db.set_config(key, value).await
    }

    /// 获取 Vault 历史记录列表
    #[allow(dead_code)]
    pub async fn get_vault_history(&self) -> AppResult<Vec<String>> {
        self.db.get_vault_history().await
    }

    /// 添加 Vault 到历史记录
    #[allow(dead_code)]
    pub async fn add_vault_to_history(&self, path: &str) -> AppResult<()> {
        self.db.add_vault_to_history(path).await
    }
}

impl crate::database::Repository for ConfigRepository {
    fn db(&self) -> &Arc<Database> {
        &self.db
    }
}


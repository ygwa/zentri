//! Source 数据访问层

use crate::db::Database;
use crate::error::AppResult;
use crate::models::{CreateSourceRequest, Source, UpdateSourceRequest};
use std::sync::Arc;

/// Source 数据访问层
pub struct SourceRepository {
    db: Arc<Database>,
}

impl SourceRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 创建文献源
    pub async fn create(&self, req: CreateSourceRequest) -> AppResult<Source> {
        self.db.create_source(req).await
    }

    /// 获取所有文献源
    pub async fn get_all(&self) -> AppResult<Vec<Source>> {
        self.db.get_all_sources().await
    }

    /// 分页获取文献源
    pub async fn get_paginated(&self, offset: usize, limit: usize) -> AppResult<Vec<Source>> {
        self.db.get_sources_paginated(offset, limit).await
    }

    /// 获取文献源总数
    pub async fn get_count(&self) -> AppResult<usize> {
        self.db.get_sources_count().await
    }

    /// 获取单个文献源
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Source>> {
        self.db.get_source(id).await
    }

    /// 更新文献源
    pub async fn update(&self, id: &str, req: UpdateSourceRequest) -> AppResult<Option<Source>> {
        self.db.update_source(id, req).await
    }

    /// 删除文献源
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.db.delete_source(id).await
    }

    /// 添加笔记 ID 到文献源
    pub async fn add_note(&self, source_id: &str, note_id: &str) -> AppResult<()> {
        self.db.add_note_to_source(source_id, note_id).await
    }
}

impl crate::database::Repository for SourceRepository {
    fn db(&self) -> &Arc<Database> {
        &self.db
    }
}


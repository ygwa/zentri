//! Source 应用服务层
//! 封装 Source 相关的业务逻辑

use crate::database::SourceRepository;
use crate::error::AppResult;
use crate::models::{CreateSourceRequest, Source, UpdateSourceRequest};
use std::sync::Arc;

/// Source 应用服务
pub struct SourceService {
    repo: Arc<SourceRepository>,
}

impl SourceService {
    pub fn new(repo: Arc<SourceRepository>) -> Self {
        Self { repo }
    }

    /// 创建文献源
    pub async fn create(&self, req: CreateSourceRequest) -> AppResult<Source> {
        self.repo.create(req).await
    }

    /// 获取所有文献源
    pub async fn get_all(&self) -> AppResult<Vec<Source>> {
        self.repo.get_all().await
    }

    /// 分页获取文献源
    pub async fn get_paginated(&self, offset: usize, limit: usize) -> AppResult<Vec<Source>> {
        self.repo.get_paginated(offset, limit).await
    }

    /// 获取文献源总数
    pub async fn get_count(&self) -> AppResult<usize> {
        self.repo.get_count().await
    }

    /// 获取单个文献源
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Source>> {
        self.repo.get_by_id(id).await
    }

    /// 更新文献源
    pub async fn update(&self, id: &str, req: UpdateSourceRequest) -> AppResult<Option<Source>> {
        self.repo.update(id, req).await
    }

    /// 删除文献源（包含关联数据清理）
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        // 删除操作会自动级联删除关联的高亮和书签（通过外键约束）
        self.repo.delete(id).await
    }

    /// 添加笔记到文献源
    pub async fn add_note(&self, source_id: &str, note_id: &str) -> AppResult<()> {
        self.repo.add_note(source_id, note_id).await
    }
}


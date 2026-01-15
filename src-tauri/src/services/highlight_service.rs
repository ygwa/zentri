//! Highlight 应用服务层
//! 封装 Highlight 相关的业务逻辑

use crate::commands::highlights::SourceBacklink;
use crate::database::HighlightRepository;
use crate::error::AppResult;
use crate::models::{CreateHighlightRequest, Highlight, UpdateHighlightRequest};
use std::sync::Arc;

/// Highlight 应用服务
pub struct HighlightService {
    repo: Arc<HighlightRepository>,
}

impl HighlightService {
    pub fn new(repo: Arc<HighlightRepository>) -> Self {
        Self { repo }
    }

    /// 创建高亮
    pub async fn create(&self, req: CreateHighlightRequest) -> AppResult<Highlight> {
        self.repo.create(req).await
    }

    /// 获取文献源的所有高亮
    pub async fn get_by_source(&self, source_id: &str) -> AppResult<Vec<Highlight>> {
        self.repo.get_by_source(source_id).await
    }

    /// 获取所有高亮
    pub async fn get_all(&self) -> AppResult<Vec<Highlight>> {
        self.repo.get_all().await
    }

    /// 获取单个高亮
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Highlight>> {
        self.repo.get_by_id(id).await
    }

    /// 更新高亮
    pub async fn update(&self, id: &str, req: UpdateHighlightRequest) -> AppResult<Option<Highlight>> {
        self.repo.update(id, req).await
    }

    /// 删除高亮
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.repo.delete(id).await
    }

    /// 获取卡片关联的高亮
    pub async fn get_by_card(&self, card_id: &str) -> AppResult<Vec<Highlight>> {
        self.repo.get_by_card(card_id).await
    }

    /// 获取引用该文献源的所有笔记（反向链接）
    pub async fn get_backlinks(&self, source_id: &str) -> AppResult<Vec<SourceBacklink>> {
        self.repo.get_backlinks(source_id).await
    }
}


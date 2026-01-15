//! Highlight 数据访问层

use crate::commands::highlights::SourceBacklink;
use crate::db::Database;
use crate::error::AppResult;
use crate::models::{CreateHighlightRequest, Highlight, UpdateHighlightRequest};
use std::sync::Arc;

/// Highlight 数据访问层
pub struct HighlightRepository {
    db: Arc<Database>,
}

impl HighlightRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 创建高亮
    pub async fn create(&self, req: CreateHighlightRequest) -> AppResult<Highlight> {
        self.db.create_highlight(req).await
    }

    /// 获取文献源的所有高亮
    pub async fn get_by_source(&self, source_id: &str) -> AppResult<Vec<Highlight>> {
        self.db.get_highlights_by_source(source_id).await
    }

    /// 获取所有高亮
    pub async fn get_all(&self) -> AppResult<Vec<Highlight>> {
        self.db.get_all_highlights().await
    }

    /// 获取单个高亮
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Highlight>> {
        self.db.get_highlight(id).await
    }

    /// 更新高亮
    pub async fn update(&self, id: &str, req: UpdateHighlightRequest) -> AppResult<Option<Highlight>> {
        self.db.update_highlight(id, req).await
    }

    /// 删除高亮
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.db.delete_highlight(id).await
    }

    /// 获取卡片关联的高亮
    pub async fn get_by_card(&self, card_id: &str) -> AppResult<Vec<Highlight>> {
        self.db.get_highlights_by_card(card_id).await
    }

    /// 获取引用该文献源的所有笔记（反向链接）
    pub async fn get_backlinks(&self, source_id: &str) -> AppResult<Vec<SourceBacklink>> {
        self.db.get_backlinks_for_source(source_id).await
    }
}

impl crate::database::Repository for HighlightRepository {
    fn db(&self) -> &Arc<Database> {
        &self.db
    }
}


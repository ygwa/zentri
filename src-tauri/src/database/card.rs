//! Card 数据访问层

use crate::db::Database;
use crate::error::AppResult;
use crate::models::{Card, CardType, CreateCardRequest, UpdateCardRequest};
use std::sync::Arc;

/// Card 数据访问层
pub struct CardRepository {
    db: Arc<Database>,
}

impl CardRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 创建卡片
    pub async fn create(&self, req: CreateCardRequest) -> AppResult<Card> {
        self.db.create_card(req).await
    }

    /// 获取单个卡片
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Card>> {
        self.db.get_card(id).await
    }

    /// 获取所有卡片
    pub async fn get_all(&self) -> AppResult<Vec<Card>> {
        self.db.get_all_cards().await
    }

    /// 按类型获取卡片
    pub async fn get_by_type(&self, card_type: CardType) -> AppResult<Vec<Card>> {
        self.db.get_cards_by_type(card_type).await
    }

    /// 按文献源获取卡片
    pub async fn get_by_source(&self, source_id: &str) -> AppResult<Vec<Card>> {
        self.db.get_cards_by_source(source_id).await
    }

    /// 分页获取卡片
    pub async fn get_paginated(&self, offset: usize, limit: usize) -> AppResult<Vec<Card>> {
        self.db.get_cards_paginated(offset, limit).await
    }

    /// 更新卡片
    pub async fn update(&self, id: &str, req: UpdateCardRequest) -> AppResult<Option<Card>> {
        self.db.update_card(id, req).await
    }

    /// 删除卡片
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.db.delete_card(id).await
    }

    /// 获取卡片的所有链接
    pub async fn get_links(&self, card_id: &str) -> AppResult<Vec<String>> {
        self.db.get_card_links(card_id).await
    }

    /// 获取反向链接（引用该卡片的卡片）
    pub async fn get_backlinks(&self, card_id: &str) -> AppResult<Vec<Card>> {
        self.db.get_backlinks(card_id).await
    }
}

impl crate::database::Repository for CardRepository {
    fn db(&self) -> &Arc<Database> {
        &self.db
    }
}




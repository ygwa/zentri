//! Card 应用服务层
//! 封装 Card 相关的业务逻辑，协调 CardRepository 和其他服务

use crate::database::CardRepository;
use crate::database::SourceRepository;
use crate::error::AppResult;
use crate::models::{Card, CardType, CreateCardRequest, UpdateCardRequest};
use crate::search::Indexer;
use serde_json::Value as JsonValue;
use std::sync::{Arc, Mutex};

/// Card 应用服务
pub struct CardService {
    card_repo: Arc<CardRepository>,
    source_repo: Arc<SourceRepository>,
}

impl CardService {
    pub fn new(card_repo: Arc<CardRepository>, source_repo: Arc<SourceRepository>) -> Self {
        Self {
            card_repo,
            source_repo,
        }
    }

    /// 获取所有卡片
    pub async fn get_all(&self) -> AppResult<Vec<Card>> {
        let mut cards = self.card_repo.get_all().await?;
        // 为每个卡片生成虚拟路径
        for card in &mut cards {
            if card.path.is_none() {
                card.path = Some(card.generate_path());
            }
        }
        Ok(cards)
    }

    /// 获取单个卡片
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Card>> {
        if id.contains("..") {
            return Err(crate::error::AppError::InvalidInput("Invalid card ID".to_string()));
        }
        let mut card = self.card_repo.get_by_id(id).await?;
        if let Some(ref mut c) = card {
            if c.path.is_none() {
                c.path = Some(c.generate_path());
            }
        }
        Ok(card)
    }

    /// 通过路径获取卡片（兼容旧 API）
    pub async fn get_by_path(&self, path: &str) -> AppResult<Option<Card>> {
        let id = if let Some(id) = path
            .strip_prefix("cards/")
            .and_then(|p| p.strip_suffix(".json"))
        {
            id
        } else {
            path
        };
        self.get_by_id(id).await
    }

    /// 创建卡片
    pub async fn create(
        &self,
        card_type: CardType,
        title: &str,
        content: Option<&str>,
        source_id: Option<&str>,
        indexer: Option<&Mutex<Option<Indexer>>>,
    ) -> AppResult<Card> {
        // 验证输入
        if title.trim().is_empty() {
            return Err(crate::error::AppError::InvalidInput(
                "Title cannot be empty".to_string(),
            ));
        }

        // 准备内容
        let content_str = content.unwrap_or_else(|| {
            r#"{"type":"doc","content":[{"type":"paragraph"}]}"#
        });

        // 创建请求（links 将在 db.rs 的 create_card 中从 content 提取）
        let req = CreateCardRequest {
            id: None, // 使用默认 UUID
            title: title.to_string(),
            card_type,
            content: content_str.to_string(),
            tags: vec![],
            aliases: vec![],
            source_id: source_id.map(String::from),
        };

        // 创建卡片（links 已在 db.rs 的 create_card 中从 content 提取）
        let mut card = self.card_repo.create(req).await?;

        // 生成虚拟路径
        if card.path.is_none() {
            card.path = Some(card.generate_path());
        }

        // 如果有 source_id，添加到 source 的 note_ids
        if let Some(sid) = source_id {
            self.source_repo.add_note(sid, &card.id).await?;
        }

        // 更新搜索索引
        if let Some(indexer) = indexer {
            if let Ok(Some(idx)) = indexer.lock().as_deref() {
                let path = card.path.as_ref().map(|p| p.as_str()).unwrap_or("");
                idx.index_doc_with_type(
                    &card.id,
                    &card.title,
                    &card.plain_text,
                    &card.tags,
                    path,
                    card.modified_at,
                    Some(card.card_type.as_str()),
                )
                .ok();
            }
        }

        Ok(card)
    }

    /// 更新卡片
    pub async fn update(
        &self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
        tags: Option<Vec<String>>,
        card_type: Option<CardType>,
        indexer: Option<&Mutex<Option<Indexer>>>,
    ) -> AppResult<Card> {
        if id.contains("..") {
            return Err(crate::error::AppError::InvalidInput("Invalid card ID".to_string()));
        }

        // 创建更新请求（links 将在 db.rs 的 update_card 中从 content 提取）
        let req = UpdateCardRequest {
            title: title.map(String::from),
            content: content.map(String::from),
            tags,
            card_type,
            aliases: None,
        };

        // 更新卡片（links 已在 db.rs 的 update_card 中从 content 提取）
        let mut card = self
            .card_repo
            .update(id, req)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Card not found".to_string()))?;

        // 生成虚拟路径
        if card.path.is_none() {
            card.path = Some(card.generate_path());
        }

        // 更新搜索索引
        if let Some(indexer) = indexer {
            if let Ok(Some(idx)) = indexer.lock().as_deref() {
                let path = card.path.as_ref().map(|p| p.as_str()).unwrap_or("");
                idx.index_doc_with_type(
                    &card.id,
                    &card.title,
                    &card.plain_text,
                    &card.tags,
                    path,
                    card.modified_at,
                    Some(card.card_type.as_str()),
                )
                .ok();
            }
        }

        Ok(card)
    }

    /// 删除卡片
    pub async fn delete(
        &self,
        id: &str,
        indexer: Option<&Mutex<Option<Indexer>>>,
    ) -> AppResult<()> {
        if id.contains("..") {
            return Err(crate::error::AppError::InvalidInput("Invalid card ID".to_string()));
        }

        self.card_repo.delete(id).await?;

        // 更新搜索索引
        if let Some(indexer) = indexer {
            if let Ok(Some(idx)) = indexer.lock().as_deref() {
                idx.delete_doc(id).ok();
            }
        }

        Ok(())
    }
}

// 辅助函数：从 TipTap JSON 中提取链接
fn extract_links_from_json(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    if let Ok(json) = serde_json::from_str::<JsonValue>(content) {
        extract_links_recursive(&json, &mut links);
    }
    links
}

fn extract_links_recursive(node: &JsonValue, links: &mut Vec<String>) {
    if let Some(obj) = node.as_object() {
        if let Some(node_type) = obj.get("type").and_then(|t| t.as_str()) {
            if node_type == "wikiLink" {
                if let Some(attrs) = obj.get("attrs").and_then(|a| a.as_object()) {
                    if let Some(href) = attrs.get("href").and_then(|h| h.as_str()) {
                        if !href.is_empty() && !links.contains(&href.to_string()) {
                            links.push(href.to_string());
                        }
                    }
                }
            }
        }

        if let Some(content) = obj.get("content").and_then(|c| c.as_array()) {
            for child in content {
                extract_links_recursive(child, links);
            }
        }
    }
}


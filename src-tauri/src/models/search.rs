//! 搜索相关模型

use super::CardType;
use serde::{Deserialize, Serialize};

/// 搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardSearchResult {
    pub id: String,
    pub title: String,
    pub score: f32,
    pub snippet: Option<String>,
    #[serde(rename = "type")]
    pub card_type: CardType,
    pub tags: Vec<String>,
}

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub theme: String,
    pub font_size: i32,
}


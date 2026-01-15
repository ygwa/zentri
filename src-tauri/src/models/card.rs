//! 卡片相关模型

use serde::{Deserialize, Serialize};

/// 卡片类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardType {
    Fleeting,
    Literature,
    Permanent,
    Project,
    Canvas,
}

impl Default for CardType {
    fn default() -> Self {
        CardType::Fleeting
    }
}

impl CardType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardType::Fleeting => "fleeting",
            CardType::Literature => "literature",
            CardType::Permanent => "permanent",
            CardType::Project => "project",
            CardType::Canvas => "canvas",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "fleeting" => CardType::Fleeting,
            "literature" => CardType::Literature,
            "permanent" => CardType::Permanent,
            "project" => CardType::Project,
            "canvas" => CardType::Canvas,
            _ => CardType::Fleeting,
        }
    }
}

/// Markdown 文件的 Frontmatter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Frontmatter {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, rename = "type")]
    pub card_type: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub modified: Option<String>,
    #[serde(default)]
    pub source_id: Option<String>,
}

/// 创建卡片请求
#[derive(Debug, Clone)]
pub struct CreateCardRequest {
    pub id: Option<String>, // 可选的自定义 ID（用于 daily note 等）
    pub title: String,
    pub card_type: CardType,
    pub content: String,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub source_id: Option<String>,
}

/// 更新卡片请求
#[derive(Debug, Clone)]
pub struct UpdateCardRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub card_type: Option<CardType>,
    pub aliases: Option<Vec<String>>,
}

/// 卡片数据 (传给前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    /// 虚拟路径（基于 id 和 type 生成，用于前端兼容）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub title: String,
    pub tags: Vec<String>,
    #[serde(rename = "type")]
    pub card_type: CardType,
    /// TipTap JSON 内容 (序列化后的字符串)
    pub content: String,
    /// 纯文本内容 (用于搜索索引)
    #[serde(default)]
    pub plain_text: String,
    pub preview: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub source_id: Option<String>,
}

impl Card {
    /// 生成虚拟路径（用于前端兼容）
    pub fn generate_path(&self) -> String {
        let type_dir = match self.card_type {
            CardType::Fleeting => "00_Inbox",
            CardType::Literature => "10_Literature",
            CardType::Permanent => "20_Slipbox",
            CardType::Project => "30_Projects",
            CardType::Canvas => "40_Canvases",
        };
        format!("cards/{}/{}.json", type_dir, self.id)
    }
}

/// 卡片列表项 (不含完整内容)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardListItem {
    pub id: String,
    pub path: String,
    pub title: String,
    pub tags: Vec<String>,
    #[serde(rename = "type")]
    pub card_type: CardType,
    pub preview: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub source_id: Option<String>,
}

impl From<Card> for CardListItem {
    fn from(mut card: Card) -> Self {
        let path = card.path.take().unwrap_or_else(|| card.generate_path());
        CardListItem {
            id: card.id,
            path,
            title: card.title,
            tags: card.tags,
            card_type: card.card_type,
            preview: card.preview,
            created_at: card.created_at,
            modified_at: card.modified_at,
            aliases: card.aliases,
            links: card.links,
            source_id: card.source_id,
        }
    }
}

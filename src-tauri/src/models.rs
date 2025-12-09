use serde::{Deserialize, Serialize};

/// 卡片类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardType {
    Fleeting,
    Literature,
    Permanent,
    Project,
}

impl Default for CardType {
    fn default() -> Self {
        CardType::Fleeting
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
}

/// 卡片数据 (传给前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub path: String,
    pub title: String,
    pub tags: Vec<String>,
    #[serde(rename = "type")]
    pub card_type: CardType,
    pub content: String,
    pub preview: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub is_processed: bool,
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
    pub is_processed: bool,
}

impl From<Card> for CardListItem {
    fn from(card: Card) -> Self {
        CardListItem {
            id: card.id,
            path: card.path,
            title: card.title,
            tags: card.tags,
            card_type: card.card_type,
            preview: card.preview,
            created_at: card.created_at,
            modified_at: card.modified_at,
            aliases: card.aliases,
            links: card.links,
            is_processed: card.is_processed,
        }
    }
}


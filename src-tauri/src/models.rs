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

impl CardType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardType::Fleeting => "fleeting",
            CardType::Literature => "literature",
            CardType::Permanent => "permanent",
            CardType::Project => "project",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "fleeting" => CardType::Fleeting,
            "literature" => CardType::Literature,
            "permanent" => CardType::Permanent,
            "project" => CardType::Project,
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
    pub source_id: Option<String>,
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
            source_id: card.source_id,
        }
    }
}

// ==================== 文献库类型 ====================

/// 文献源类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Book,
    Article,
    Webpage,
    Video,
    Podcast,
    Paper,
}

impl Default for SourceType {
    fn default() -> Self {
        SourceType::Book
    }
}

impl SourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SourceType::Book => "book",
            SourceType::Article => "article",
            SourceType::Webpage => "webpage",
            SourceType::Video => "video",
            SourceType::Podcast => "podcast",
            SourceType::Paper => "paper",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "book" => SourceType::Book,
            "article" => SourceType::Article,
            "webpage" => SourceType::Webpage,
            "video" => SourceType::Video,
            "podcast" => SourceType::Podcast,
            "paper" => SourceType::Paper,
            _ => SourceType::Book,
        }
    }
}

/// 文献源元数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SourceMetadata {
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub publish_date: Option<String>,
    pub page_count: Option<i32>,
    pub duration: Option<i32>, // 视频/播客时长（秒）
}

/// 文献源
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: String,
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub title: String,
    pub author: Option<String>,
    pub url: Option<String>,
    pub cover: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub progress: i32,
    pub last_read_at: Option<i64>,
    pub metadata: Option<SourceMetadata>,
    pub note_ids: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 创建文献源的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSourceRequest {
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub title: String,
    pub author: Option<String>,
    pub url: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
}

/// 更新文献源的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSourceRequest {
    pub title: Option<String>,
    pub author: Option<String>,
    pub url: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress: Option<i32>,
    pub last_read_at: Option<i64>,
}

/// 高亮位置信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HighlightPosition {
    pub page: Option<i32>,
    pub chapter: Option<String>,
    pub start_offset: Option<String>, // CFI for EPUB
    pub end_offset: Option<String>,
}

/// 高亮摘录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub source_id: String,
    pub card_id: Option<String>,
    pub content: String,
    pub note: Option<String>,
    pub position: Option<HighlightPosition>,
    pub color: Option<String>,
    pub created_at: i64,
}

/// 创建高亮的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHighlightRequest {
    pub source_id: String,
    pub card_id: Option<String>,
    pub content: String,
    pub note: Option<String>,
    pub position: Option<HighlightPosition>,
    pub color: Option<String>,
}

// ==================== 应用状态 ====================

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub theme: String,
    pub font_size: i32,
}


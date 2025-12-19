//! 文献源相关模型

use serde::{Deserialize, Serialize};

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
    pub duration: Option<i32>,
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
    pub cover: Option<String>,
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
    pub cover: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress: Option<i32>,
    pub last_read_at: Option<i64>,
}


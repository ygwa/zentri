//! 高亮相关模型

use serde::{Deserialize, Serialize};

/// 高亮位置信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HighlightPosition {
    pub page: Option<i32>,
    pub chapter: Option<String>,
    pub start_offset: Option<String>,
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


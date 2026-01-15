//! 高亮相关模型

use serde::{Deserialize, Serialize};

/// PDF 矩形坐标（用于精确定位高亮位置）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PdfRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// 高亮位置信息（支持 PDF 和 EPUB 两种格式）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HighlightPosition {
    // 通用字段
    pub page: Option<i32>,
    pub chapter: Option<String>,
    pub start_offset: Option<String>,
    pub end_offset: Option<String>,
    
    // EPUB 专用 - CFI (Canonical Fragment Identifier)
    pub cfi: Option<String>,
    
    // PDF 专用 - 精确坐标
    pub rects: Option<Vec<PdfRect>>,
    
    // 网页专用 - XPath/CSS 选择器
    pub selector: Option<String>,
    pub text_offset: Option<i32>,
}

/// 标注类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AnnotationType {
    Highlight,
    Underline,
    Strikethrough,
}

impl Default for AnnotationType {
    fn default() -> Self {
        AnnotationType::Highlight
    }
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
    #[serde(rename = "type")]
    pub annotation_type: Option<AnnotationType>, // 标注类型：高亮、下划线、删除线（默认为 highlight）
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
    #[serde(rename = "type")]
    pub annotation_type: Option<AnnotationType>,
    pub position: Option<HighlightPosition>,
    pub color: Option<String>,
}

/// 更新高亮的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHighlightRequest {
    pub note: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub annotation_type: Option<AnnotationType>,
    pub card_id: Option<String>,
}


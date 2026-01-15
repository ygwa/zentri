//! 书签相关模型

use serde::{Deserialize, Serialize};

/// 书签
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub source_id: String,
    pub position: String, // CFI 或等效位置标识
    pub label: Option<String>, // 书签标签（可选）
    pub note: Option<String>, // 书签备注（可选）
    pub created_at: i64,
}

/// 创建书签的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookmarkRequest {
    pub source_id: String,
    pub position: String, // CFI 或等效位置标识
    pub label: Option<String>,
    pub note: Option<String>,
}

/// 更新书签的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookmarkRequest {
    pub label: Option<String>,
    pub note: Option<String>,
    pub position: Option<String>,
}





use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Canvas {
    pub id: String,
    pub title: String,
    /// React Flow Nodes
    pub nodes: Value,
    /// React Flow Edges
    pub edges: Value,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasListItem {
    pub id: String,
    pub title: String,
    pub updated_at: i64,
}

impl From<Canvas> for CanvasListItem {
    fn from(canvas: Canvas) -> Self {
        CanvasListItem {
            id: canvas.id,
            title: canvas.title,
            updated_at: canvas.updated_at,
        }
    }
}

//! 向量化模块
//! 使用 llama-server 的 embedding 接口进行文本向量化

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EmbeddingError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Invalid response: {0}")]
    InvalidResponse(String),
    #[error("Server not available")]
    ServerNotAvailable,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmbeddingRequest {
    input: Vec<String>,
    model: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
    model: String,
    usage: EmbeddingUsage,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmbeddingUsage {
    prompt_tokens: usize,
    total_tokens: usize,
}

/// 向量化器
pub struct EmbeddingService {
    base_url: String,
    model: String,
}

impl EmbeddingService {
    pub fn new(port: u16) -> Self {
        Self {
            base_url: format!("http://127.0.0.1:{}", port),
            model: "text-embedding".to_string(), // llama-server 的默认 embedding 模型名
        }
    }

    /// 对单个文本进行向量化
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>, EmbeddingError> {
        let embeddings = self.embed_batch(&[text.to_string()]).await?;
        Ok(embeddings.into_iter().next().unwrap_or_default())
    }

    /// 批量向量化
    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, EmbeddingError> {
        let client = reqwest::Client::new();
        let url = format!("{}/v1/embeddings", self.base_url);

        let request = EmbeddingRequest {
            input: texts.to_vec(),
            model: self.model.clone(),
        };

        let response = client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| EmbeddingError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(EmbeddingError::InvalidResponse(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        let embedding_response: EmbeddingResponse = response
            .json()
            .await
            .map_err(|e| EmbeddingError::InvalidResponse(e.to_string()))?;

        Ok(embedding_response
            .data
            .into_iter()
            .map(|d| d.embedding)
            .collect())
    }

    /// 计算余弦相似度
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a * norm_b)
    }
}





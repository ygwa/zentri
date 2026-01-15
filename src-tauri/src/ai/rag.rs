//! RAG (检索增强生成) 模块
//! 实现向量索引、相似度搜索和 RAG Prompt 构建

use crate::ai::embeddings::{EmbeddingService, EmbeddingError};
use crate::db::Database;
use sqlx::Row;
use std::fs;
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RAGError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Embedding error: {0}")]
    Embedding(#[from] EmbeddingError),
    #[error("Source not found: {0}")]
    SourceNotFound(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
}

/// RAG 服务
pub struct RAGService {
    db: Arc<Database>,
    embedding_service: EmbeddingService,
    vault_path: Option<std::path::PathBuf>,
}

impl RAGService {
    pub fn new(db: Arc<Database>, embedding_port: u16, vault_path: Option<std::path::PathBuf>) -> Self {
        Self {
            db,
            embedding_service: EmbeddingService::new(embedding_port),
            vault_path,
        }
    }

    /// 索引文献源内容
    pub async fn index_source(&self, source_id: &str, content: &str) -> Result<(), RAGError> {
        // 将内容分块（简单实现：按段落分割）
        let chunks = Self::chunk_text(content, 500); // 每块约 500 字符

        for (index, chunk) in chunks.iter().enumerate() {
            // 向量化
            let embedding = self.embedding_service.embed(chunk).await?;

            // 存储到数据库
            self.store_embedding(source_id, index, chunk, &embedding).await?;
        }

        Ok(())
    }

    /// 相似度搜索
    pub async fn search_similar(
        &self,
        query: &str,
        limit: usize,
        source_id: Option<&str>,
    ) -> Result<Vec<SearchResult>, RAGError> {
        // 向量化查询
        let query_embedding = self.embedding_service.embed(query).await?;

        // 从数据库检索元数据（异步）
        let pool = self.db.pool();
        let rows = if let Some(sid) = source_id {
            sqlx::query(
                "SELECT id, source_id, content, vector FROM embeddings WHERE source_id = ? ORDER BY id"
            )
            .bind(sid)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query(
                "SELECT id, source_id, content, vector FROM embeddings ORDER BY id"
            )
            .fetch_all(pool)
            .await?
        };
        
        // 处理结果并计算相似度
        let mut search_results = Vec::new();
        for row in rows {
            let id: String = row.get(0);
            let source_id: String = row.get(1);
            let content: String = row.get(2);
            let vector_bytes_db: Vec<u8> = row.get(3);
            
            // 从文件系统读取向量，如果不存在则使用数据库中的（向后兼容）
            let stored_embedding: Vec<f32> = if let Some(ref vault_path) = self.vault_path {
                let embedding_file = vault_path.join("derived").join("embeddings").join(format!("{}.bin", id));
                if embedding_file.exists() {
                    let vector_bytes = fs::read(&embedding_file)
                        .map_err(|e| RAGError::Serialization(format!("Failed to read embedding file: {}", e)))?;
                    bincode::deserialize(&vector_bytes)
                        .map_err(|e| RAGError::Serialization(format!("Failed to deserialize vector: {}", e)))?
                } else if !vector_bytes_db.is_empty() {
                    // 向后兼容：从数据库读取（旧数据）
                    bincode::deserialize(&vector_bytes_db)
                        .map_err(|e| RAGError::Serialization(format!("Failed to deserialize vector: {}", e)))?
                } else {
                    continue; // 跳过没有向量的记录
                }
            } else {
                // 没有 vault_path，从数据库读取（向后兼容）
                if vector_bytes_db.is_empty() {
                    continue; // 跳过没有向量的记录
                }
                bincode::deserialize(&vector_bytes_db)
                    .map_err(|e| RAGError::Serialization(format!("Failed to deserialize vector: {}", e)))?
            };

            // 计算相似度
            let similarity = EmbeddingService::cosine_similarity(&query_embedding, &stored_embedding);

            search_results.push(SearchResult {
                id,
                source_id,
                content,
                similarity,
            });
        }

        // 按相似度排序并取前 limit 个
        search_results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
        search_results.truncate(limit);

        Ok(search_results)
    }

    /// 构建 RAG Prompt
    pub fn build_rag_prompt(query: &str, context: Vec<SearchResult>) -> String {
        let mut prompt = String::from("你是一个知识助手。请基于以下上下文回答用户的问题。\n\n");
        prompt.push_str("上下文：\n");
        
        for (i, result) in context.iter().enumerate() {
            prompt.push_str(&format!("[{}] {}\n", i + 1, result.content));
        }
        
        prompt.push_str("\n问题：");
        prompt.push_str(query);
        prompt.push_str("\n\n请基于上下文提供准确、详细的回答。如果上下文中没有相关信息，请说明。");

        prompt
    }

    /// 存储向量到文件系统（异步）
    pub async fn store_embedding(
        &self,
        source_id: &str,
        chunk_index: usize,
        content: &str,
        embedding: &[f32],
    ) -> Result<(), RAGError> {
        let id = format!("{}_{}", source_id, chunk_index);
        
        // 如果有 vault_path，保存到文件系统
        if let Some(ref vault_path) = self.vault_path {
            let embeddings_dir = vault_path.join("derived").join("embeddings");
            fs::create_dir_all(&embeddings_dir)
                .map_err(|e| RAGError::Serialization(format!("Failed to create embeddings directory: {}", e)))?;
            
            // 保存向量到文件
            let embedding_file = embeddings_dir.join(format!("{}.bin", id));
            let vector_bytes = bincode::serialize(embedding)
                .map_err(|e| RAGError::Serialization(format!("Failed to serialize embedding: {}", e)))?;
            fs::write(&embedding_file, &vector_bytes)
                .map_err(|e| RAGError::Serialization(format!("Failed to write embedding file: {}", e)))?;
            
            // 保存内容到文本文件（用于调试和检索）
            let content_file = embeddings_dir.join(format!("{}.txt", id));
            fs::write(&content_file, content)
                .map_err(|e| RAGError::Serialization(format!("Failed to write content file: {}", e)))?;
        }
        
        // 在数据库中保存元数据（引用文件路径）
        // 如果 vault_path 不存在，仍然保存到数据库（向后兼容）
        let vector_bytes = if self.vault_path.is_none() {
            bincode::serialize(embedding)
                .map_err(|e| RAGError::Serialization(format!("Failed to serialize embedding: {}", e)))?
        } else {
            Vec::new() // vector 存储在文件系统中，这里留空
        };
        
        sqlx::query(
            "INSERT OR REPLACE INTO embeddings (id, source_id, content, vector) 
             VALUES (?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(source_id)
        .bind(content)
        .bind(&vector_bytes)
        .execute(self.db.pool())
        .await?;

        Ok(())
    }

    /// 文本分块（简单实现）
    fn chunk_text(text: &str, chunk_size: usize) -> Vec<String> {
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();

        for paragraph in text.split("\n\n") {
            if current_chunk.len() + paragraph.len() > chunk_size && !current_chunk.is_empty() {
                chunks.push(current_chunk.trim().to_string());
                current_chunk = String::new();
            }
            if !current_chunk.is_empty() {
                current_chunk.push_str("\n\n");
            }
            current_chunk.push_str(paragraph);
        }

        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk.trim().to_string());
        }

        chunks
    }
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub id: String,
    pub source_id: String,
    pub content: String,
    pub similarity: f32,
}


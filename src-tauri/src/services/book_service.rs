//! Book 应用服务层
//! 封装 Book 处理相关的业务逻辑

use crate::book_processor::BookProcessor;
use crate::db::Database;
use crate::models::Source;
use crate::state::AppState;
use std::path::PathBuf;
use std::sync::Arc;

/// Book 应用服务
pub struct BookService {
    db: Arc<Database>,
}

impl BookService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 导入书籍
    pub fn import_book(&self, file_path: &PathBuf, state: &AppState) -> Result<Source, String> {
        if !file_path.exists() {
            return Err(format!("File not found: {}", file_path.display()));
        }

        // 检查文件类型
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "epub" => BookProcessor::import_book(file_path, state)
                .map_err(|e| format!("Failed to import book: {}", e)),
            "pdf" => Err("PDF import not yet implemented".to_string()),
            _ => Err(format!("Unsupported file type: {}", ext)),
        }
    }

    /// 获取章节内容
    pub async fn get_chapter_content(
        &self,
        source_id: &str,
        chapter_href: &str,
        vault_path: &PathBuf,
    ) -> Result<String, String> {
        // 获取 source 信息
        let source = self
            .db
            .get_source(source_id)
            .await
            .map_err(|e| format!("Failed to get source: {}", e))?
            .ok_or_else(|| format!("Source not found: {}", source_id))?;

        let url = source
            .url
            .ok_or_else(|| "Source URL not found".to_string())?;

        // 获取完整文件路径
        let book_path = vault_path.join(&url);

        if !book_path.exists() {
            return Err(format!("Book file not found: {}", url));
        }

        // 提取章节内容
        BookProcessor::extract_chapter_content(&book_path, chapter_href)
            .map_err(|e| format!("Failed to extract chapter: {}", e))
    }
}


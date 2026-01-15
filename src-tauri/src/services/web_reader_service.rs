//! WebReader 应用服务层
//! 封装网页阅读器相关的业务逻辑

use crate::database::WebSnapshotRepository;
use crate::web_reader::{self, FetchResult, WebSnapshot, WebpageMetadata};
use std::sync::Arc;
use uuid::Uuid;

/// WebReader 应用服务
pub struct WebReaderService {
    repo: Arc<WebSnapshotRepository>,
}

impl WebReaderService {
    pub fn new(repo: Arc<WebSnapshotRepository>) -> Self {
        Self { repo }
    }

    /// 抓取并清洗网页（完整内容）
    pub fn fetch_webpage(&self, url: &str) -> Result<FetchResult, String> {
        web_reader::fetch_and_clean(url).map_err(|e| e.to_string())
    }

    /// 快速获取网页元数据（用于表单自动填充）
    pub fn fetch_metadata(&self, url: &str) -> Result<WebpageMetadata, String> {
        web_reader::fetch_webpage_metadata(url).map_err(|e| e.to_string())
    }

    /// 保存网页快照
    pub async fn save_snapshot(
        &self,
        source_id: &str,
        url: &str,
        fetch_result: FetchResult,
    ) -> Result<WebSnapshot, String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        let snapshot = WebSnapshot {
            id: Uuid::new_v4().to_string(),
            source_id: source_id.to_string(),
            original_url: url.to_string(),
            title: fetch_result.title,
            author: fetch_result.author,
            site_name: fetch_result.site_name,
            content: fetch_result.content,
            text_content: fetch_result.text_content,
            excerpt: fetch_result.excerpt,
            created_at: now,
        };

        // 保存到数据库
        self.repo
            .save(&snapshot)
            .await
            .map_err(|e| e.to_string())?;

        Ok(snapshot)
    }

    /// 获取网页快照
    pub async fn get_snapshot(&self, source_id: &str) -> Result<Option<WebSnapshot>, String> {
        self.repo.get_by_source(source_id).await.map_err(|e| e.to_string())
    }

    /// 将网页内容转换为 Markdown
    pub fn convert_to_markdown(&self, html: &str) -> String {
        web_reader::html_to_markdown(html)
    }
}


//! Bookmark 应用服务层
//! 封装 Bookmark 相关的业务逻辑

use crate::database::BookmarkRepository;
use crate::error::AppResult;
use crate::models::{Bookmark, CreateBookmarkRequest, UpdateBookmarkRequest};
use std::sync::Arc;

/// Bookmark 应用服务
pub struct BookmarkService {
    repo: Arc<BookmarkRepository>,
}

impl BookmarkService {
    pub fn new(repo: Arc<BookmarkRepository>) -> Self {
        Self { repo }
    }

    /// 创建书签
    pub async fn create(&self, req: CreateBookmarkRequest) -> AppResult<Bookmark> {
        self.repo.create(req).await
    }

    /// 获取文献源的所有书签
    pub async fn get_by_source(&self, source_id: &str) -> AppResult<Vec<Bookmark>> {
        self.repo.get_by_source(source_id).await
    }

    /// 获取所有书签
    pub async fn get_all(&self) -> AppResult<Vec<Bookmark>> {
        self.repo.get_all().await
    }

    /// 获取单个书签
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Bookmark>> {
        self.repo.get_by_id(id).await
    }

    /// 更新书签
    pub async fn update(&self, id: &str, req: UpdateBookmarkRequest) -> AppResult<Option<Bookmark>> {
        self.repo.update(id, req).await
    }

    /// 删除书签
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.repo.delete(id).await
    }
}


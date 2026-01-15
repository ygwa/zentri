//! Bookmark 数据访问层

use crate::db::Database;
use crate::error::AppResult;
use crate::models::{Bookmark, CreateBookmarkRequest, UpdateBookmarkRequest};
use std::sync::Arc;

/// Bookmark 数据访问层
pub struct BookmarkRepository {
    db: Arc<Database>,
}

impl BookmarkRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 创建书签
    pub async fn create(&self, req: CreateBookmarkRequest) -> AppResult<Bookmark> {
        self.db.create_bookmark(req).await
    }

    /// 获取文献源的所有书签
    pub async fn get_by_source(&self, source_id: &str) -> AppResult<Vec<Bookmark>> {
        self.db.get_bookmarks_by_source(source_id).await
    }

    /// 获取所有书签
    pub async fn get_all(&self) -> AppResult<Vec<Bookmark>> {
        self.db.get_all_bookmarks().await
    }

    /// 获取单个书签
    pub async fn get_by_id(&self, id: &str) -> AppResult<Option<Bookmark>> {
        self.db.get_bookmark(id).await
    }

    /// 更新书签
    pub async fn update(&self, id: &str, req: UpdateBookmarkRequest) -> AppResult<Option<Bookmark>> {
        self.db.update_bookmark(id, req).await
    }

    /// 删除书签
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.db.delete_bookmark(id).await
    }
}

impl crate::database::Repository for BookmarkRepository {
    fn db(&self) -> &Arc<Database> {
        &self.db
    }
}


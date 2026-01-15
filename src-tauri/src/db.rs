//! SQLx 数据库模块
//! 使用 SQLx 提供类型安全的数据库操作

use crate::commands::highlights::SourceBacklink;
use crate::error::AppResult;
use crate::models::{
    Bookmark, Card, CardType, CreateBookmarkRequest, CreateCardRequest, CreateHighlightRequest,
    CreateSourceRequest, Highlight, HighlightPosition, Source, SourceMetadata, SourceType,
    UpdateBookmarkRequest, UpdateCardRequest, UpdateHighlightRequest, UpdateSourceRequest,
};
use crate::web_reader::WebSnapshot;
use chrono::Utc;
use sqlx::{sqlite::{SqlitePool, SqliteConnectOptions}, Row};
use std::path::Path;
use uuid::Uuid;

/// 数据库管理器
/// 使用 SQLx 提供类型安全的异步数据库操作
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// 获取数据库连接池的引用（用于直接执行 SQL 查询）
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// 打开或创建数据库
    pub async fn open(db_path: &Path) -> AppResult<Self> {
        // 确保目录存在
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // 创建数据库连接池
        // 确保使用绝对路径（SQLite 需要绝对路径来处理包含非 ASCII 字符的路径）
        let absolute_path = if db_path.is_absolute() {
            db_path.to_path_buf()
        } else {
            std::env::current_dir()
                .map(|cwd| cwd.join(db_path))
                .unwrap_or_else(|_| db_path.to_path_buf())
        };
        
        // 使用 SqliteConnectOptions 直接设置路径，这样可以更好地处理包含非 ASCII 字符的路径
        // 这是 SQLx 推荐的方式，可以避免连接字符串解析的问题
        let connect_options = SqliteConnectOptions::new()
            .filename(&absolute_path)
            .create_if_missing(true);
        
        // 创建连接池
        let pool = SqlitePool::connect_with(connect_options).await?;

        // 启用外键约束
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await?;

        let db = Database { pool };
        
        // 直接尝试检查一个关键表，如果失败就初始化所有表
        let schema_complete = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('sources', 'highlights', 'cards')"
        )
        .fetch_one(&db.pool)
        .await
        .unwrap_or(0);
        
        // 如果关键表不存在或数量不足，重新初始化架构
        if schema_complete < 3 {
            eprintln!("Database schema incomplete (found {} tables), initializing...", schema_complete);
            db.initialize_schema().await?;
        }
        
        Ok(db)
    }

    /// 初始化数据库架构（全新创建所有表）
    async fn initialize_schema(&self) -> AppResult<()> {
        // 运行所有迁移文件
        let migration_files = vec![
            ("001_initial_schema.sql", include_str!("../migrations/001_initial_schema.sql")),
            ("002_add_bookmarks.sql", include_str!("../migrations/002_add_bookmarks.sql")),
            ("002_add_highlight_type.sql", include_str!("../migrations/002_add_highlight_type.sql")),
            ("003_add_vectors.sql", include_str!("../migrations/003_add_vectors.sql")),
            ("004_add_cards.sql", include_str!("../migrations/004_add_cards.sql")),
        ];
        
        for (filename, migration_sql) in migration_files {
            eprintln!("Running migration: {}", filename);
            
            let statements: Vec<&str> = migration_sql
                .split(';')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty() && !s.starts_with("--"))
                .collect();
            
            // 执行所有语句
            for statement in statements {
                if statement.is_empty() {
                    continue;
                }
                
                sqlx::query(statement).execute(&self.pool).await
                    .map_err(|e| {
                        eprintln!("Failed to execute SQL statement from {}: {}\nError: {}", filename, statement, e);
                        e
                    })?;
            }
        }
        
        Ok(())
    }

    /// 创建所有索引
    async fn create_indexes(&self) -> AppResult<()> {
        let indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_highlights_source_id ON highlights(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_highlights_card_id ON highlights(card_id)",
            "CREATE INDEX IF NOT EXISTS idx_bookmarks_source_id ON bookmarks(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON embeddings(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_web_snapshots_source_id ON web_snapshots(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type)",
            "CREATE INDEX IF NOT EXISTS idx_sources_updated_at ON sources(updated_at)",
            "CREATE INDEX IF NOT EXISTS idx_sources_created_at ON sources(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_highlights_created_at ON highlights(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_highlights_type ON highlights(type)",
            "CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type)",
            "CREATE INDEX IF NOT EXISTS idx_cards_source_id ON cards(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_cards_updated_at ON cards(updated_at)",
            "CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_cards_title ON cards(title)",
        ];

        for index_sql in indexes {
            sqlx::query(index_sql).execute(&self.pool).await?;
        }

        Ok(())
    }

    // ==================== Source 操作 ====================

    /// 创建文献源
    pub async fn create_source(&self, req: CreateSourceRequest) -> AppResult<Source> {
        let now = Utc::now().timestamp_millis();
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO sources (id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(req.source_type.as_str())
        .bind(&req.title)
        .bind(req.author.as_ref())
        .bind(req.url.as_ref())
        .bind(req.cover.as_ref())
        .bind(req.description.as_ref())
        .bind(serde_json::to_string(&req.tags)?)
        .bind(0i32)
        .bind(None::<i64>)
        .bind(None::<String>)
        .bind(serde_json::to_string(&Vec::<String>::new())?)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(Source {
            id,
            source_type: req.source_type,
            title: req.title,
            author: req.author,
            url: req.url,
            cover: req.cover,
            description: req.description,
            tags: req.tags,
            progress: 0,
            last_read_at: None,
            metadata: None,
            note_ids: vec![],
            created_at: now,
            updated_at: now,
        })
    }

    /// 获取所有文献源
    pub async fn get_all_sources(&self) -> AppResult<Vec<Source>> {
        let rows = sqlx::query(
            "SELECT id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at 
             FROM sources ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut sources = Vec::new();
        for row in rows {
            sources.push(self.row_to_source(row)?);
        }

        Ok(sources)
    }

    /// 分页获取文献源
    pub async fn get_sources_paginated(&self, offset: usize, limit: usize) -> AppResult<Vec<Source>> {
        let rows = sqlx::query(
            "SELECT id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at 
             FROM sources ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await?;

        let mut sources = Vec::new();
        for row in rows {
            sources.push(self.row_to_source(row)?);
        }

        Ok(sources)
    }

    /// 获取文献源总数
    pub async fn get_sources_count(&self) -> AppResult<usize> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sources")
            .fetch_one(&self.pool)
            .await?;
        Ok(count as usize)
    }

    /// 获取单个文献源
    pub async fn get_source(&self, id: &str) -> AppResult<Option<Source>> {
        let row = sqlx::query(
            "SELECT id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at 
             FROM sources WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(self.row_to_source(row)?))
        } else {
            Ok(None)
        }
    }

    /// 更新文献源
    pub async fn update_source(&self, id: &str, req: UpdateSourceRequest) -> AppResult<Option<Source>> {
        let now = Utc::now().timestamp_millis();

        // 使用 COALESCE 实现可选更新
        let tags_json = req.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
        
        sqlx::query(
            "UPDATE sources SET 
                title = COALESCE(?, title),
                author = COALESCE(?, author),
                url = COALESCE(?, url),
                cover = COALESCE(?, cover),
                description = COALESCE(?, description),
                progress = COALESCE(?, progress),
                last_read_at = COALESCE(?, last_read_at),
                tags = COALESCE(?, tags),
                updated_at = ?
             WHERE id = ?",
        )
        .bind(req.title.as_ref())
        .bind(req.author.as_ref())
        .bind(req.url.as_ref())
        .bind(req.cover.as_ref())
        .bind(req.description.as_ref())
        .bind(req.progress)
        .bind(req.last_read_at)
        .bind(tags_json.as_ref())
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        // 如果有 metadata 更新，需要合并现有 metadata
        if let Some(new_metadata) = req.metadata {
            // 获取现有 metadata
            let row = sqlx::query("SELECT metadata FROM sources WHERE id = ?")
                .bind(id)
                .fetch_optional(&self.pool)
                .await?;
            
            let mut existing_metadata = if let Some(row) = row {
                let metadata_str: Option<String> = row.get(0);
                metadata_str
                    .and_then(|s| serde_json::from_str::<crate::models::SourceMetadata>(&s).ok())
                    .unwrap_or_default()
            } else {
                crate::models::SourceMetadata::default()
            };
            
            // 合并 metadata（新值覆盖旧值）
            if new_metadata.isbn.is_some() {
                existing_metadata.isbn = new_metadata.isbn;
            }
            if new_metadata.publisher.is_some() {
                existing_metadata.publisher = new_metadata.publisher;
            }
            if new_metadata.publish_date.is_some() {
                existing_metadata.publish_date = new_metadata.publish_date;
            }
            if new_metadata.page_count.is_some() {
                existing_metadata.page_count = new_metadata.page_count;
            }
            if new_metadata.duration.is_some() {
                existing_metadata.duration = new_metadata.duration;
            }
            if new_metadata.last_page.is_some() {
                existing_metadata.last_page = new_metadata.last_page;
            }
            if new_metadata.last_cfi.is_some() {
                existing_metadata.last_cfi = new_metadata.last_cfi;
            }
            
            sqlx::query("UPDATE sources SET metadata = ? WHERE id = ?")
                .bind(serde_json::to_string(&existing_metadata).ok())
                .bind(id)
                .execute(&self.pool)
                .await?;
        }

        self.get_source(id).await
    }

    /// 删除文献源
    pub async fn delete_source(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM sources WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// 添加笔记 ID 到文献源
    pub async fn add_note_to_source(&self, source_id: &str, note_id: &str) -> AppResult<()> {
        let now = Utc::now().timestamp_millis();

        // 获取当前 note_ids
        let row = sqlx::query("SELECT note_ids FROM sources WHERE id = ?")
            .bind(source_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            let note_ids_str: String = row.get(0);
            let mut note_ids: Vec<String> = serde_json::from_str(&note_ids_str).unwrap_or_default();

            if !note_ids.contains(&note_id.to_string()) {
                note_ids.push(note_id.to_string());
                sqlx::query("UPDATE sources SET note_ids = ?, updated_at = ? WHERE id = ?")
                    .bind(serde_json::to_string(&note_ids)?)
                    .bind(now)
                    .bind(source_id)
                    .execute(&self.pool)
                    .await?;
            }
        }

        Ok(())
    }

    /// 将数据库行转换为 Source
    fn row_to_source(&self, row: sqlx::sqlite::SqliteRow) -> AppResult<Source> {
        let tags_str: String = row.get(7);
        let metadata_str: Option<String> = row.get(10);
        let note_ids_str: String = row.get(11);

        Ok(Source {
            id: row.get(0),
            source_type: SourceType::from_str(&row.get::<String, _>(1)),
            title: row.get(2),
            author: row.get(3),
            url: row.get(4),
            cover: row.get(5),
            description: row.get(6),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            progress: row.get(8),
            last_read_at: row.get(9),
            metadata: metadata_str.and_then(|s| serde_json::from_str::<SourceMetadata>(&s).ok()),
            note_ids: serde_json::from_str(&note_ids_str).unwrap_or_default(),
            created_at: row.get(12),
            updated_at: row.get(13),
        })
    }

    // ==================== Highlight 操作 ====================

    /// 创建高亮
    pub async fn create_highlight(&self, req: CreateHighlightRequest) -> AppResult<Highlight> {
        let now = Utc::now().timestamp_millis();
        let id = Uuid::new_v4().to_string();

        let type_str = req.annotation_type.as_ref().map(|t| match t {
            crate::models::AnnotationType::Highlight => "highlight",
            crate::models::AnnotationType::Underline => "underline",
            crate::models::AnnotationType::Strikethrough => "strikethrough",
        });

        sqlx::query(
            "INSERT INTO highlights (id, source_id, card_id, content, note, position, color, type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.source_id)
        .bind(req.card_id.as_ref())
        .bind(&req.content)
        .bind(req.note.as_ref())
        .bind(req.position.as_ref().map(|p| serde_json::to_string(p).unwrap_or_default()))
        .bind(req.color.as_ref())
        .bind(type_str)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(Highlight {
            id,
            source_id: req.source_id,
            card_id: req.card_id,
            content: req.content,
            note: req.note,
            annotation_type: req.annotation_type,
            position: req.position,
            color: req.color,
            created_at: now,
        })
    }

    /// 获取文献源的所有高亮
    pub async fn get_highlights_by_source(&self, source_id: &str) -> AppResult<Vec<Highlight>> {
        let rows = sqlx::query(
            "SELECT id, source_id, card_id, content, note, position, color, type, created_at 
             FROM highlights WHERE source_id = ? ORDER BY created_at DESC",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        let mut highlights = Vec::new();
        for row in rows {
            highlights.push(self.row_to_highlight(row)?);
        }

        Ok(highlights)
    }

    /// 获取所有高亮
    pub async fn get_all_highlights(&self) -> AppResult<Vec<Highlight>> {
        let rows = sqlx::query(
            "SELECT id, source_id, card_id, content, note, position, color, type, created_at 
             FROM highlights ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut highlights = Vec::new();
        for row in rows {
            highlights.push(self.row_to_highlight(row)?);
        }

        Ok(highlights)
    }

    /// 更新高亮
    pub async fn update_highlight(&self, id: &str, req: UpdateHighlightRequest) -> AppResult<Option<Highlight>> {
        let type_str = req.annotation_type.as_ref().map(|t| match t {
            crate::models::AnnotationType::Highlight => "highlight",
            crate::models::AnnotationType::Underline => "underline",
            crate::models::AnnotationType::Strikethrough => "strikethrough",
        });
        
        sqlx::query(
            "UPDATE highlights SET 
                note = COALESCE(?, note),
                color = COALESCE(?, color),
                type = COALESCE(?, type),
                card_id = COALESCE(?, card_id)
             WHERE id = ?",
        )
        .bind(req.note.as_ref())
        .bind(req.color.as_ref())
        .bind(type_str.as_ref())
        .bind(req.card_id.as_ref())
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_highlight(id).await
    }

    /// 获取单个高亮
    pub async fn get_highlight(&self, id: &str) -> AppResult<Option<Highlight>> {
        let row = sqlx::query(
            "SELECT id, source_id, card_id, content, note, position, color, type, created_at 
             FROM highlights WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(self.row_to_highlight(row)?))
        } else {
            Ok(None)
        }
    }

    /// 删除高亮
    pub async fn delete_highlight(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM highlights WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// 获取卡片关联的高亮
    pub async fn get_highlights_by_card(&self, card_id: &str) -> AppResult<Vec<Highlight>> {
        let rows = sqlx::query(
            "SELECT id, source_id, card_id, content, note, position, color, type, created_at 
             FROM highlights WHERE card_id = ? ORDER BY created_at DESC",
        )
        .bind(card_id)
        .fetch_all(&self.pool)
        .await?;

        let mut highlights = Vec::new();
        for row in rows {
            highlights.push(self.row_to_highlight(row)?);
        }

        Ok(highlights)
    }

    /// 获取引用该文献源的所有笔记（反向链接）
    pub async fn get_backlinks_for_source(&self, source_id: &str) -> AppResult<Vec<SourceBacklink>> {
        let rows = sqlx::query(
            "SELECT h.id, h.card_id, h.content, h.position
             FROM highlights h
             WHERE h.source_id = ? AND h.card_id IS NOT NULL
             ORDER BY h.created_at DESC",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        let mut backlinks = Vec::new();
        for row in rows {
            let position_str: Option<String> = row.get(3);
            let position: Option<HighlightPosition> =
                position_str.and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok());

            let card_id: Option<String> = row.get(1);
            backlinks.push(SourceBacklink {
                card_id: card_id.unwrap_or_default(),
                card_title: String::new(), // 需要从卡片存储获取
                highlight_id: row.get(0),
                highlight_content: row.get(2),
                page: position.as_ref().and_then(|p| p.page),
                cfi: position.as_ref().and_then(|p| p.cfi.clone()),
            });
        }

        Ok(backlinks)
    }

    /// 将数据库行转换为 Highlight
    fn row_to_highlight(&self, row: sqlx::sqlite::SqliteRow) -> AppResult<Highlight> {
        let position_str: Option<String> = row.get(5);
        let type_str: Option<String> = row.get(7);
        let annotation_type = type_str.and_then(|s| match s.as_str() {
            "underline" => Some(crate::models::AnnotationType::Underline),
            "strikethrough" => Some(crate::models::AnnotationType::Strikethrough),
            _ => Some(crate::models::AnnotationType::Highlight),
        });
        Ok(Highlight {
            id: row.get(0),
            source_id: row.get(1),
            card_id: row.get(2),
            content: row.get(3),
            note: row.get(4),
            annotation_type,
            position: position_str.and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok()),
            color: row.get(6),
            created_at: row.get(8),
        })
    }

    // ==================== WebSnapshot 操作 ====================

    /// 保存网页快照
    pub async fn save_web_snapshot(&self, snapshot: &WebSnapshot) -> AppResult<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO web_snapshots 
             (id, source_id, original_url, title, author, site_name, content, text_content, excerpt, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&snapshot.id)
        .bind(&snapshot.source_id)
        .bind(&snapshot.original_url)
        .bind(&snapshot.title)
        .bind(snapshot.author.as_ref())
        .bind(snapshot.site_name.as_ref())
        .bind(&snapshot.content)
        .bind(&snapshot.text_content)
        .bind(snapshot.excerpt.as_ref())
        .bind(snapshot.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 获取网页快照
    pub async fn get_web_snapshot(&self, source_id: &str) -> AppResult<Option<WebSnapshot>> {
        let row = sqlx::query(
            "SELECT id, source_id, original_url, title, author, site_name, content, text_content, excerpt, created_at 
             FROM web_snapshots WHERE source_id = ?",
        )
        .bind(source_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(WebSnapshot {
                id: row.get(0),
                source_id: row.get(1),
                original_url: row.get(2),
                title: row.get(3),
                author: row.get(4),
                site_name: row.get(5),
                content: row.get(6),
                text_content: row.get(7),
                excerpt: row.get(8),
                created_at: row.get(9),
            }))
        } else {
            Ok(None)
        }
    }

    /// 删除网页快照
    pub async fn delete_web_snapshot(&self, source_id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM web_snapshots WHERE source_id = ?")
            .bind(source_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// 保存网页快照元数据（不包含 content，用于文件系统存储）
    pub async fn save_web_snapshot_metadata(&self, snapshot: &WebSnapshot) -> AppResult<()> {
        // 保存时，content 字段存储文件路径引用或为空
        // text_content 仍然保存在数据库中用于搜索
        sqlx::query(
            "INSERT OR REPLACE INTO web_snapshots 
             (id, source_id, original_url, title, author, site_name, content, text_content, excerpt, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&snapshot.id)
        .bind(&snapshot.source_id)
        .bind(&snapshot.original_url)
        .bind(&snapshot.title)
        .bind(snapshot.author.as_ref())
        .bind(snapshot.site_name.as_ref())
        .bind("") // content 存储在文件系统中，这里留空或存储路径引用
        .bind(&snapshot.text_content)
        .bind(snapshot.excerpt.as_ref())
        .bind(snapshot.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 获取网页快照元数据（不包含 content）
    pub async fn get_web_snapshot_metadata(&self, source_id: &str) -> AppResult<Option<WebSnapshot>> {
        let row = sqlx::query(
            "SELECT id, source_id, original_url, title, author, site_name, content, text_content, excerpt, created_at 
             FROM web_snapshots WHERE source_id = ?",
        )
        .bind(source_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(WebSnapshot {
                id: row.get(0),
                source_id: row.get(1),
                original_url: row.get(2),
                title: row.get(3),
                author: row.get(4),
                site_name: row.get(5),
                content: String::new(), // 从文件系统读取
                text_content: row.get(7),
                excerpt: row.get(8),
                created_at: row.get(9),
            }))
        } else {
            Ok(None)
        }
    }

    // ==================== Config 操作 ====================

    /// 获取配置
    pub async fn get_config(&self, key: &str) -> AppResult<Option<String>> {
        let row = sqlx::query("SELECT value FROM config WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            Ok(Some(row.get(0)))
        } else {
            Ok(None)
        }
    }

    /// 设置配置
    pub async fn set_config(&self, key: &str, value: &str) -> AppResult<()> {
        sqlx::query("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// 获取 Vault 历史记录列表
    pub async fn get_vault_history(&self) -> AppResult<Vec<String>> {
        let row = sqlx::query("SELECT value FROM config WHERE key = 'vault_history'")
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            let history_str: String = row.get(0);
            let history: Vec<String> = serde_json::from_str(&history_str).unwrap_or_default();
            Ok(history)
        } else {
            Ok(vec![])
        }
    }

    /// 添加 Vault 到历史记录
    pub async fn add_vault_to_history(&self, path: &str) -> AppResult<()> {
        let mut history = self.get_vault_history().await?;

        // 如果路径已存在，先移除
        history.retain(|p| p != path);

        // 添加到开头（最近使用的在前）
        history.insert(0, path.to_string());

        // 限制历史记录数量（最多保留 10 个）
        if history.len() > 10 {
            history.truncate(10);
        }

        // 保存回数据库
        let history_str = serde_json::to_string(&history)?;
        self.set_config("vault_history", &history_str).await?;

        Ok(())
    }

    // ==================== Bookmark 操作 ====================

    /// 创建书签
    pub async fn create_bookmark(&self, req: CreateBookmarkRequest) -> AppResult<Bookmark> {
        let now = Utc::now().timestamp_millis();
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO bookmarks (id, source_id, position, label, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.source_id)
        .bind(&req.position)
        .bind(req.label.as_ref())
        .bind(req.note.as_ref())
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(Bookmark {
            id,
            source_id: req.source_id,
            position: req.position,
            label: req.label,
            note: req.note,
            created_at: now,
        })
    }

    /// 获取文献源的所有书签
    pub async fn get_bookmarks_by_source(&self, source_id: &str) -> AppResult<Vec<Bookmark>> {
        let rows = sqlx::query(
            "SELECT id, source_id, position, label, note, created_at 
             FROM bookmarks WHERE source_id = ? ORDER BY created_at DESC",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        let mut bookmarks = Vec::new();
        for row in rows {
            bookmarks.push(Bookmark {
                id: row.get(0),
                source_id: row.get(1),
                position: row.get(2),
                label: row.get(3),
                note: row.get(4),
                created_at: row.get(5),
            });
        }

        Ok(bookmarks)
    }

    /// 获取所有书签
    pub async fn get_all_bookmarks(&self) -> AppResult<Vec<Bookmark>> {
        let rows = sqlx::query(
            "SELECT id, source_id, position, label, note, created_at 
             FROM bookmarks ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut bookmarks = Vec::new();
        for row in rows {
            bookmarks.push(Bookmark {
                id: row.get(0),
                source_id: row.get(1),
                position: row.get(2),
                label: row.get(3),
                note: row.get(4),
                created_at: row.get(5),
            });
        }

        Ok(bookmarks)
    }

    /// 获取单个书签
    pub async fn get_bookmark(&self, id: &str) -> AppResult<Option<Bookmark>> {
        let row = sqlx::query(
            "SELECT id, source_id, position, label, note, created_at 
             FROM bookmarks WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(Bookmark {
                id: row.get(0),
                source_id: row.get(1),
                position: row.get(2),
                label: row.get(3),
                note: row.get(4),
                created_at: row.get(5),
            }))
        } else {
            Ok(None)
        }
    }

    /// 更新书签
    pub async fn update_bookmark(&self, id: &str, req: UpdateBookmarkRequest) -> AppResult<Option<Bookmark>> {
        sqlx::query(
            "UPDATE bookmarks SET 
                label = COALESCE(?, label),
                note = COALESCE(?, note),
                position = COALESCE(?, position)
             WHERE id = ?",
        )
        .bind(req.label.as_ref())
        .bind(req.note.as_ref())
        .bind(req.position.as_ref())
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_bookmark(id).await
    }

    /// 删除书签
    pub async fn delete_bookmark(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM bookmarks WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ==================== Card 操作 ====================

    /// 创建卡片
    pub async fn create_card(&self, req: CreateCardRequest) -> AppResult<Card> {
        let now = Utc::now().timestamp_millis();
        let id = req.id.unwrap_or_else(|| Uuid::new_v4().to_string());

        // 从 content 中提取 plain_text 和 preview（简化版，实际应该在 Service 层处理）
        let plain_text = extract_plain_text_from_json(&req.content).unwrap_or_default();
        let preview = generate_preview_from_json(&req.content, 200);

        sqlx::query(
            "INSERT INTO cards (id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.title)
        .bind(req.card_type.as_str())
        .bind(&req.content)
        .bind(&plain_text)
        .bind(preview.as_ref())
        .bind(serde_json::to_string(&req.tags)?)
        .bind(serde_json::to_string(&req.aliases)?)
        .bind(serde_json::to_string(&Vec::<String>::new())?) // links 从 content 中提取
        .bind(req.source_id.as_ref())
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;

        // 从 content 中提取 links
        let links = extract_links_from_json(&req.content);

        Ok(Card {
            id: id.clone(),
            path: None, // 虚拟路径，由 generate_path() 生成
            title: req.title,
            tags: req.tags,
            card_type: req.card_type,
            content: req.content,
            plain_text,
            preview,
            created_at: now,
            modified_at: now,
            aliases: req.aliases,
            links,
            source_id: req.source_id,
        })
    }

    /// 获取单个卡片
    pub async fn get_card(&self, id: &str) -> AppResult<Option<Card>> {
        let row = sqlx::query(
            "SELECT id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at 
             FROM cards WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(self.row_to_card(row)?))
        } else {
            Ok(None)
        }
    }

    /// 获取所有卡片
    pub async fn get_all_cards(&self) -> AppResult<Vec<Card>> {
        let rows = sqlx::query(
            "SELECT id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at 
             FROM cards ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for row in rows {
            cards.push(self.row_to_card(row)?);
        }

        Ok(cards)
    }

    /// 按类型获取卡片
    pub async fn get_cards_by_type(&self, card_type: CardType) -> AppResult<Vec<Card>> {
        let rows = sqlx::query(
            "SELECT id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at 
             FROM cards WHERE type = ? ORDER BY updated_at DESC",
        )
        .bind(card_type.as_str())
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for row in rows {
            cards.push(self.row_to_card(row)?);
        }

        Ok(cards)
    }

    /// 按文献源获取卡片
    pub async fn get_cards_by_source(&self, source_id: &str) -> AppResult<Vec<Card>> {
        let rows = sqlx::query(
            "SELECT id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at 
             FROM cards WHERE source_id = ? ORDER BY updated_at DESC",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for row in rows {
            cards.push(self.row_to_card(row)?);
        }

        Ok(cards)
    }

    /// 分页获取卡片
    pub async fn get_cards_paginated(&self, offset: usize, limit: usize) -> AppResult<Vec<Card>> {
        let rows = sqlx::query(
            "SELECT id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at 
             FROM cards ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for row in rows {
            cards.push(self.row_to_card(row)?);
        }

        Ok(cards)
    }

    /// 更新卡片
    pub async fn update_card(&self, id: &str, req: UpdateCardRequest) -> AppResult<Option<Card>> {
        let now = Utc::now().timestamp_millis();

        // 获取当前内容以提取 plain_text 和 preview
        let current_card = self.get_card(id).await?;
        let content = req.content.as_ref().or_else(|| current_card.as_ref().map(|c| &c.content));
        
        let plain_text = content
            .map(|c| extract_plain_text_from_json(c).unwrap_or_default())
            .or_else(|| current_card.as_ref().map(|c| c.plain_text.clone()));
        
        let preview = if let Some(c) = content {
            generate_preview_from_json(c, 200)
        } else {
            current_card.as_ref().and_then(|c| c.preview.clone())
        };

        let tags_json = req.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
        let aliases_json = req.aliases.as_ref().map(|a| serde_json::to_string(a).unwrap_or_default());

        // 如果更新了 content，需要重新提取 links
        let links = if req.content.is_some() {
            Some(extract_links_from_json(content.unwrap()))
        } else {
            None
        };
        let links_json = links.as_ref().map(|l| serde_json::to_string(l).unwrap_or_default());

        sqlx::query(
            "UPDATE cards SET 
                title = COALESCE(?, title),
                type = COALESCE(?, type),
                content = COALESCE(?, content),
                plain_text = COALESCE(?, plain_text),
                preview = COALESCE(?, preview),
                tags = COALESCE(?, tags),
                aliases = COALESCE(?, aliases),
                links = COALESCE(?, links),
                updated_at = ?
             WHERE id = ?",
        )
        .bind(req.title.as_ref())
        .bind(req.card_type.as_ref().map(|t| t.as_str()))
        .bind(req.content.as_ref())
        .bind(plain_text.as_ref())
        .bind(preview.as_ref())
        .bind(tags_json.as_ref())
        .bind(aliases_json.as_ref())
        .bind(links_json.as_ref())
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_card(id).await
    }

    /// 删除卡片
    pub async fn delete_card(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM cards WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// 获取卡片的所有链接
    pub async fn get_card_links(&self, card_id: &str) -> AppResult<Vec<String>> {
        let row = sqlx::query("SELECT links FROM cards WHERE id = ?")
            .bind(card_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            let links_str: String = row.get(0);
            Ok(serde_json::from_str(&links_str).unwrap_or_default())
        } else {
            Ok(vec![])
        }
    }

    /// 获取反向链接（引用该卡片的卡片）
    pub async fn get_backlinks(&self, card_id: &str) -> AppResult<Vec<Card>> {
        // 查找所有 links 字段包含 card_id 的卡片
        let rows = sqlx::query(
            "SELECT id, title, type, content, plain_text, preview, tags, aliases, links, source_id, created_at, updated_at 
             FROM cards WHERE links LIKE ?",
        )
        .bind(format!("%\"{}\"%", card_id))
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for row in rows {
            cards.push(self.row_to_card(row)?);
        }

        Ok(cards)
    }

    /// 将数据库行转换为 Card
    fn row_to_card(&self, row: sqlx::sqlite::SqliteRow) -> AppResult<Card> {
        let tags_str: String = row.get(6);
        let aliases_str: String = row.get(7);
        let links_str: String = row.get(8);

        Ok(Card {
            id: row.get(0),
            path: None, // 虚拟路径，由 generate_path() 生成
            title: row.get(1),
            card_type: CardType::from_str(&row.get::<String, _>(2)),
            content: row.get(3),
            plain_text: row.get(4),
            preview: row.get(5),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            aliases: serde_json::from_str(&aliases_str).unwrap_or_default(),
            links: serde_json::from_str(&links_str).unwrap_or_default(),
            source_id: row.get(9),
            created_at: row.get(10),
            modified_at: row.get(11),
        })
    }
}

// 辅助函数：从 TipTap JSON 中提取纯文本
fn extract_plain_text_from_json(content: &str) -> Result<String, serde_json::Error> {
    let json: serde_json::Value = serde_json::from_str(content)?;
    let mut text = String::new();
    extract_text_recursive(&json, &mut text);
    Ok(text.trim().to_string())
}

fn extract_text_recursive(node: &serde_json::Value, text: &mut String) {
    if let Some(text_node) = node.get("text") {
        if let Some(s) = text_node.as_str() {
            text.push_str(s);
        }
    }
    if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
        for child in children {
            extract_text_recursive(child, text);
        }
    }
}

// 辅助函数：从 TipTap JSON 中生成预览
fn generate_preview_from_json(content: &str, max_len: usize) -> Option<String> {
    let plain_text = extract_plain_text_from_json(content).ok()?;
    if plain_text.len() > max_len {
        Some(format!("{}...", &plain_text[..max_len]))
    } else {
        Some(plain_text)
    }
}

// 辅助函数：从 TipTap JSON 中提取链接
fn extract_links_from_json(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        extract_links_recursive(&json, &mut links);
    }
    links
}

fn extract_links_recursive(node: &serde_json::Value, links: &mut Vec<String>) {
    if let Some(node_type) = node.get("type").and_then(|t| t.as_str()) {
        if node_type == "link" {
            if let Some(attrs) = node.get("attrs") {
                if let Some(href) = attrs.get("href").and_then(|h| h.as_str()) {
                    // 检查是否是内部链接（wiki link）
                    if href.starts_with("card://") || href.starts_with("#") {
                        let card_id = href
                            .strip_prefix("card://")
                            .or_else(|| href.strip_prefix("#"))
                            .unwrap_or(href);
                        if !links.contains(&card_id.to_string()) {
                            links.push(card_id.to_string());
                        }
                    }
                }
            }
        }
    }
    if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
        for child in children {
            extract_links_recursive(child, links);
        }
    }
}


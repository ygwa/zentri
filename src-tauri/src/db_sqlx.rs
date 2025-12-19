//! SQLx 数据库模块
//! 使用 SQLx 提供类型安全的数据库操作

use crate::error::{AppError, AppResult};
use crate::models::{
    CreateHighlightRequest, CreateSourceRequest, Highlight, HighlightPosition, Source,
    SourceMetadata, SourceType, UpdateHighlightRequest, UpdateSourceRequest,
};
use crate::web_reader::WebSnapshot;
use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePool, Row};
use std::path::Path;
use uuid::Uuid;

/// SQLx 数据库管理器
pub struct DatabaseSqlx {
    pool: SqlitePool,
}

impl DatabaseSqlx {
    /// 打开或创建数据库
    pub async fn open(db_path: &Path) -> AppResult<Self> {
        // 确保目录存在
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // 创建数据库连接池
        let database_url = format!("sqlite:{}", db_path.display());
        let pool = SqlitePool::connect(&database_url).await?;

        // 启用外键约束
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await?;

        let db = DatabaseSqlx { pool };
        db.run_migrations().await?;
        Ok(db)
    }

    /// 运行数据库迁移
    async fn run_migrations(&self) -> AppResult<()> {
        // 创建迁移表
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS _sqlx_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await?;

        // 检查当前版本
        let current_version: Option<i64> = sqlx::query_scalar(
            "SELECT MAX(version) FROM _sqlx_migrations",
        )
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        let target_version = 1;

        // 如果版本不匹配，运行迁移
        if current_version.map(|v| v < target_version).unwrap_or(true) {
            self.migrate_to_v1().await?;

            // 记录迁移
            sqlx::query(
                "INSERT INTO _sqlx_migrations (version, description) VALUES (?, ?)",
            )
            .bind(target_version)
            .bind("Initial schema")
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// 迁移到版本 1（初始架构）
    async fn migrate_to_v1(&self) -> AppResult<()> {
        // 检查表是否已存在
        let table_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sources')",
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);

        if table_exists {
            // 表已存在，跳过迁移（兼容现有数据库）
            return Ok(());
        }

        // 运行迁移 SQL - 逐条执行
        let migration_sql = include_str!("../migrations/001_initial_schema.sql");
        for statement in migration_sql.split(';') {
            let statement = statement.trim();
            if !statement.is_empty() && !statement.starts_with("--") {
                sqlx::query(statement).execute(&self.pool).await?;
            }
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

        sqlx::query(
            "INSERT INTO highlights (id, source_id, card_id, content, note, position, color, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.source_id)
        .bind(req.card_id.as_ref())
        .bind(&req.content)
        .bind(req.note.as_ref())
        .bind(req.position.as_ref().map(|p| serde_json::to_string(p).unwrap_or_default()))
        .bind(req.color.as_ref())
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(Highlight {
            id,
            source_id: req.source_id,
            card_id: req.card_id,
            content: req.content,
            note: req.note,
            position: req.position,
            color: req.color,
            created_at: now,
        })
    }

    /// 获取文献源的所有高亮
    pub async fn get_highlights_by_source(&self, source_id: &str) -> AppResult<Vec<Highlight>> {
        let rows = sqlx::query(
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
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
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
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
        sqlx::query(
            "UPDATE highlights SET 
                note = COALESCE(?, note),
                color = COALESCE(?, color),
                card_id = COALESCE(?, card_id)
             WHERE id = ?",
        )
        .bind(req.note.as_ref())
        .bind(req.color.as_ref())
        .bind(req.card_id.as_ref())
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_highlight(id).await
    }

    /// 获取单个高亮
    pub async fn get_highlight(&self, id: &str) -> AppResult<Option<Highlight>> {
        let row = sqlx::query(
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
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
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
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

    /// 将数据库行转换为 Highlight
    fn row_to_highlight(&self, row: sqlx::sqlite::SqliteRow) -> AppResult<Highlight> {
        let position_str: Option<String> = row.get(5);

        Ok(Highlight {
            id: row.get(0),
            source_id: row.get(1),
            card_id: row.get(2),
            content: row.get(3),
            note: row.get(4),
            position: position_str.and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok()),
            color: row.get(6),
            created_at: row.get(7),
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
}


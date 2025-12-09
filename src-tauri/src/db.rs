use crate::models::{
    CreateHighlightRequest, CreateSourceRequest, Highlight, HighlightPosition, Source,
    SourceMetadata, SourceType, UpdateSourceRequest,
};
use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

/// 数据库管理器
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// 打开或创建数据库
    pub fn open(db_path: &Path) -> Result<Self> {
        // 确保目录存在
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    /// 初始化数据库表
    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 文献源表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                author TEXT,
                url TEXT,
                cover TEXT,
                description TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                progress INTEGER NOT NULL DEFAULT 0,
                last_read_at INTEGER,
                metadata TEXT,
                note_ids TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 高亮表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS highlights (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                card_id TEXT,
                content TEXT NOT NULL,
                note TEXT,
                position TEXT,
                color TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 应用配置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_highlights_source_id ON highlights(source_id)",
            [],
        )?;

        Ok(())
    }

    // ==================== Source 操作 ====================

    /// 创建文献源
    pub fn create_source(&self, req: CreateSourceRequest) -> Result<Source> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        let source = Source {
            id: Uuid::new_v4().to_string(),
            source_type: req.source_type,
            title: req.title,
            author: req.author,
            url: req.url,
            cover: None,
            description: req.description,
            tags: req.tags,
            progress: 0,
            last_read_at: None,
            metadata: None,
            note_ids: vec![],
            created_at: now,
            updated_at: now,
        };

        conn.execute(
            "INSERT INTO sources (id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                source.id,
                source.source_type.as_str(),
                source.title,
                source.author,
                source.url,
                source.cover,
                source.description,
                serde_json::to_string(&source.tags).unwrap_or_default(),
                source.progress,
                source.last_read_at,
                serde_json::to_string(&source.metadata).ok(),
                serde_json::to_string(&source.note_ids).unwrap_or_default(),
                source.created_at,
                source.updated_at,
            ],
        )?;

        Ok(source)
    }

    /// 获取所有文献源
    pub fn get_all_sources(&self) -> Result<Vec<Source>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at 
             FROM sources ORDER BY updated_at DESC",
        )?;

        let sources = stmt
            .query_map([], |row| {
                let tags_str: String = row.get(7)?;
                let metadata_str: Option<String> = row.get(10)?;
                let note_ids_str: String = row.get(11)?;

                Ok(Source {
                    id: row.get(0)?,
                    source_type: SourceType::from_str(&row.get::<_, String>(1)?),
                    title: row.get(2)?,
                    author: row.get(3)?,
                    url: row.get(4)?,
                    cover: row.get(5)?,
                    description: row.get(6)?,
                    tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                    progress: row.get(8)?,
                    last_read_at: row.get(9)?,
                    metadata: metadata_str
                        .and_then(|s| serde_json::from_str::<SourceMetadata>(&s).ok()),
                    note_ids: serde_json::from_str(&note_ids_str).unwrap_or_default(),
                    created_at: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(sources)
    }

    /// 获取单个文献源
    pub fn get_source(&self, id: &str) -> Result<Option<Source>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, type, title, author, url, cover, description, tags, progress, last_read_at, metadata, note_ids, created_at, updated_at 
             FROM sources WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let tags_str: String = row.get(7)?;
            let metadata_str: Option<String> = row.get(10)?;
            let note_ids_str: String = row.get(11)?;

            Ok(Some(Source {
                id: row.get(0)?,
                source_type: SourceType::from_str(&row.get::<_, String>(1)?),
                title: row.get(2)?,
                author: row.get(3)?,
                url: row.get(4)?,
                cover: row.get(5)?,
                description: row.get(6)?,
                tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                progress: row.get(8)?,
                last_read_at: row.get(9)?,
                metadata: metadata_str.and_then(|s| serde_json::from_str::<SourceMetadata>(&s).ok()),
                note_ids: serde_json::from_str(&note_ids_str).unwrap_or_default(),
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 更新文献源
    pub fn update_source(&self, id: &str, req: UpdateSourceRequest) -> Result<Option<Source>> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        // 简化实现：直接更新常用字段
        conn.execute(
            "UPDATE sources SET 
                title = COALESCE(?1, title),
                author = COALESCE(?2, author),
                url = COALESCE(?3, url),
                description = COALESCE(?4, description),
                progress = COALESCE(?5, progress),
                last_read_at = COALESCE(?6, last_read_at),
                updated_at = ?7
             WHERE id = ?8",
            params![
                req.title,
                req.author,
                req.url,
                req.description,
                req.progress,
                req.last_read_at,
                now,
                id
            ],
        )?;

        // 如果有 tags 更新，单独处理
        if let Some(tags) = req.tags {
            conn.execute(
                "UPDATE sources SET tags = ?1 WHERE id = ?2",
                params![serde_json::to_string(&tags).unwrap_or_default(), id],
            )?;
        }

        drop(conn);
        self.get_source(id)
    }

    /// 删除文献源
    pub fn delete_source(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM sources WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 添加笔记 ID 到文献源
    pub fn add_note_to_source(&self, source_id: &str, note_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        // 获取当前 note_ids
        let mut stmt = conn.prepare("SELECT note_ids FROM sources WHERE id = ?1")?;
        let note_ids_str: String = stmt.query_row(params![source_id], |row| row.get(0))?;
        let mut note_ids: Vec<String> = serde_json::from_str(&note_ids_str).unwrap_or_default();

        if !note_ids.contains(&note_id.to_string()) {
            note_ids.push(note_id.to_string());
            conn.execute(
                "UPDATE sources SET note_ids = ?1, updated_at = ?2 WHERE id = ?3",
                params![serde_json::to_string(&note_ids).unwrap_or_default(), now, source_id],
            )?;
        }

        Ok(())
    }

    // ==================== Highlight 操作 ====================

    /// 创建高亮
    pub fn create_highlight(&self, req: CreateHighlightRequest) -> Result<Highlight> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        let highlight = Highlight {
            id: Uuid::new_v4().to_string(),
            source_id: req.source_id,
            card_id: req.card_id,
            content: req.content,
            note: req.note,
            position: req.position,
            color: req.color,
            created_at: now,
        };

        conn.execute(
            "INSERT INTO highlights (id, source_id, card_id, content, note, position, color, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                highlight.id,
                highlight.source_id,
                highlight.card_id,
                highlight.content,
                highlight.note,
                serde_json::to_string(&highlight.position).ok(),
                highlight.color,
                highlight.created_at,
            ],
        )?;

        Ok(highlight)
    }

    /// 获取文献源的所有高亮
    pub fn get_highlights_by_source(&self, source_id: &str) -> Result<Vec<Highlight>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
             FROM highlights WHERE source_id = ?1 ORDER BY created_at DESC",
        )?;

        let highlights = stmt
            .query_map(params![source_id], |row| {
                let position_str: Option<String> = row.get(5)?;
                Ok(Highlight {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    card_id: row.get(2)?,
                    content: row.get(3)?,
                    note: row.get(4)?,
                    position: position_str
                        .and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok()),
                    color: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(highlights)
    }

    /// 获取所有高亮
    pub fn get_all_highlights(&self) -> Result<Vec<Highlight>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
             FROM highlights ORDER BY created_at DESC",
        )?;

        let highlights = stmt
            .query_map([], |row| {
                let position_str: Option<String> = row.get(5)?;
                Ok(Highlight {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    card_id: row.get(2)?,
                    content: row.get(3)?,
                    note: row.get(4)?,
                    position: position_str
                        .and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok()),
                    color: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(highlights)
    }

    /// 删除高亮
    pub fn delete_highlight(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM highlights WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== Config 操作 ====================

    /// 获取配置
    pub fn get_config(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM config WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;

        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    /// 设置配置
    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}


use crate::commands::highlights::SourceBacklink;
use crate::models::{
    CreateHighlightRequest, CreateSourceRequest, Highlight, HighlightPosition, Source,
    SourceMetadata, SourceType, UpdateHighlightRequest, UpdateSourceRequest,
};
use crate::web_reader::WebSnapshot;
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

        // 网页快照表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS web_snapshots (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL UNIQUE,
                original_url TEXT NOT NULL,
                title TEXT NOT NULL,
                author TEXT,
                site_name TEXT,
                content TEXT NOT NULL,
                text_content TEXT NOT NULL,
                excerpt TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_highlights_source_id ON highlights(source_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_highlights_card_id ON highlights(card_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_web_snapshots_source_id ON web_snapshots(source_id)",
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

    /// 更新高亮
    pub fn update_highlight(&self, id: &str, req: UpdateHighlightRequest) -> Result<Option<Highlight>> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE highlights SET 
                note = COALESCE(?1, note),
                color = COALESCE(?2, color),
                card_id = COALESCE(?3, card_id)
             WHERE id = ?4",
            params![req.note, req.color, req.card_id, id],
        )?;

        drop(conn);
        self.get_highlight(id)
    }

    /// 获取单个高亮
    pub fn get_highlight(&self, id: &str) -> Result<Option<Highlight>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
             FROM highlights WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let position_str: Option<String> = row.get(5)?;
            Ok(Some(Highlight {
                id: row.get(0)?,
                source_id: row.get(1)?,
                card_id: row.get(2)?,
                content: row.get(3)?,
                note: row.get(4)?,
                position: position_str.and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok()),
                color: row.get(6)?,
                created_at: row.get(7)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 删除高亮
    pub fn delete_highlight(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM highlights WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 获取卡片关联的高亮
    pub fn get_highlights_by_card(&self, card_id: &str) -> Result<Vec<Highlight>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_id, card_id, content, note, position, color, created_at 
             FROM highlights WHERE card_id = ?1 ORDER BY created_at DESC",
        )?;

        let highlights = stmt
            .query_map(params![card_id], |row| {
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

    /// 获取引用该文献源的所有笔记（反向链接）
    pub fn get_backlinks_for_source(&self, source_id: &str) -> Result<Vec<SourceBacklink>> {
        let conn = self.conn.lock().unwrap();
        
        // 查询所有引用该 source 的高亮，并关联卡片信息
        // 注意：这需要访问卡片存储，暂时返回高亮信息
        let mut stmt = conn.prepare(
            "SELECT h.id, h.card_id, h.content, h.position
             FROM highlights h
             WHERE h.source_id = ?1 AND h.card_id IS NOT NULL
             ORDER BY h.created_at DESC",
        )?;

        let backlinks = stmt
            .query_map(params![source_id], |row| {
                let position_str: Option<String> = row.get(3)?;
                let position: Option<HighlightPosition> = position_str
                    .and_then(|s| serde_json::from_str::<HighlightPosition>(&s).ok());
                
                Ok(SourceBacklink {
                    card_id: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    card_title: String::new(), // 需要从卡片存储获取
                    highlight_id: row.get(0)?,
                    highlight_content: row.get(2)?,
                    page: position.as_ref().and_then(|p| p.page),
                    cfi: position.as_ref().and_then(|p| p.cfi.clone()),
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(backlinks)
    }

    // ==================== WebSnapshot 操作 ====================

    /// 保存网页快照
    pub fn save_web_snapshot(&self, snapshot: &WebSnapshot) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR REPLACE INTO web_snapshots 
             (id, source_id, original_url, title, author, site_name, content, text_content, excerpt, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                snapshot.id,
                snapshot.source_id,
                snapshot.original_url,
                snapshot.title,
                snapshot.author,
                snapshot.site_name,
                snapshot.content,
                snapshot.text_content,
                snapshot.excerpt,
                snapshot.created_at,
            ],
        )?;

        Ok(())
    }

    /// 获取网页快照
    pub fn get_web_snapshot(&self, source_id: &str) -> Result<Option<WebSnapshot>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, source_id, original_url, title, author, site_name, content, text_content, excerpt, created_at 
             FROM web_snapshots WHERE source_id = ?1",
        )?;

        let mut rows = stmt.query(params![source_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(WebSnapshot {
                id: row.get(0)?,
                source_id: row.get(1)?,
                original_url: row.get(2)?,
                title: row.get(3)?,
                author: row.get(4)?,
                site_name: row.get(5)?,
                content: row.get(6)?,
                text_content: row.get(7)?,
                excerpt: row.get(8)?,
                created_at: row.get(9)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 删除网页快照
    pub fn delete_web_snapshot(&self, source_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM web_snapshots WHERE source_id = ?1", params![source_id])?;
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

    /// 获取 Vault 历史记录列表
    pub fn get_vault_history(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM config WHERE key = 'vault_history'")?;
        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            let history_str: String = row.get(0)?;
            let history: Vec<String> = serde_json::from_str(&history_str).unwrap_or_default();
            Ok(history)
        } else {
            Ok(vec![])
        }
    }

    /// 添加 Vault 到历史记录
    pub fn add_vault_to_history(&self, path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // 获取当前历史记录
        let mut history = self.get_vault_history().unwrap_or_default();
        
        // 如果路径已存在，先移除
        history.retain(|p| p != path);
        
        // 添加到开头（最近使用的在前）
        history.insert(0, path.to_string());
        
        // 限制历史记录数量（最多保留 10 个）
        if history.len() > 10 {
            history.truncate(10);
        }
        
        // 保存回数据库
        let history_str = serde_json::to_string(&history).unwrap_or_default();
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            params!["vault_history", history_str],
        )?;
        
        Ok(())
    }
}


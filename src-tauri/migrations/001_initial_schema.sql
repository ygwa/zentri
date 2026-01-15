-- 初始数据库架构迁移
-- 创建所有基础表

-- 文献源表
CREATE TABLE IF NOT EXISTS sources (
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
);

-- 高亮表
CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    card_id TEXT,
    content TEXT NOT NULL,
    note TEXT,
    position TEXT,
    color TEXT,
    type TEXT DEFAULT 'highlight',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 书签表
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    position TEXT NOT NULL,
    label TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 向量嵌入表（用于 RAG）
CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    content TEXT NOT NULL,
    vector BLOB NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 应用配置表
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 网页快照表
CREATE TABLE IF NOT EXISTS web_snapshots (
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
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_highlights_source_id ON highlights(source_id);
CREATE INDEX IF NOT EXISTS idx_highlights_card_id ON highlights(card_id);
CREATE INDEX IF NOT EXISTS idx_highlights_type ON highlights(type);
CREATE INDEX IF NOT EXISTS idx_highlights_created_at ON highlights(created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_source_id ON bookmarks(source_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON embeddings(source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);
CREATE INDEX IF NOT EXISTS idx_web_snapshots_source_id ON web_snapshots(source_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_updated_at ON sources(updated_at);
CREATE INDEX IF NOT EXISTS idx_sources_created_at ON sources(created_at);






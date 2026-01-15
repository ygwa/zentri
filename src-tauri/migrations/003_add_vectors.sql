-- 添加向量存储表
-- 支持 RAG 功能的向量嵌入存储

CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    content TEXT NOT NULL,
    vector BLOB NOT NULL, -- 序列化的 f32 向量数组
    metadata TEXT, -- JSON 格式的元数据
    created_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON embeddings(source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);





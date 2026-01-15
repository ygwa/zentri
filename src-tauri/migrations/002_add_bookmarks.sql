-- 添加书签表
-- 支持在阅读器中添加、删除、跳转书签

CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    position TEXT NOT NULL, -- CFI 或等效位置标识
    label TEXT, -- 书签标签（可选）
    note TEXT, -- 书签备注（可选）
    created_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_source_id ON bookmarks(source_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);





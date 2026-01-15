-- 添加高亮类型字段
-- 支持 highlight、underline、strikethrough 三种标注类型

-- 添加 type 字段到 highlights 表
ALTER TABLE highlights ADD COLUMN type TEXT DEFAULT 'highlight';

-- 创建索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_highlights_type ON highlights(type);





use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{Index, IndexReader, ReloadPolicy};
use tantivy::directory::MmapDirectory;
// use tantivy_jieba::JiebaTokenizer;
use tantivy::tokenizer::NgramTokenizer;

/// 搜索结果结构
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub score: f32,
    pub snippet: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Clone)]
pub struct Indexer {
    index: Index,
    reader: IndexReader,
    schema: Schema,
    // Fields
    pub id: Field,
    pub title: Field,
    pub content: Field,
    pub tags: Field,
    pub path: Field,
    pub modified_at: Field,
}

impl Indexer {
    pub fn new(index_path: &Path) -> Result<Self, String> {
        let mut schema_builder = Schema::builder();

        // 定义 Schema
        let id = schema_builder.add_text_field("id", STRING | STORED);
        
        let text_indexing = TextFieldIndexing::default()
            .set_tokenizer("jieba") // 使用 Jieba 分词 (更适合中文)
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options = TextOptions::default()
            .set_indexing_options(text_indexing)
            .set_stored();

        let title = schema_builder.add_text_field("title", text_options.clone());
        let content = schema_builder.add_text_field("content", text_options);
        
        let tags = schema_builder.add_text_field("tags", STRING | STORED);
        let path = schema_builder.add_text_field("path", STRING | STORED);
        let modified_at = schema_builder.add_i64_field("modified_at", STORED | FAST);

        let schema = schema_builder.build();

        // 确保索引目录存在
        if !index_path.exists() {
            std::fs::create_dir_all(index_path).map_err(|e| e.to_string())?;
        }

        // 打开或创建索引
        let dir = MmapDirectory::open(index_path).map_err(|e| e.to_string())?;
        let index = Index::open_or_create(dir, schema.clone())
            .map_err(|e| e.to_string())?;

        // 注册 Ngram 分词器 (替代 Jieba, min=1, max=2)
        let ngram = NgramTokenizer::new(1, 2, false);
        index.tokenizers().register("jieba", ngram); // 保持名字为 "jieba" 以免修改 schema 定义

        // 创建 reader
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommit)
            .try_into()
            .map_err(|e| e.to_string())?;

        Ok(Self {
            index,
            reader,
            schema,
            id,
            title,
            content,
            tags,
            path,
            modified_at,
        })
    }

    /// 添加或更新文档
    pub fn index_doc(
        &self,
        id_val: &str,
        title_val: &str,
        content_val: &str,
        tags_val: &[String],
        path_val: &str,
        modified_at_val: i64,
    ) -> Result<(), String> {
        let mut index_writer = self.index.writer(50_000_000).map_err(|e| e.to_string())?;

        // 先删除旧文档 (根据 ID)
        let term = Term::from_field_text(self.id, id_val);
        index_writer.delete_term(term);

        // 构建新文档
        let mut doc = Document::default();
        doc.add_text(self.id, id_val);
        doc.add_text(self.title, title_val);
        doc.add_text(self.content, content_val);
        for tag in tags_val {
            doc.add_text(self.tags, tag);
        }
        doc.add_text(self.path, path_val);
        doc.add_i64(self.modified_at, modified_at_val);

        index_writer.add_document(doc).map_err(|e| e.to_string())?;
        index_writer.commit().map_err(|e| e.to_string())?;

        Ok(())
    }

    /// 搜索
    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<(String, String, f32)>, String> {
        let searcher = self.reader.searcher();
        
        // 搜索 title 和 content
        let query_parser = QueryParser::for_index(&self.index, vec![self.title, self.content]);
        let query = query_parser.parse_query(query_str).map_err(|e| e.to_string())?;

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address).map_err(|e| e.to_string())?;
            
            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();
                
            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();

            results.push((id, title, score));
        }

        Ok(results)
    }

    /// 搜索并返回高亮片段
    pub fn search_with_snippets(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        let searcher = self.reader.searcher();
        
        // 搜索 title 和 content
        let query_parser = QueryParser::for_index(&self.index, vec![self.title, self.content]);
        let query = query_parser.parse_query(query_str).map_err(|e| e.to_string())?;

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let query_lower = query_str.to_lowercase();
        let mut results = Vec::new();
        
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address).map_err(|e| e.to_string())?;
            
            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();
                
            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();
                
            let content = retrieved_doc
                .get_first(self.content)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();
                
            // 收集所有标签
            let tags: Vec<String> = retrieved_doc
                .get_all(self.tags)
                .filter_map(|v| v.as_text().map(|s| s.to_string()))
                .collect();

            // 生成高亮片段
            let snippet = self.generate_snippet(&content, &query_lower);

            results.push(SearchResult {
                id,
                title,
                score,
                snippet,
                tags,
            });
        }

        Ok(results)
    }

    /// 生成高亮片段
    fn generate_snippet(&self, content: &str, query: &str) -> Option<String> {
        let content_lower = content.to_lowercase();
        
        // 找到查询词的位置
        if let Some(pos) = content_lower.find(query) {
            // 取前后 50 个字符作为上下文
            let start = pos.saturating_sub(50);
            let end = (pos + query.len() + 50).min(content.len());
            
            // 确保在字符边界
            let start = content[..start].rfind(char::is_whitespace).map(|i| i + 1).unwrap_or(start);
            
            let mut snippet = String::new();
            
            // 添加省略号（如果不是开头）
            if start > 0 {
                snippet.push_str("...");
            }
            
            // 分段高亮
            let text_slice = &content[start..end];
            let text_lower = text_slice.to_lowercase();
            
            let mut last_end = 0;
            for (match_start, _) in text_lower.match_indices(query) {
                // 添加未匹配的部分
                snippet.push_str(&text_slice[last_end..match_start]);
                // 添加高亮的匹配部分
                snippet.push_str("<mark>");
                snippet.push_str(&text_slice[match_start..match_start + query.len()]);
                snippet.push_str("</mark>");
                last_end = match_start + query.len();
            }
            // 添加剩余部分
            snippet.push_str(&text_slice[last_end..]);
            
            // 添加省略号（如果不是结尾）
            if end < content.len() {
                snippet.push_str("...");
            }
            
            Some(snippet)
        } else {
            // 如果没找到精确匹配，返回内容开头
            let preview_len = 100.min(content.len());
            let preview = &content[..preview_len];
            if content.len() > preview_len {
                Some(format!("{}...", preview))
            } else {
                Some(preview.to_string())
            }
        }
    }
    
    /// 删除文档
    pub fn delete_doc(&self, id_val: &str) -> Result<(), String> {
         let mut index_writer = self.index.writer(50_000_000).map_err(|e| e.to_string())?;
         let term = Term::from_field_text(self.id, id_val);
         index_writer.delete_term(term);
         index_writer.commit().map_err(|e| e.to_string())?;
         Ok(())
    }

    /// 获取文档最后修改时间
    pub fn get_doc_mtime(&self, id_val: &str) -> Result<Option<i64>, String> {
        let searcher = self.reader.searcher();
        let term = Term::from_field_text(self.id, id_val);
        let term_query = tantivy::query::TermQuery::new(term, IndexRecordOption::Basic);
        let top_docs = searcher.search(&term_query, &TopDocs::with_limit(1))
            .map_err(|e| e.to_string())?;

        if let Some((_, doc_address)) = top_docs.first() {
            let doc = searcher.doc(*doc_address).map_err(|e| e.to_string())?;
            if let Some(val) = doc.get_first(self.modified_at) {
                return Ok(val.as_i64());
            }
        }
        Ok(None)
    }
}


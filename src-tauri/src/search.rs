//! 全文搜索模块
//! 基于 tantivy 实现高性能搜索，支持中文分词、模糊搜索、结构化过滤

use jieba_rs::Jieba;
use std::path::Path;
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::{BooleanQuery, FuzzyTermQuery, Occur, Query, QueryParser, TermQuery};
use tantivy::schema::*;
use tantivy::tokenizer::{LowerCaser, TextAnalyzer, Token, TokenStream, Tokenizer};
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument, Term};

/// 搜索结果结构
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub score: f32,
    pub snippet: Option<String>,
    pub tags: Vec<String>,
    pub card_type: Option<String>,
}

/// Jieba 中文分词器
#[derive(Clone)]
struct JiebaTokenizer {
    jieba: Arc<Jieba>,
}

impl Default for JiebaTokenizer {
    fn default() -> Self {
        Self {
            jieba: Arc::new(Jieba::new()),
        }
    }
}

struct JiebaTokenStream {
    tokens: Vec<Token>,
    index: usize,
}

impl TokenStream for JiebaTokenStream {
    fn advance(&mut self) -> bool {
        if self.index < self.tokens.len() {
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn token(&self) -> &Token {
        &self.tokens[self.index - 1]
    }

    fn token_mut(&mut self) -> &mut Token {
        &mut self.tokens[self.index - 1]
    }
}

impl Tokenizer for JiebaTokenizer {
    type TokenStream<'a> = JiebaTokenStream;

    fn token_stream<'a>(&'a mut self, text: &'a str) -> Self::TokenStream<'a> {
        let mut tokens = Vec::new();
        let mut offset = 0;

        // 使用 jieba 进行分词
        for word in self.jieba.cut(text, true) {
            let start = text[offset..]
                .find(word)
                .map(|i| offset + i)
                .unwrap_or(offset);
            let end = start + word.len();

            tokens.push(Token {
                offset_from: start,
                offset_to: end,
                position: tokens.len(),
                text: word.to_string(),
                position_length: 1,
            });

            offset = end;
        }

        JiebaTokenStream { tokens, index: 0 }
    }
}

#[derive(Clone)]
pub struct Indexer {
    index: Index,
    reader: IndexReader,
    #[allow(dead_code)]
    schema: Schema,
    // Fields
    pub id: Field,
    pub title: Field,
    pub content: Field,
    pub tags: Field,
    pub path: Field,
    pub modified_at: Field,
    pub card_type: Field,
}

impl Indexer {
    pub fn new(index_path: &Path) -> Result<Self, String> {
        let mut schema_builder = Schema::builder();

        // 定义 Schema
        let id = schema_builder.add_text_field("id", STRING | STORED);

        let text_indexing = TextFieldIndexing::default()
            .set_tokenizer("jieba")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options = TextOptions::default()
            .set_indexing_options(text_indexing)
            .set_stored();

        let title = schema_builder.add_text_field("title", text_options.clone());
        let content = schema_builder.add_text_field("content", text_options);

        let tags = schema_builder.add_text_field("tags", STRING | STORED);
        let path = schema_builder.add_text_field("path", STRING | STORED);
        let modified_at = schema_builder.add_i64_field("modified_at", STORED | FAST);

        // 新增: 卡片类型字段 (用于过滤)
        let card_type = schema_builder.add_text_field("card_type", STRING | STORED);

        let schema = schema_builder.build();

        // 确保索引目录存在
        if !index_path.exists() {
            std::fs::create_dir_all(index_path).map_err(|e| e.to_string())?;
        }

        // 打开或创建索引
        let dir = MmapDirectory::open(index_path).map_err(|e| e.to_string())?;
        let index = Index::open_or_create(dir, schema.clone()).map_err(|e| e.to_string())?;

        // 注册 Jieba 中文分词器
        let jieba_tokenizer = TextAnalyzer::builder(JiebaTokenizer::default())
            .filter(LowerCaser)
            .build();
        index.tokenizers().register("jieba", jieba_tokenizer);

        // 创建 reader
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
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
            card_type,
        })
    }

    /// 添加或更新文档
    #[allow(dead_code)]
    pub fn index_doc(
        &self,
        id_val: &str,
        title_val: &str,
        content_val: &str,
        tags_val: &[String],
        path_val: &str,
        modified_at_val: i64,
    ) -> Result<(), String> {
        self.index_doc_with_type(
            id_val,
            title_val,
            content_val,
            tags_val,
            path_val,
            modified_at_val,
            None,
        )
    }

    /// 添加或更新文档 (带类型)
    pub fn index_doc_with_type(
        &self,
        id_val: &str,
        title_val: &str,
        content_val: &str,
        tags_val: &[String],
        path_val: &str,
        modified_at_val: i64,
        card_type_val: Option<&str>,
    ) -> Result<(), String> {
        let mut index_writer: IndexWriter<TantivyDocument> =
            self.index.writer(50_000_000).map_err(|e| e.to_string())?;

        // 先删除旧文档 (根据 ID)
        let term = Term::from_field_text(self.id, id_val);
        index_writer.delete_term(term);

        // 构建新文档
        let mut doc = TantivyDocument::default();
        doc.add_text(self.id, id_val);
        doc.add_text(self.title, title_val);
        doc.add_text(self.content, content_val);
        for tag in tags_val {
            doc.add_text(self.tags, tag);
        }
        doc.add_text(self.path, path_val);
        doc.add_i64(self.modified_at, modified_at_val);

        // 添加卡片类型
        if let Some(ct) = card_type_val {
            doc.add_text(self.card_type, ct);
        }

        index_writer.add_document(doc).map_err(|e| e.to_string())?;
        index_writer.commit().map_err(|e| e.to_string())?;

        Ok(())
    }

    /// 搜索
    #[allow(dead_code)]
    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
    ) -> Result<Vec<(String, String, f32)>, String> {
        let searcher = self.reader.searcher();

        // 搜索 title 和 content
        let query_parser = QueryParser::for_index(&self.index, vec![self.title, self.content]);
        let query = query_parser
            .parse_query(query_str)
            .map_err(|e| e.to_string())?;

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let retrieved_doc: TantivyDocument =
                searcher.doc(doc_address).map_err(|e| e.to_string())?;

            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            results.push((id, title, score));
        }

        Ok(results)
    }

    /// 搜索并返回高亮片段
    pub fn search_with_snippets(
        &self,
        query_str: &str,
        limit: usize,
    ) -> Result<Vec<SearchResult>, String> {
        self.search_with_filter(query_str, limit, None, None)
    }

    /// 带过滤条件的搜索
    pub fn search_with_filter(
        &self,
        query_str: &str,
        limit: usize,
        card_type_filter: Option<&str>,
        tag_filter: Option<&str>,
    ) -> Result<Vec<SearchResult>, String> {
        let searcher = self.reader.searcher();

        // 构建主查询
        let query_parser = QueryParser::for_index(&self.index, vec![self.title, self.content]);
        let text_query = query_parser
            .parse_query(query_str)
            .map_err(|e| e.to_string())?;

        // 构建复合查询 (可选过滤)
        let final_query: Box<dyn Query> = if card_type_filter.is_some() || tag_filter.is_some() {
            let mut clauses: Vec<(Occur, Box<dyn Query>)> = vec![(Occur::Must, text_query)];

            if let Some(ct) = card_type_filter {
                let term = Term::from_field_text(self.card_type, ct);
                clauses.push((
                    Occur::Must,
                    Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
                ));
            }

            if let Some(tag) = tag_filter {
                let term = Term::from_field_text(self.tags, tag);
                clauses.push((
                    Occur::Must,
                    Box::new(TermQuery::new(term, IndexRecordOption::Basic)),
                ));
            }

            Box::new(BooleanQuery::new(clauses))
        } else {
            text_query
        };

        let top_docs = searcher
            .search(&*final_query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let query_lower = query_str.to_lowercase();
        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: TantivyDocument =
                searcher.doc(doc_address).map_err(|e| e.to_string())?;

            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let content = retrieved_doc
                .get_first(self.content)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            // 收集所有标签
            let tags: Vec<String> = retrieved_doc
                .get_all(self.tags)
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();

            let card_type = retrieved_doc
                .get_first(self.card_type)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // 生成高亮片段
            let snippet = self.generate_snippet(&content, &query_lower);

            results.push(SearchResult {
                id,
                title,
                score,
                snippet,
                tags,
                card_type,
            });
        }

        Ok(results)
    }

    /// 模糊搜索 (处理拼写错误)
    pub fn fuzzy_search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        let searcher = self.reader.searcher();

        // 对每个词进行模糊匹配
        let words: Vec<&str> = query_str.split_whitespace().collect();
        let mut clauses: Vec<(Occur, Box<dyn Query>)> = Vec::new();

        for word in words {
            // 标题模糊匹配
            let title_term = Term::from_field_text(self.title, word);
            let title_fuzzy = FuzzyTermQuery::new(title_term, 1, true);
            clauses.push((Occur::Should, Box::new(title_fuzzy)));

            // 内容模糊匹配
            let content_term = Term::from_field_text(self.content, word);
            let content_fuzzy = FuzzyTermQuery::new(content_term, 1, true);
            clauses.push((Occur::Should, Box::new(content_fuzzy)));
        }

        let query = BooleanQuery::new(clauses);

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let query_lower = query_str.to_lowercase();
        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: TantivyDocument =
                searcher.doc(doc_address).map_err(|e| e.to_string())?;

            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let content = retrieved_doc
                .get_first(self.content)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let tags: Vec<String> = retrieved_doc
                .get_all(self.tags)
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();

            let card_type = retrieved_doc
                .get_first(self.card_type)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let snippet = self.generate_snippet(&content, &query_lower);

            results.push(SearchResult {
                id,
                title,
                score,
                snippet,
                tags,
                card_type,
            });
        }

        Ok(results)
    }

    /// 生成高亮片段 (UTF-8 safe)
    fn generate_snippet(&self, content: &str, query: &str) -> Option<String> {
        let content_lower = content.to_lowercase();
        let query_lower = query.to_lowercase();

        if query_lower.is_empty() {
            return self.generate_preview(content);
        }

        // 找到查询词的位置 (byte index in lower string)
        if let Some(pos) = content_lower.find(&query_lower) {
            // Note: Indices from to_lowercase might not strictly map to content,
            // but for simple search snippet it's often close enough or we accept a slight drift.
            // A perfect solution requires mapping indices or case-insensitive search on original string.
            // Here we prioritize safety over pixel-perfect alignment for now.

            // Safe start calculation
            let context_chars = 20; // Reduce context to avoid huge drift

            // Find a safe char boundary backwards approx 50 bytes
            // Iterate chars backwards from pos
            let mut char_count = 0;
            let mut found_start = 0;

            for (curr_idx, _) in content.char_indices().rev() {
                if curr_idx <= pos {
                    if char_count < context_chars {
                        char_count += 1;
                        found_start = curr_idx;
                    } else {
                        break;
                    }
                }
            }
            let start = found_start;

            // Safe end calculation
            let target_end = pos + query_lower.len() + 100; // ample buffer
            let end = if target_end >= content.len() {
                content.len()
            } else {
                // Align to next char boundary
                let mut safe_e = target_end;
                while !content.is_char_boundary(safe_e) && safe_e < content.len() {
                    safe_e += 1;
                }
                safe_e
            };

            let safe_slice = &content[start..end];

            let mut snippet = String::new();
            if start > 0 {
                snippet.push_str("...");
            }

            // Highlight inside the safe slice
            // Simple approach: case-insensitive replace? No, need to keep original case.
            // We use the same naive find logic on the slice.
            let slice_lower = safe_slice.to_lowercase();
            // We need to re-locate the query inside this slice because lowercasing might change lengths slightly
            // or if we drifted.
            // Better approach for display: just markup the text.

            let mut last_end = 0;
            // Note: matching inside slice_lower and mapping back to safe_slice is still risky for length mapping.
            // But usually 1:1 for most chars.

            for (match_start, part_str) in slice_lower.match_indices(&query_lower) {
                // Add text before match
                if match_start > last_end {
                    // Check boundaries again just in case length differs (rare but possible with weird unicode)
                    if last_end < safe_slice.len() && match_start <= safe_slice.len() {
                        snippet.push_str(&safe_slice[last_end..match_start]);
                    }
                }

                // Add highlighted match
                snippet.push_str("<mark>");
                // Use original text length if possible, or query length
                let match_end = match_start + part_str.len();
                if match_end <= safe_slice.len() {
                    snippet.push_str(&safe_slice[match_start..match_end]);
                } else {
                    snippet.push_str(&query); // Fallback
                }
                snippet.push_str("</mark>");

                last_end = match_end;
            }

            // Add remainder
            if last_end < safe_slice.len() {
                snippet.push_str(&safe_slice[last_end..]);
            }

            if end < content.len() {
                snippet.push_str("...");
            }

            Some(snippet)
        } else {
            self.generate_preview(content)
        }
    }

    fn generate_preview(&self, content: &str) -> Option<String> {
        let chars: Vec<char> = content.chars().collect();
        let limit = 100;
        if chars.len() > limit {
            Some(format!("{}...", chars[..limit].iter().collect::<String>()))
        } else {
            Some(content.to_string())
        }
    }

    /// 删除文档
    pub fn delete_doc(&self, id_val: &str) -> Result<(), String> {
        let mut index_writer: IndexWriter<TantivyDocument> =
            self.index.writer(50_000_000).map_err(|e| e.to_string())?;
        let term = Term::from_field_text(self.id, id_val);
        index_writer.delete_term(term);
        index_writer.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 获取文档最后修改时间
    pub fn get_doc_mtime(&self, id_val: &str) -> Result<Option<i64>, String> {
        let searcher = self.reader.searcher();
        let term = Term::from_field_text(self.id, id_val);
        let term_query = TermQuery::new(term, IndexRecordOption::Basic);
        let top_docs = searcher
            .search(&term_query, &TopDocs::with_limit(1))
            .map_err(|e| e.to_string())?;

        if let Some((_, doc_address)) = top_docs.first() {
            let doc: TantivyDocument = searcher.doc(*doc_address).map_err(|e| e.to_string())?;
            if let Some(val) = doc.get_first(self.modified_at) {
                return Ok(val.as_i64());
            }
        }
        Ok(None)
    }

    /// 按标签搜索
    pub fn search_by_tag(&self, tag: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        let searcher = self.reader.searcher();
        let term = Term::from_field_text(self.tags, tag);
        let query = TermQuery::new(term, IndexRecordOption::Basic);

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: TantivyDocument =
                searcher.doc(doc_address).map_err(|e| e.to_string())?;

            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let tags: Vec<String> = retrieved_doc
                .get_all(self.tags)
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();

            let card_type = retrieved_doc
                .get_first(self.card_type)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            results.push(SearchResult {
                id,
                title,
                score,
                snippet: None,
                tags,
                card_type,
            });
        }

        Ok(results)
    }

    /// 按卡片类型搜索
    pub fn search_by_type(
        &self,
        card_type: &str,
        limit: usize,
    ) -> Result<Vec<SearchResult>, String> {
        let searcher = self.reader.searcher();
        let term = Term::from_field_text(self.card_type, card_type);
        let query = TermQuery::new(term, IndexRecordOption::Basic);

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: TantivyDocument =
                searcher.doc(doc_address).map_err(|e| e.to_string())?;

            let id = retrieved_doc
                .get_first(self.id)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let tags: Vec<String> = retrieved_doc
                .get_all(self.tags)
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();

            let ct = retrieved_doc
                .get_first(self.card_type)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            results.push(SearchResult {
                id,
                title,
                score,
                snippet: None,
                tags,
                card_type: ct,
            });
        }

        Ok(results)
    }
}

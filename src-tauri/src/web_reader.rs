//! 网页阅读器模块 - 网页抓取与清洗
//!
//! 使用 readability 提取网页正文，生成干净的阅读模式内容

use serde::{Deserialize, Serialize};
use std::io::Cursor;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WebReaderError {
    #[error("网络请求失败: {0}")]
    NetworkError(#[from] reqwest::Error),
    #[error("HTML 解析失败: {0}")]
    ParseError(String),
    #[error("无法提取正文内容")]
    #[allow(dead_code)]
    ExtractionFailed,
    #[error("URL 解析失败: {0}")]
    UrlError(#[from] url::ParseError),
}

/// 网页元数据（用于快速填充表单）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebpageMetadata {
    pub title: String,
    pub author: Option<String>,
    pub site_name: Option<String>,
    pub description: Option<String>,
    pub favicon: Option<String>,
}

/// 网页快照数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSnapshot {
    pub id: String,
    pub source_id: String,
    pub original_url: String,
    pub title: String,
    pub author: Option<String>,
    pub site_name: Option<String>,
    pub content: String,        // 清洗后的 HTML
    pub text_content: String,   // 纯文本（用于搜索索引）
    pub excerpt: Option<String>,
    pub created_at: i64,
}

/// 网页抓取结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResult {
    pub title: String,
    pub author: Option<String>,
    pub site_name: Option<String>,
    pub content: String,        // 清洗后的 HTML
    pub text_content: String,   // 纯文本
    pub excerpt: Option<String>,
    pub word_count: usize,
}

/// 抓取并清洗网页内容
pub fn fetch_and_clean(url: &str) -> Result<FetchResult, WebReaderError> {
    // 解析 URL
    let parsed_url = url::Url::parse(url)?;
    
    // 获取网页 HTML
    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    
    let response = client.get(url).send()?;
    let html = response.text()?;
    
    // 使用 readability 提取正文
    let mut cursor = Cursor::new(html.as_bytes());
    let extracted = readability::extractor::extract(&mut cursor, &parsed_url)
        .map_err(|e| WebReaderError::ParseError(e.to_string()))?;
    
    // 提取纯文本用于搜索
    let text_content = extract_text_from_html(&extracted.content);
    let word_count = text_content.chars().filter(|c| !c.is_whitespace()).count();
    
    Ok(FetchResult {
        title: extracted.title,
        author: None, // readability 不直接提供作者，可以后续用 scraper 提取
        site_name: Some(parsed_url.host_str().unwrap_or("").to_string()),
        content: extracted.content,
        text_content,
        excerpt: Some(extracted.text.chars().take(200).collect()),
        word_count,
    })
}

/// 从 HTML 中提取纯文本
fn extract_text_from_html(html: &str) -> String {
    use scraper::{Html, Selector};
    
    let document = Html::parse_document(html);
    let selector = Selector::parse("body, p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote")
        .unwrap_or_else(|_| Selector::parse("*").unwrap());
    
    let mut text_parts: Vec<String> = Vec::new();
    
    for element in document.select(&selector) {
        let text: String = element.text().collect();
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            text_parts.push(trimmed.to_string());
        }
    }
    
    text_parts.join("\n")
}

/// 将清洗后的 HTML 转换为简化的 Markdown 格式
pub fn html_to_markdown(html: &str) -> String {
    use scraper::{Html, Selector};
    
    let document = Html::parse_document(html);
    let mut markdown = String::new();
    
    // 简化的转换逻辑
    let selectors = [
        ("h1", "# "),
        ("h2", "## "),
        ("h3", "### "),
        ("h4", "#### "),
        ("p", ""),
        ("blockquote", "> "),
        ("li", "- "),
    ];
    
    for (tag, prefix) in selectors {
        if let Ok(selector) = Selector::parse(tag) {
            for element in document.select(&selector) {
                let text: String = element.text().collect();
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    markdown.push_str(prefix);
                    markdown.push_str(trimmed);
                    markdown.push_str("\n\n");
                }
            }
        }
    }
    
    markdown
}

/// 快速获取网页元数据（不进行完整内容提取）
pub fn fetch_webpage_metadata(url: &str) -> Result<WebpageMetadata, WebReaderError> {
    use scraper::{Html, Selector};
    
    // 解析 URL
    let parsed_url = url::Url::parse(url)?;
    
    // 获取网页 HTML
    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;
    
    let response = client.get(url).send()?;
    let html = response.text()?;
    
    let document = Html::parse_document(&html);
    
    // 提取标题
    let title = extract_meta_content(&document, "og:title")
        .or_else(|| extract_meta_content(&document, "twitter:title"))
        .or_else(|| {
            Selector::parse("title")
                .ok()
                .and_then(|sel| document.select(&sel).next())
                .map(|el| el.text().collect::<String>().trim().to_string())
        })
        .unwrap_or_else(|| "Untitled".to_string());
    
    // 提取作者
    let author = extract_meta_content(&document, "author")
        .or_else(|| extract_meta_content(&document, "og:article:author"))
        .or_else(|| extract_meta_content(&document, "twitter:creator"));
    
    // 提取站点名称
    let site_name = extract_meta_content(&document, "og:site_name")
        .or_else(|| Some(parsed_url.host_str().unwrap_or("").to_string()));
    
    // 提取描述
    let description = extract_meta_content(&document, "description")
        .or_else(|| extract_meta_content(&document, "og:description"))
        .or_else(|| extract_meta_content(&document, "twitter:description"));
    
    // 提取 favicon
    let favicon = extract_favicon(&document, &parsed_url);
    
    Ok(WebpageMetadata {
        title,
        author,
        site_name,
        description,
        favicon,
    })
}

/// 从 meta 标签提取内容
fn extract_meta_content(document: &scraper::Html, name: &str) -> Option<String> {
    use scraper::Selector;
    
    // 尝试 property 属性
    let property_selector = format!(r#"meta[property="{}"]"#, name);
    if let Ok(sel) = Selector::parse(&property_selector) {
        if let Some(element) = document.select(&sel).next() {
            if let Some(content) = element.value().attr("content") {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    
    // 尝试 name 属性
    let name_selector = format!(r#"meta[name="{}"]"#, name);
    if let Ok(sel) = Selector::parse(&name_selector) {
        if let Some(element) = document.select(&sel).next() {
            if let Some(content) = element.value().attr("content") {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    
    None
}

/// 提取 favicon
fn extract_favicon(document: &scraper::Html, base_url: &url::Url) -> Option<String> {
    use scraper::Selector;
    
    // 尝试各种 favicon 选择器
    let selectors = [
        r#"link[rel="icon"]"#,
        r#"link[rel="shortcut icon"]"#,
        r#"link[rel="apple-touch-icon"]"#,
    ];
    
    for sel_str in selectors {
        if let Ok(sel) = Selector::parse(sel_str) {
            if let Some(element) = document.select(&sel).next() {
                if let Some(href) = element.value().attr("href") {
                    // 转换为绝对 URL
                    if let Ok(absolute) = base_url.join(href) {
                        return Some(absolute.to_string());
                    }
                }
            }
        }
    }
    
    // 默认尝试 /favicon.ico
    if let Ok(favicon_url) = base_url.join("/favicon.ico") {
        return Some(favicon_url.to_string());
    }
    
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_extract_text() {
        let html = r#"
            <html>
                <body>
                    <h1>标题</h1>
                    <p>这是一段正文内容。</p>
                </body>
            </html>
        "#;
        let text = extract_text_from_html(html);
        assert!(text.contains("标题"));
        assert!(text.contains("这是一段正文内容"));
    }
}


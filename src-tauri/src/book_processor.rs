//! 书籍处理模块
//! 负责 EPUB 解压、元数据提取、封面提取、索引建立等

use crate::models::{CreateSourceRequest, Source, SourceMetadata, SourceType};
use crate::state::AppState;
use roxmltree::Document;
use std::collections::HashMap;
use std::fs;
use std::io::{BufReader, Read, Seek};
use std::path::Path;
use thiserror::Error;
use zip::ZipArchive;

#[derive(Error, Debug)]
pub enum BookProcessorError {
    #[error("文件读取失败: {0}")]
    IoError(#[from] std::io::Error),
    #[error("ZIP 解压失败: {0}")]
    ZipError(#[from] zip::result::ZipError),
    #[error("ROXML 解析失败: {0}")]
    RoxmlError(#[from] roxmltree::Error),
    #[error("图片处理失败: {0}")]
    ImageError(#[from] image::ImageError),
    #[error("未找到 content.opf 文件")]
    MissingOpf,
    #[error("未找到封面")]
    MissingCover,
    #[error("数据库错误: {0}")]
    DatabaseError(String),
}

/// EPUB 元数据
#[derive(Debug, Clone)]
pub struct EpubMetadata {
    pub title: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub publish_date: Option<String>,
    pub isbn: Option<String>,
    pub cover_path: Option<String>,
    pub spine: Vec<SpineItem>,
}

/// 目录项
#[derive(Debug, Clone)]
pub struct SpineItem {
    pub idref: String,
    pub href: String,
    pub title: Option<String>,
}

/// 处理 EPUB 文件
pub struct BookProcessor;

impl BookProcessor {
    /// 导入书籍：解压、提取元数据、提取封面、建立索引、存入数据库
    pub fn import_book(
        file_path: &Path,
        state: &AppState,
    ) -> Result<Source, BookProcessorError> {
        // 1. 打开 ZIP 文件
        let file = fs::File::open(file_path)?;
        let mut archive = ZipArchive::new(BufReader::new(file))?;

        // 2. 查找并解析 content.opf
        let opf_content = Self::find_and_read_opf(&mut archive)?;
        let metadata = Self::parse_opf(&opf_content, &mut archive)?;

        // 3. 提取封面并生成缩略图
        let cover_path = if let Some(cover_ref) = &metadata.cover_path {
            Self::extract_cover(&mut archive, cover_ref, state)?
        } else {
            None
        };

        // 4. 保存文件到 sources/epub
        let vault_path = state
            .vault_path
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| BookProcessorError::DatabaseError("Vault not initialized".to_string()))?;

        let epub_dir = vault_path.join("sources").join("epub");
        if !epub_dir.exists() {
            fs::create_dir_all(&epub_dir)?;
        }

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("book.epub");
        let dest_path = epub_dir.join(file_name);
        fs::copy(file_path, &dest_path)?;

        let relative_path = dest_path
            .strip_prefix(&vault_path)
            .map_err(|e| {
                BookProcessorError::IoError(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Failed to compute relative path: {}", e),
                ))
            })?
            .to_string_lossy()
            .to_string();

        // 5. 创建 Source 记录
        let source_metadata = SourceMetadata {
            isbn: metadata.isbn.clone(),
            publisher: metadata.publisher.clone(),
            publish_date: metadata.publish_date.clone(),
            page_count: Some(metadata.spine.len() as i32),
            duration: None,
            last_page: None,
            last_cfi: None,
        };

        let create_req = CreateSourceRequest {
            source_type: SourceType::Book,
            title: metadata.title.clone(),
            author: metadata.author.clone(),
            url: Some(relative_path),
            cover: cover_path,
            description: metadata.description.clone(),
            tags: vec![],
        };

        // 使用 services 层创建 source（异步）
        let create_req_clone = create_req.clone();
        let services = state.get_services()
            .ok_or_else(|| BookProcessorError::DatabaseError("Vault not initialized".to_string()))?;
        let source = tokio::runtime::Handle::try_current()
            .map(|handle| {
                handle.block_on(async {
                    services
                        .source
                        .create(create_req_clone)
                        .await
                        .map_err(|e| BookProcessorError::DatabaseError(e.to_string()))
                })
            })
            .unwrap_or_else(|_| {
                // 如果没有运行时，创建一个新的
                tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(async {
                        services
                            .source
                            .create(create_req)
                            .await
                            .map_err(|e| BookProcessorError::DatabaseError(e.to_string()))
                    })
            })?;

        // 6. 更新 metadata
        let update_req = crate::models::UpdateSourceRequest {
            title: None,
            author: None,
            url: None,
            cover: None,
            description: None,
            tags: None,
            progress: None,
            last_read_at: None,
            metadata: Some(source_metadata),
        };

        let update_req_clone = update_req.clone();
        let services2 = state.get_services()
            .ok_or_else(|| BookProcessorError::DatabaseError("Vault not initialized".to_string()))?;
        tokio::runtime::Handle::try_current()
            .map(|handle| {
                handle.block_on(async {
                    services2
                        .source
                        .update(&source.id, update_req_clone)
                        .await
                        .map_err(|e| BookProcessorError::DatabaseError(e.to_string()))
                })
            })
            .unwrap_or_else(|_| {
                tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(async {
                        services2
                            .source
                            .update(&source.id, update_req)
                            .await
                            .map_err(|e| BookProcessorError::DatabaseError(e.to_string()))
                    })
            })?;

        // 7. 建立搜索索引（异步后台任务）
        // 注意：索引功能需要扩展 Indexer 以支持书籍内容，暂时跳过
        // let source_id = source.id.clone();
        // let book_path = dest_path.clone();
        // let indexer_clone = state.indexer.clone();
        // 
        // tokio::spawn(async move {
        //     if let Ok(indexer_opt) = indexer_clone.lock() {
        //         if let Some(indexer) = indexer_opt.as_ref() {
        //             if let Err(e) = Self::index_book_content(&book_path, &source_id, indexer).await {
        //                 eprintln!("Failed to index book content: {}", e);
        //             }
        //         }
        //     }
        // });

        Ok(source)
    }

    /// 查找并读取 content.opf 文件
    fn find_and_read_opf<R: Read + Seek>(
        archive: &mut ZipArchive<R>,
    ) -> Result<String, BookProcessorError> {
        // 首先查找 META-INF/container.xml
        let opf_path = {
            let mut container_xml = archive
                .by_name("META-INF/container.xml")
                .map_err(|_| BookProcessorError::MissingOpf)?;

            let mut container_content = String::new();
            container_xml.read_to_string(&mut container_content)?;

            // 使用 roxmltree 解析 container.xml
            let doc = Document::parse(&container_content)?;
            let root = doc.root_element();

            // 查找 rootfile 元素
            root
                .descendants()
                .find(|n| n.tag_name().name() == "rootfile")
                .and_then(|n| n.attribute("full-path"))
                .ok_or(BookProcessorError::MissingOpf)?
                .to_string()
        };

        // 读取 OPF 文件（container_xml 已释放）
        let mut opf_file = archive.by_name(&opf_path)?;
        let mut opf_content = String::new();
        opf_file.read_to_string(&mut opf_content)?;

        Ok(opf_content)
    }

    /// 解析 OPF 文件提取元数据
    fn parse_opf<R: Read + Seek>(
        opf_content: &str,
        _archive: &mut ZipArchive<R>,
    ) -> Result<EpubMetadata, BookProcessorError> {
        let doc = Document::parse(opf_content)?;
        let root = doc.root_element();

        // 解析元数据
        let mut metadata = EpubMetadata {
            title: String::new(),
            author: None,
            description: None,
            publisher: None,
            publish_date: None,
            isbn: None,
            cover_path: None,
            spine: vec![],
        };

        // 查找 metadata 节点
        if let Some(metadata_node) = root
            .descendants()
            .find(|n| n.tag_name().name() == "metadata")
        {
            // 提取标题
            if let Some(title_node) = metadata_node
                .descendants()
                .find(|n| n.tag_name().name() == "title")
            {
                metadata.title = title_node.text().unwrap_or("").trim().to_string();
            }

            // 提取作者
            if let Some(creator_node) = metadata_node
                .descendants()
                .find(|n| n.tag_name().name() == "creator")
            {
                metadata.author = creator_node.text().map(|s| s.trim().to_string());
            }

            // 提取描述
            if let Some(desc_node) = metadata_node
                .descendants()
                .find(|n| n.tag_name().name() == "description")
            {
                metadata.description = desc_node.text().map(|s| s.trim().to_string());
            }

            // 提取出版商
            if let Some(pub_node) = metadata_node
                .descendants()
                .find(|n| n.tag_name().name() == "publisher")
            {
                metadata.publisher = pub_node.text().map(|s| s.trim().to_string());
            }

            // 提取出版日期
            if let Some(date_node) = metadata_node
                .descendants()
                .find(|n| n.tag_name().name() == "date")
            {
                metadata.publish_date = date_node.text().map(|s| s.trim().to_string());
            }

            // 提取 ISBN
            if let Some(identifier_node) = metadata_node
                .descendants()
                .find(|n| {
                    n.tag_name().name() == "identifier"
                        && n.attribute("scheme")
                            .map(|s| s.to_lowercase())
                            .unwrap_or_default()
                            .contains("isbn")
                })
            {
                metadata.isbn = identifier_node.text().map(|s| s.trim().to_string());
            }

            // 查找封面
            if let Some(cover_meta) = metadata_node
                .descendants()
                .find(|n| {
                    n.tag_name().name() == "meta"
                        && n.attribute("name").map(|s| s == "cover") == Some(true)
                })
            {
                if let Some(cover_id) = cover_meta.attribute("content") {
                    // 在 manifest 中查找封面文件路径
                    if let Some(manifest_node) = root
                        .descendants()
                        .find(|n| n.tag_name().name() == "manifest")
                    {
                        if let Some(item_node) = manifest_node
                            .descendants()
                            .find(|n| {
                                n.tag_name().name() == "item"
                                    && n.attribute("id") == Some(cover_id)
                            })
                        {
                            metadata.cover_path = item_node.attribute("href").map(|s| s.to_string());
                        }
                    }
                }
            }
        }

        // 解析 spine（目录）
        if let Some(spine_node) = root
            .descendants()
            .find(|n| n.tag_name().name() == "spine")
        {
            let manifest_items: HashMap<String, String> = root
                .descendants()
                .find(|n| n.tag_name().name() == "manifest")
                .map(|manifest| {
                    manifest
                        .descendants()
                        .filter(|n| n.tag_name().name() == "item")
                        .filter_map(|item| {
                            let id = item.attribute("id")?;
                            let href = item.attribute("href")?;
                            Some((id.to_string(), href.to_string()))
                        })
                        .collect()
                })
                .unwrap_or_default();

            let toc_items: HashMap<String, String> = root
                .descendants()
                .find(|n| n.tag_name().name() == "guide")
                .map(|guide| {
                    guide
                        .descendants()
                        .filter(|n| n.tag_name().name() == "reference")
                        .filter_map(|ref_node| {
                            let title = ref_node.attribute("title")?;
                            let href = ref_node.attribute("href")?;
                            Some((href.to_string(), title.to_string()))
                        })
                        .collect()
                })
                .unwrap_or_default();

            for itemref in spine_node.descendants().filter(|n| n.tag_name().name() == "itemref") {
                if let Some(idref) = itemref.attribute("idref") {
                    if let Some(href) = manifest_items.get(idref) {
                        let title = toc_items.get(href).cloned();
                        metadata.spine.push(SpineItem {
                            idref: idref.to_string(),
                            href: href.clone(),
                            title,
                        });
                    }
                }
            }
        }

        // 如果标题为空，使用文件名
        if metadata.title.is_empty() {
            metadata.title = "Untitled Book".to_string();
        }

        Ok(metadata)
    }

    /// 提取封面并生成缩略图
    fn extract_cover<R: Read + Seek>(
        archive: &mut ZipArchive<R>,
        cover_path: &str,
        state: &AppState,
    ) -> Result<Option<String>, BookProcessorError> {
        let vault_path = state
            .vault_path
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| BookProcessorError::DatabaseError("Vault not initialized".to_string()))?;

        let thumbnails_dir = vault_path.join("derived").join("thumbnails");
        if !thumbnails_dir.exists() {
            fs::create_dir_all(&thumbnails_dir)?;
        }

        // 读取封面文件
        let mut cover_file = archive.by_name(cover_path)?;
        let mut cover_data = Vec::new();
        cover_file.read_to_end(&mut cover_data)?;

        // 解码图片
        let img = image::load_from_memory(&cover_data)?;
        
        // 生成缩略图（最大 300x300）
        let thumbnail = img.thumbnail(300, 300);
        
        // 保存为 WebP 格式
        let cover_id = uuid::Uuid::new_v4().to_string();
        let thumbnail_path = thumbnails_dir.join(format!("{}.webp", cover_id));
        
        thumbnail.save_with_format(&thumbnail_path, image::ImageFormat::WebP)?;

        // 返回相对路径
        let relative_path = thumbnail_path
            .strip_prefix(&vault_path)
            .map_err(|e| {
                BookProcessorError::IoError(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Failed to compute relative path: {}", e),
                ))
            })?
            .to_string_lossy()
            .to_string();

        Ok(Some(relative_path))
    }

    /// 为书籍内容建立搜索索引
    /// 注意：需要扩展 Indexer 以支持书籍内容索引，暂时不实现
    #[allow(dead_code)]
    async fn index_book_content(
        _book_path: &Path,
        _source_id: &str,
        _indexer: &crate::search::Indexer,
    ) -> Result<(), BookProcessorError> {
        // TODO: 实现书籍内容索引
        // 1. 提取所有 HTML 文件的文本内容
        // 2. 使用 ammonia 清理 HTML
        // 3. 提取纯文本
        // 4. 添加到搜索索引
        Ok(())
    }

    /// 提取章节内容（流式读取并清理）
    pub fn extract_chapter_content(
        book_path: &Path,
        chapter_href: &str,
    ) -> Result<String, BookProcessorError> {
        let file = fs::File::open(book_path)?;
        let mut archive = ZipArchive::new(BufReader::new(file))?;

        // 读取章节文件
        let mut chapter_file = archive.by_name(chapter_href)?;
        let mut content = String::new();
        chapter_file.read_to_string(&mut content)?;

        // 使用 ammonia 清理 HTML（防止 XSS）
        let cleaned = ammonia::clean(&content);

        Ok(cleaned)
    }
}


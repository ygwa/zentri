use crate::models::{Card, CardListItem, CardType, Frontmatter};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use uuid::Uuid;
use regex::Regex;

/// 解析 Markdown 文件，提取 Frontmatter 和正文
fn parse_markdown(content: &str) -> (Option<Frontmatter>, String) {
    let frontmatter_regex = Regex::new(r"^---\s*\n([\s\S]*?)\n---\s*\n?").unwrap();
    
    if let Some(caps) = frontmatter_regex.captures(content) {
        let yaml_str = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let frontmatter: Option<Frontmatter> = serde_yaml::from_str(yaml_str).ok();
        let body = frontmatter_regex.replace(content, "").to_string();
        (frontmatter, body.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

/// 从路径推断卡片类型
fn infer_card_type(path: &Path) -> CardType {
    let path_str = path.to_string_lossy().to_lowercase();
    
    if path_str.contains("inbox") || path_str.contains("00_") {
        CardType::Fleeting
    } else if path_str.contains("reference") || path_str.contains("10_") {
        CardType::Literature
    } else if path_str.contains("slipbox") || path_str.contains("20_") {
        CardType::Permanent
    } else if path_str.contains("project") || path_str.contains("30_") {
        CardType::Project
    } else {
        CardType::Fleeting
    }
}

/// 提取 [[wikilinks]]
fn extract_wikilinks(content: &str) -> Vec<String> {
    let link_regex = Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap();
    link_regex
        .captures_iter(content)
        .map(|cap| cap.get(1).unwrap().as_str().trim().to_string())
        .collect()
}

/// 生成预览文本 (前 200 字符)
fn generate_preview(content: &str) -> Option<String> {
    let clean = content
        .lines()
        .filter(|line| !line.starts_with('#') && !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    
    if clean.is_empty() {
        None
    } else if clean.len() > 200 {
        Some(format!("{}...", &clean[..200]))
    } else {
        Some(clean)
    }
}

/// 读取单个 Markdown 文件
pub fn read_card(file_path: &Path, vault_path: &Path) -> Option<Card> {
    let content = fs::read_to_string(file_path).ok()?;
    let metadata = fs::metadata(file_path).ok()?;
    
    let (frontmatter, body) = parse_markdown(&content);
    let fm = frontmatter.unwrap_or_default();
    
    // 相对路径
    let relative_path = file_path
        .strip_prefix(vault_path)
        .unwrap_or(file_path)
        .to_string_lossy()
        .to_string();
    
    // 标题: frontmatter > 文件名
    let title = fm.title.unwrap_or_else(|| {
        file_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "无标题".to_string())
    });
    
    // 卡片类型
    let card_type = fm
        .card_type
        .and_then(|t| match t.to_lowercase().as_str() {
            "fleeting" => Some(CardType::Fleeting),
            "literature" => Some(CardType::Literature),
            "permanent" => Some(CardType::Permanent),
            "project" => Some(CardType::Project),
            _ => None,
        })
        .unwrap_or_else(|| infer_card_type(file_path));
    
    // 时间戳
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    
    let created_at = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(modified_at);
    
    // WikiLinks
    let links = extract_wikilinks(&body);
    
    Some(Card {
        id: Uuid::new_v4().to_string(),
        path: relative_path,
        title,
        tags: fm.tags,
        card_type,
        content: body.clone(),
        preview: generate_preview(&body),
        created_at,
        modified_at,
        aliases: fm.aliases,
        links,
        source_id: fm.source_id,
    })
}

/// 读取整个 Vault 目录
pub fn read_vault(vault_path: &Path) -> Vec<CardListItem> {
    let mut cards = Vec::new();
    
    for entry in WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // 只处理 .md 文件，忽略隐藏文件和目录
        if path.is_file()
            && path.extension().map(|e| e == "md").unwrap_or(false)
            && !path
                .components()
                .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
        {
            if let Some(card) = read_card(path, vault_path) {
                cards.push(card.into());
            }
        }
    }
    
    // 按修改时间倒序
    cards.sort_by(|a: &CardListItem, b: &CardListItem| b.modified_at.cmp(&a.modified_at));
    
    cards
}

/// 保存卡片到文件
pub fn save_card(vault_path: &Path, card: &Card) -> Result<(), String> {
    let file_path = vault_path.join(&card.path);
    
    // 确保目录存在
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // 构建 Frontmatter
    let frontmatter = Frontmatter {
        title: Some(card.title.clone()),
        tags: card.tags.clone(),
        card_type: Some(card.card_type.as_str().to_string()),
        aliases: card.aliases.clone(),
        created: None,
        modified: None,
        source_id: card.source_id.clone(),
    };
    
    let yaml = serde_yaml::to_string(&frontmatter).map_err(|e| e.to_string())?;
    let content = format!("---\n{}---\n\n{}", yaml, card.content);
    
    // 原子写入 (先写临时文件再重命名)
    let tmp_path = file_path.with_extension("md.tmp");
    fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &file_path).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 创建新卡片
pub fn create_card(vault_path: &Path, card_type: CardType, title: &str) -> Result<Card, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    
    // 根据类型决定目录
    let dir = match card_type {
        CardType::Fleeting => "00_Inbox",
        CardType::Literature => "10_References",
        CardType::Permanent => "20_Slipbox",
        CardType::Project => "30_Projects",
    };
    
    // 生成文件名
    let safe_title = title
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect::<String>()
        .trim()
        .to_string();
    let filename = if safe_title.is_empty() {
        format!("{}.md", Uuid::new_v4())
    } else {
        format!("{}.md", safe_title)
    };
    
    let relative_path = format!("{}/{}", dir, filename);
    
    let card = Card {
        id: Uuid::new_v4().to_string(),
        path: relative_path,
        title: title.to_string(),
        tags: vec![],
        card_type,
        content: String::new(),
        preview: None,
        created_at: now,
        modified_at: now,
        aliases: vec![],
        links: vec![],
        source_id: None,
    };
    
    save_card(vault_path, &card)?;
    
    Ok(card)
}


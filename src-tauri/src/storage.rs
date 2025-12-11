//! 数据存储模块
//! 使用纯 JSON 文件存储，按类型分目录组织

use crate::models::{Card, CardListItem, CardType};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// 类型目录名称
const DIR_INBOX: &str = "00_Inbox";
const DIR_LITERATURE: &str = "10_Literature";
const DIR_SLIPBOX: &str = "20_Slipbox";
const DIR_PROJECTS: &str = "30_Projects";

/// 生成短 ID (类似 nanoid)
fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let random: u32 = rand::random();
    format!("{:x}{:x}", (timestamp % 0xFFFFFF) as u32, random % 0xFFFF)
}

/// 根据卡片类型获取目录名
fn get_type_dir(card_type: &CardType) -> &'static str {
    match card_type {
        CardType::Fleeting => DIR_INBOX,
        CardType::Literature => DIR_LITERATURE,
        CardType::Permanent => DIR_SLIPBOX,
        CardType::Project => DIR_PROJECTS,
    }
}

/// 所有类型目录列表
fn all_type_dirs() -> Vec<&'static str> {
    vec![DIR_INBOX, DIR_LITERATURE, DIR_SLIPBOX, DIR_PROJECTS]
}

/// 卡片存储格式 (v2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardStorageV2 {
    pub id: String,
    #[serde(default = "default_version")]
    pub version: u32,
    pub title: String,
    #[serde(rename = "type")]
    pub card_type: CardType,
    /// TipTap JSON 内容
    pub content: JsonValue,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_version() -> u32 {
    1
}

/// 索引文件中的卡片元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardIndexEntry {
    pub title: String,
    #[serde(rename = "type")]
    pub card_type: CardType,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub source_id: Option<String>,
    pub updated_at: i64,
}

/// 索引文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageIndex {
    #[serde(default = "default_version")]
    pub version: u32,
    pub last_updated: i64,
    #[serde(default)]
    pub cards: HashMap<String, CardIndexEntry>,
}

/// 确保存储目录结构存在
pub fn ensure_storage_dirs(data_path: &Path) -> Result<(), String> {
    // 创建类型子目录
    for type_dir in all_type_dirs() {
        let path = data_path.join("cards").join(type_dir);
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }
    
    // 创建其他目录
    for dir in ["sources", "files", "highlights"] {
        let path = data_path.join(dir);
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }
    
    // 确保 config.json 存在
    let config_path = data_path.join("config.json");
    if !config_path.exists() {
        let config = serde_json::json!({
            "version": 1,
            "dataVersion": "2.0.0",
            "createdAt": current_timestamp(),
            "settings": {
                "defaultCardType": "fleeting",
                "autoSaveInterval": 5000
            }
        });
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(&config_path, content).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// 获取当前时间戳
fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

/// 读取索引文件
pub fn read_index(data_path: &Path) -> StorageIndex {
    let index_path = data_path.join("index.json");
    
    if index_path.exists() {
        if let Ok(content) = fs::read_to_string(&index_path) {
            if let Ok(index) = serde_json::from_str(&content) {
                return index;
            }
        }
    }
    
    StorageIndex::default()
}

/// 保存索引文件
pub fn save_index(data_path: &Path, index: &StorageIndex) -> Result<(), String> {
    let index_path = data_path.join("index.json");
    let content = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    
    let tmp_path = index_path.with_extension("json.tmp");
    fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &index_path).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 根据 ID 查找卡片文件路径（遍历所有类型目录）
fn find_card_path(data_path: &Path, id: &str) -> Option<PathBuf> {
    let filename = format!("{}.json", id);
    
    for type_dir in all_type_dirs() {
        let path = data_path.join("cards").join(type_dir).join(&filename);
        if path.exists() {
            return Some(path);
        }
    }
    
    // 兼容：直接在 cards 目录下查找
    let direct_path = data_path.join("cards").join(&filename);
    if direct_path.exists() {
        return Some(direct_path);
    }
    
    None
}

/// 构建卡片文件路径
fn build_card_path(data_path: &Path, id: &str, card_type: &CardType) -> PathBuf {
    let type_dir = get_type_dir(card_type);
    data_path.join("cards").join(type_dir).join(format!("{}.json", id))
}

/// 从 JSON 内容中提取 wiki links
fn extract_links_from_content(content: &JsonValue) -> Vec<String> {
    let mut links = Vec::new();
    extract_links_recursive(content, &mut links);
    links
}

fn extract_links_recursive(node: &JsonValue, links: &mut Vec<String>) {
    if let Some(obj) = node.as_object() {
        if let Some(node_type) = obj.get("type").and_then(|t| t.as_str()) {
            if node_type == "wikiLink" {
                if let Some(attrs) = obj.get("attrs").and_then(|a| a.as_object()) {
                    if let Some(href) = attrs.get("href").and_then(|h| h.as_str()) {
                        if !href.is_empty() && !links.contains(&href.to_string()) {
                            links.push(href.to_string());
                        }
                    }
                }
            }
        }
        
        if let Some(content) = obj.get("content").and_then(|c| c.as_array()) {
            for child in content {
                extract_links_recursive(child, links);
            }
        }
    }
}

/// 从 JSON 内容中生成预览文本
fn generate_preview_from_content(content: &JsonValue, max_length: usize) -> Option<String> {
    let mut text = String::new();
    extract_text_recursive(content, &mut text);
    
    let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
    
    if cleaned.is_empty() {
        None
    } else if cleaned.len() > max_length {
        Some(format!("{}...", cleaned.chars().take(max_length).collect::<String>()))
    } else {
        Some(cleaned)
    }
}

fn extract_text_recursive(node: &JsonValue, text: &mut String) {
    if let Some(obj) = node.as_object() {
        if let Some(t) = obj.get("text").and_then(|t| t.as_str()) {
            text.push_str(t);
        }
        
        if let Some(node_type) = obj.get("type").and_then(|t| t.as_str()) {
            if node_type == "wikiLink" {
                if let Some(attrs) = obj.get("attrs").and_then(|a| a.as_object()) {
                    if let Some(title) = attrs.get("title").and_then(|t| t.as_str()) {
                        text.push_str(" → ");
                        text.push_str(title);
                    }
                }
            }
        }
        
        if let Some(content) = obj.get("content").and_then(|c| c.as_array()) {
            for child in content {
                extract_text_recursive(child, text);
            }
            if let Some(node_type) = obj.get("type").and_then(|t| t.as_str()) {
                if matches!(node_type, "paragraph" | "heading" | "listItem" | "blockquote") {
                    text.push(' ');
                }
            }
        }
    }
}

/// 读取单个卡片
pub fn read_card(data_path: &Path, id: &str) -> Option<Card> {
    let card_path = find_card_path(data_path, id)?;
    
    let content = fs::read_to_string(&card_path).ok()?;
    let storage: CardStorageV2 = serde_json::from_str(&content).ok()?;
    
    let content_str = serde_json::to_string(&storage.content).unwrap_or_default();
    let preview = generate_preview_from_content(&storage.content, 200);
    
    // 计算相对路径
    let type_dir = get_type_dir(&storage.card_type);
    let path = format!("cards/{}/{}.json", type_dir, storage.id);
    
    Some(Card {
        id: storage.id.clone(),
        path,
        title: storage.title,
        tags: storage.tags,
        card_type: storage.card_type,
        content: content_str,
        preview,
        created_at: storage.created_at,
        modified_at: storage.updated_at,
        aliases: storage.aliases,
        links: storage.links,
        source_id: storage.source_id,
    })
}

/// 读取所有卡片列表
pub fn read_all_cards(data_path: &Path) -> Vec<CardListItem> {
    let mut cards = Vec::new();
    let cards_dir = data_path.join("cards");
    
    if !cards_dir.exists() {
        return cards;
    }
    
    let index = read_index(data_path);
    
    // 遍历所有类型目录
    for type_dir in all_type_dirs() {
        let dir_path = cards_dir.join(type_dir);
        if !dir_path.exists() {
            continue;
        }
        
        for entry in fs::read_dir(&dir_path).into_iter().flatten().flatten() {
            let path = entry.path();
            
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Some(id) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(index_entry) = index.cards.get(id) {
                        let card_path = format!("cards/{}/{}.json", type_dir, id);
                        cards.push(CardListItem {
                            id: id.to_string(),
                            path: card_path,
                            title: index_entry.title.clone(),
                            tags: index_entry.tags.clone(),
                            card_type: index_entry.card_type.clone(),
                            preview: None,
                            created_at: 0,
                            modified_at: index_entry.updated_at,
                            aliases: vec![],
                            links: index_entry.links.clone(),
                            source_id: index_entry.source_id.clone(),
                        });
                    } else {
                        if let Some(card) = read_card(data_path, id) {
                            cards.push(card.into());
                        }
                    }
                }
            }
        }
    }
    
    cards.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    
    cards
}

/// 创建新卡片
pub fn create_card(data_path: &Path, card_type: CardType, title: &str, source_id: Option<&str>) -> Result<Card, String> {
    let id = generate_id();
    let now = current_timestamp();
    
    let empty_content = serde_json::json!({
        "type": "doc",
        "content": [{ "type": "paragraph" }]
    });
    
    let storage = CardStorageV2 {
        id: id.clone(),
        version: 1,
        title: title.to_string(),
        card_type: card_type.clone(),
        content: empty_content.clone(),
        tags: vec![],
        links: vec![],
        source_id: source_id.map(String::from),
        aliases: vec![],
        created_at: now,
        updated_at: now,
    };
    
    // 确保目录存在
    let type_dir = get_type_dir(&card_type);
    let dir_path = data_path.join("cards").join(type_dir);
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }
    
    // 保存卡片文件
    let card_path = build_card_path(data_path, &id, &card_type);
    let content = serde_json::to_string_pretty(&storage).map_err(|e| e.to_string())?;
    
    let tmp_path = card_path.with_extension("json.tmp");
    fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &card_path).map_err(|e| e.to_string())?;
    
    // 更新索引
    let mut index = read_index(data_path);
    index.cards.insert(id.clone(), CardIndexEntry {
        title: title.to_string(),
        card_type: card_type.clone(),
        tags: vec![],
        links: vec![],
        source_id: source_id.map(String::from),
        updated_at: now,
    });
    index.last_updated = now;
    save_index(data_path, &index)?;
    
    let content_str = serde_json::to_string(&empty_content).unwrap_or_default();
    let path = format!("cards/{}/{}.json", type_dir, id);
    
    Ok(Card {
        id: id.clone(),
        path,
        title: title.to_string(),
        tags: vec![],
        card_type,
        content: content_str,
        preview: None,
        created_at: now,
        modified_at: now,
        aliases: vec![],
        links: vec![],
        source_id: source_id.map(String::from),
    })
}

/// 更新卡片
pub fn update_card(
    data_path: &Path,
    id: &str,
    title: Option<&str>,
    content: Option<&str>,
    tags: Option<Vec<String>>,
    card_type: Option<CardType>,
) -> Result<(), String> {
    let old_path = find_card_path(data_path, id)
        .ok_or_else(|| format!("Card not found: {}", id))?;
    
    // 读取现有卡片
    let file_content = fs::read_to_string(&old_path).map_err(|e| e.to_string())?;
    let mut storage: CardStorageV2 = serde_json::from_str(&file_content).map_err(|e| e.to_string())?;
    
    let old_type = storage.card_type.clone();
    
    // 更新字段
    if let Some(t) = title {
        storage.title = t.to_string();
    }
    
    if let Some(c) = content {
        if let Ok(json_content) = serde_json::from_str::<JsonValue>(c) {
            storage.content = json_content.clone();
            storage.links = extract_links_from_content(&json_content);
        } else {
            storage.content = serde_json::json!({
                "type": "doc",
                "content": [{
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": c }]
                }]
            });
            storage.links = vec![];
        }
    }
    
    if let Some(t) = tags {
        storage.tags = t;
    }
    
    if let Some(ct) = card_type {
        storage.card_type = ct;
    }
    
    let now = current_timestamp();
    storage.updated_at = now;
    
    // 如果类型变更，需要移动文件
    let new_path = if storage.card_type != old_type {
        let new_path = build_card_path(data_path, id, &storage.card_type);
        
        // 确保新目录存在
        if let Some(parent) = new_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        
        Some(new_path)
    } else {
        None
    };
    
    // 保存卡片
    let save_path = new_path.as_ref().unwrap_or(&old_path);
    let new_content = serde_json::to_string_pretty(&storage).map_err(|e| e.to_string())?;
    let tmp_path = save_path.with_extension("json.tmp");
    fs::write(&tmp_path, &new_content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, save_path).map_err(|e| e.to_string())?;
    
    // 如果移动了文件，删除旧文件
    if new_path.is_some() && old_path.exists() {
        fs::remove_file(&old_path).ok();
    }
    
    // 更新索引
    let mut index = read_index(data_path);
    index.cards.insert(id.to_string(), CardIndexEntry {
        title: storage.title.clone(),
        card_type: storage.card_type.clone(),
        tags: storage.tags.clone(),
        links: storage.links.clone(),
        source_id: storage.source_id.clone(),
        updated_at: now,
    });
    index.last_updated = now;
    save_index(data_path, &index)?;
    
    Ok(())
}

/// 删除卡片
pub fn delete_card(data_path: &Path, id: &str) -> Result<(), String> {
    if let Some(card_path) = find_card_path(data_path, id) {
        fs::remove_file(&card_path).map_err(|e| e.to_string())?;
    }
    
    // 更新索引
    let mut index = read_index(data_path);
    index.cards.remove(id);
    index.last_updated = current_timestamp();
    save_index(data_path, &index)?;
    
    Ok(())
}

/// 重建索引（全量扫描）
#[allow(dead_code)]
pub fn rebuild_index(data_path: &Path) -> Result<StorageIndex, String> {
    let mut index = StorageIndex {
        version: 1,
        last_updated: current_timestamp(),
        cards: HashMap::new(),
    };
    
    let cards_dir = data_path.join("cards");
    if !cards_dir.exists() {
        return Ok(index);
    }
    
    // 遍历所有类型目录
    for type_dir in all_type_dirs() {
        let dir_path = cards_dir.join(type_dir);
        if !dir_path.exists() {
            continue;
        }
        
        for entry in fs::read_dir(&dir_path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(storage) = serde_json::from_str::<CardStorageV2>(&content) {
                        index.cards.insert(storage.id.clone(), CardIndexEntry {
                            title: storage.title,
                            card_type: storage.card_type,
                            tags: storage.tags,
                            links: storage.links,
                            source_id: storage.source_id,
                            updated_at: storage.updated_at,
                        });
                    }
                }
            }
        }
    }
    
    save_index(data_path, &index)?;
    
    Ok(index)
}

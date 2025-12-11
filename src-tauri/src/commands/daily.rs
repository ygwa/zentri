//! Daily Note 相关命令

use crate::storage;
use crate::models::{Card, CardListItem, CardType};
use crate::state::AppState;
use tauri::State;

/// 获取或创建今日日记
#[tauri::command]
pub fn get_or_create_daily_note(state: State<AppState>) -> Result<Card, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 确保存储目录存在
    storage::ensure_storage_dirs(&vault_path)?;

    // 生成今日日期格式的 ID
    let today = chrono::Local::now();
    let date_str = today.format("%Y-%m-%d").to_string();
    let daily_id = format!("daily-{}", date_str);
    
    // 检查是否已存在
    if let Some(card) = storage::read_card(&vault_path, &daily_id) {
        return Ok(card);
    }

    // 创建新的日记卡片
    let title = format!("日记 {}", date_str);
    
    // 使用带有默认内容的 JSON 创建
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    
    let content = serde_json::json!({
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": { "level": 1 },
                "content": [{ "type": "text", "text": today.format("%Y年%m月%d日 %A").to_string() }]
            },
            {
                "type": "heading",
                "attrs": { "level": 2 },
                "content": [{ "type": "text", "text": "今日待办" }]
            },
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": { "checked": false },
                        "content": [{ "type": "paragraph" }]
                    }
                ]
            },
            {
                "type": "heading",
                "attrs": { "level": 2 },
                "content": [{ "type": "text", "text": "笔记" }]
            },
            { "type": "paragraph" }
        ]
    });

    // 直接写入 JSON 文件
    let storage_data = serde_json::json!({
        "id": daily_id,
        "version": 1,
        "title": title,
        "type": "fleeting",
        "content": content,
        "tags": ["daily"],
        "links": [],
        "aliases": [date_str],
        "createdAt": now,
        "updatedAt": now
    });

    // 日记放在 00_Inbox 目录
    let card_path = vault_path.join("cards").join("00_Inbox").join(format!("{}.json", daily_id));
    let content_str = serde_json::to_string_pretty(&storage_data).map_err(|e| e.to_string())?;
    
    // 原子写入
    let tmp_path = card_path.with_extension("json.tmp");
    std::fs::write(&tmp_path, &content_str).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &card_path).map_err(|e| e.to_string())?;

    // 更新索引
    let mut index = storage::read_index(&vault_path);
    index.cards.insert(daily_id.clone(), storage::CardIndexEntry {
        title: title.clone(),
        card_type: CardType::Fleeting,
        tags: vec!["daily".to_string()],
        links: vec![],
        source_id: None,
        updated_at: now,
    });
    index.last_updated = now;
    storage::save_index(&vault_path, &index)?;

    // 读取并返回
    storage::read_card(&vault_path, &daily_id).ok_or("Failed to create daily note".to_string())
}

/// 获取指定日期的日记
#[tauri::command]
pub fn get_daily_note(state: State<AppState>, date: String) -> Result<Option<Card>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    let daily_id = format!("daily-{}", date);
    Ok(storage::read_card(&vault_path, &daily_id))
}

/// 获取日记列表（按日期倒序）
#[tauri::command]
pub fn get_daily_notes(state: State<AppState>, limit: Option<usize>) -> Result<Vec<CardListItem>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 从所有卡片中筛选日记
    let all_cards = storage::read_all_cards(&vault_path);
    let mut notes: Vec<CardListItem> = all_cards
        .into_iter()
        .filter(|c| c.id.starts_with("daily-") || c.tags.contains(&"daily".to_string()))
        .collect();

    notes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    if let Some(lim) = limit {
        notes.truncate(lim);
    }

    Ok(notes)
}

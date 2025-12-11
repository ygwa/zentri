//! Card 相关命令

use crate::storage;
use crate::models::{Card, CardListItem, CardType};
use crate::state::AppState;
use tauri::State;

/// 获取所有卡片
#[tauri::command]
pub fn get_cards(state: State<AppState>) -> Result<Vec<CardListItem>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    Ok(storage::read_all_cards(&vault_path))
}

/// 获取单个卡片
#[tauri::command]
pub fn get_card(state: State<AppState>, id: String) -> Result<Option<Card>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 安全检查
    if id.contains("..") {
        return Err("Invalid card ID".to_string());
    }

    Ok(storage::read_card(&vault_path, &id))
}

/// 获取卡片 by 路径
#[tauri::command]
pub fn get_card_by_path(state: State<AppState>, path: String) -> Result<Option<Card>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 从路径提取 ID
    if let Some(id) = path.strip_prefix("cards/").and_then(|p| p.strip_suffix(".json")) {
        Ok(storage::read_card(&vault_path, id))
    } else {
        // 尝试直接作为 ID
        Ok(storage::read_card(&vault_path, &path))
    }
}

/// 创建卡片
#[tauri::command]
pub fn create_card(
    state: State<AppState>,
    card_type: String,
    title: String,
    source_id: Option<String>,
) -> Result<Card, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    let ct = CardType::from_str(&card_type);

    // 确保存储目录存在
    storage::ensure_storage_dirs(&vault_path)?;
    
    let card = storage::create_card(&vault_path, ct, &title, source_id.as_deref())?;
    
    // 如果有 source_id，添加到 source 的 note_ids
    if let Some(ref sid) = source_id {
        state.db.add_note_to_source(sid, &card.id).ok();
    }
    
    // 更新索引
    if let Some(indexer) = state.indexer.lock().unwrap().as_ref() {
        indexer.index_doc(
            &card.id,
            &card.title,
            &card.content,
            &card.tags,
            &card.path,
            card.modified_at,
        ).ok();
    }

    Ok(card)
}

/// 更新卡片
#[tauri::command]
pub fn update_card(
    state: State<AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    card_type: Option<String>,
    _links: Option<Vec<String>>, // links 现在从 content 自动提取
) -> Result<Card, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 安全检查
    if id.contains("..") {
        return Err("Invalid card ID".to_string());
    }

    let ct = card_type.map(|s| CardType::from_str(&s));
    storage::update_card(&vault_path, &id, title.as_deref(), content.as_deref(), tags, ct)?;
    
    // 读取更新后的卡片
    let card = storage::read_card(&vault_path, &id).ok_or("Card not found after update")?;
    
    // 更新索引
    if let Some(indexer) = state.indexer.lock().unwrap().as_ref() {
        indexer.index_doc(
            &card.id,
            &card.title,
            &card.content,
            &card.tags,
            &card.path,
            card.modified_at,
        ).ok();
    }

    Ok(card)
}

/// 删除卡片
#[tauri::command]
pub fn delete_card(state: State<AppState>, id: String) -> Result<(), String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 安全检查
    if id.contains("..") {
        return Err("Invalid card ID".to_string());
    }

    storage::delete_card(&vault_path, &id)?;
    
    // 更新索引
    if let Some(indexer) = state.indexer.lock().unwrap().as_ref() {
        indexer.delete_doc(&id).ok();
    }

    Ok(())
}

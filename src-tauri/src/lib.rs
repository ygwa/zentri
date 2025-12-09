mod db;
mod fs;
mod models;

use db::Database;
use models::{
    Card, CardListItem, CardType, CreateHighlightRequest, CreateSourceRequest, Highlight, Source,
    UpdateSourceRequest,
};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// 应用状态
pub struct AppState {
    pub db: Database,
    pub vault_path: Mutex<Option<PathBuf>>,
}

// ==================== Vault 操作 ====================

/// 设置 Vault 路径
#[tauri::command]
fn set_vault_path(state: State<AppState>, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    *state.vault_path.lock().unwrap() = Some(path.clone());

    // 保存到配置
    state
        .db
        .set_config("vault_path", &path.to_string_lossy())
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取 Vault 路径
#[tauri::command]
fn get_vault_path(state: State<AppState>) -> Option<String> {
    state
        .vault_path
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
}

// ==================== Card 操作 ====================

/// 获取所有卡片
#[tauri::command]
fn get_cards(state: State<AppState>) -> Result<Vec<CardListItem>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    Ok(fs::read_vault(&vault_path))
}

/// 获取单个卡片
#[tauri::command]
fn get_card(state: State<AppState>, id: String) -> Result<Option<Card>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 遍历找到匹配的卡片
    let cards = fs::read_vault(&vault_path);
    for card_item in cards {
        if card_item.id == id {
            let file_path = vault_path.join(&card_item.path);
            return Ok(fs::read_card(&file_path, &vault_path));
        }
    }

    Ok(None)
}

/// 获取卡片 by 路径
#[tauri::command]
fn get_card_by_path(state: State<AppState>, path: String) -> Result<Option<Card>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    let file_path = vault_path.join(&path);
    Ok(fs::read_card(&file_path, &vault_path))
}

/// 创建卡片
#[tauri::command]
fn create_card(
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
    let mut card = fs::create_card(&vault_path, ct, &title)?;

    // 如果有 source_id，添加到 source 的 note_ids
    if let Some(ref sid) = source_id {
        card.source_id = Some(sid.clone());
        fs::save_card(&vault_path, &card)?;
        state.db.add_note_to_source(sid, &card.id).ok();
    }

    Ok(card)
}

/// 更新卡片
#[tauri::command]
fn update_card(
    state: State<AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    card_type: Option<String>,
    links: Option<Vec<String>>,
) -> Result<Card, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 找到卡片
    let cards = fs::read_vault(&vault_path);
    let card_item = cards
        .iter()
        .find(|c| c.id == id)
        .ok_or("Card not found")?;

    let file_path = vault_path.join(&card_item.path);
    let mut card = fs::read_card(&file_path, &vault_path).ok_or("Card not found")?;

    // 更新字段
    if let Some(t) = title {
        card.title = t;
    }
    if let Some(c) = content {
        card.content = c;
    }
    if let Some(t) = tags {
        card.tags = t;
    }
    if let Some(ct) = card_type {
        card.card_type = CardType::from_str(&ct);
    }
    if let Some(l) = links {
        card.links = l;
    }

    // 更新时间
    card.modified_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    // 保存
    fs::save_card(&vault_path, &card)?;

    Ok(card)
}

/// 删除卡片
#[tauri::command]
fn delete_card(state: State<AppState>, id: String) -> Result<(), String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    // 找到卡片
    let cards = fs::read_vault(&vault_path);
    let card_item = cards
        .iter()
        .find(|c| c.id == id)
        .ok_or("Card not found")?;

    let file_path = vault_path.join(&card_item.path);
    std::fs::remove_file(file_path).map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== Source 操作 ====================

/// 获取所有文献源
#[tauri::command]
fn get_sources(state: State<AppState>) -> Result<Vec<Source>, String> {
    state.db.get_all_sources().map_err(|e| e.to_string())
}

/// 获取单个文献源
#[tauri::command]
fn get_source(state: State<AppState>, id: String) -> Result<Option<Source>, String> {
    state.db.get_source(&id).map_err(|e| e.to_string())
}

/// 创建文献源
#[tauri::command]
fn create_source(state: State<AppState>, req: CreateSourceRequest) -> Result<Source, String> {
    state.db.create_source(req).map_err(|e| e.to_string())
}

/// 更新文献源
#[tauri::command]
fn update_source(
    state: State<AppState>,
    id: String,
    req: UpdateSourceRequest,
) -> Result<Option<Source>, String> {
    state.db.update_source(&id, req).map_err(|e| e.to_string())
}

/// 删除文献源
#[tauri::command]
fn delete_source(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_source(&id).map_err(|e| e.to_string())
}

// ==================== Highlight 操作 ====================

/// 获取文献源的高亮
#[tauri::command]
fn get_highlights_by_source(state: State<AppState>, source_id: String) -> Result<Vec<Highlight>, String> {
    state
        .db
        .get_highlights_by_source(&source_id)
        .map_err(|e| e.to_string())
}

/// 获取所有高亮
#[tauri::command]
fn get_all_highlights(state: State<AppState>) -> Result<Vec<Highlight>, String> {
    state.db.get_all_highlights().map_err(|e| e.to_string())
}

/// 创建高亮
#[tauri::command]
fn create_highlight(state: State<AppState>, req: CreateHighlightRequest) -> Result<Highlight, String> {
    state.db.create_highlight(req).map_err(|e| e.to_string())
}

/// 删除高亮
#[tauri::command]
fn delete_highlight(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_highlight(&id).map_err(|e| e.to_string())
}

// ==================== App ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 获取应用数据目录
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zentri");

    // 初始化数据库
    let db_path = app_data_dir.join("zentri.db");
    let db = Database::open(&db_path).expect("Failed to open database");

    // 尝试从配置加载 vault_path
    let vault_path = db
        .get_config("vault_path")
        .ok()
        .flatten()
        .map(PathBuf::from);

    let state = AppState {
        db,
        vault_path: Mutex::new(vault_path),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Vault
            set_vault_path,
            get_vault_path,
            // Cards
            get_cards,
            get_card,
            get_card_by_path,
            create_card,
            update_card,
            delete_card,
            // Sources
            get_sources,
            get_source,
            create_source,
            update_source,
            delete_source,
            // Highlights
            get_highlights_by_source,
            get_all_highlights,
            create_highlight,
            delete_highlight,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

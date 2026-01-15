//! Card 相关命令

use crate::models::{Card, CardType};
use crate::state::AppState;
use tauri::State;

/// 获取所有卡片（包含完整内容）
#[tauri::command]
pub async fn get_cards(state: State<'_, AppState>) -> Result<Vec<Card>, String> {
    println!("[DEBUG] command::get_cards called");
    let services = state.get_services().ok_or("Vault not initialized")?;
    let cards = services.card.get_all().await.map_err(|e| e.to_string())?;
    println!("[DEBUG] command::get_cards returning {} cards with full content", cards.len());
    Ok(cards)
}

/// 获取单个卡片
#[tauri::command]
pub async fn get_card(state: State<'_, AppState>, id: String) -> Result<Option<Card>, String> {
    println!("[DEBUG] command::get_card called with id: {}", id);
    let services = state.get_services().ok_or("Vault not initialized")?;
    let card = services.card.get_by_id(&id).await.map_err(|e| e.to_string())?;
    println!(
        "[DEBUG] command::get_card returning {:?}",
        card.as_ref().map(|c| &c.id)
    );
    Ok(card)
}

/// 获取卡片 by 路径
#[tauri::command]
pub async fn get_card_by_path(state: State<'_, AppState>, path: String) -> Result<Option<Card>, String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.card.get_by_path(&path).await.map_err(|e| e.to_string())
}

/// 创建卡片
#[tauri::command]
pub async fn create_card(
    state: State<'_, AppState>,
    card_type: String,
    title: String,
    source_id: Option<String>,
) -> Result<Card, String> {
    let ct = CardType::from_str(&card_type);

    // 使用服务层创建卡片
    let services = state.get_services().ok_or("Vault not initialized")?;
    let indexer_ref: Option<&std::sync::Mutex<Option<crate::search::Indexer>>> = Some(&state.indexer);
    services
        .card
        .create(ct, &title, None, source_id.as_deref(), indexer_ref)
        .await
        .map_err(|e| e.to_string())
}

/// 更新卡片
#[tauri::command]
pub async fn update_card(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    card_type: Option<String>,
    _links: Option<Vec<String>>, // links 现在从 content 自动提取
) -> Result<Card, String> {
    let ct = card_type.map(|s| CardType::from_str(&s));
    
    let services = state.get_services().ok_or("Vault not initialized")?;
    let indexer_ref: Option<&std::sync::Mutex<Option<crate::search::Indexer>>> = Some(&state.indexer);
    services
        .card
        .update(
            &id,
            title.as_deref(),
            content.as_deref(),
            tags,
            ct,
            indexer_ref,
        )
        .await
        .map_err(|e| e.to_string())
}

/// 删除卡片
#[tauri::command]
pub async fn delete_card(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let services = state.get_services().ok_or("Vault not initialized")?;
    let indexer_ref: Option<&std::sync::Mutex<Option<crate::search::Indexer>>> = Some(&state.indexer);
    services.card.delete(&id, indexer_ref).await.map_err(|e| e.to_string())
}

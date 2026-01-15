//! Daily Note 相关命令

use crate::models::{Card, CardListItem, CardType};
use crate::state::AppState;
use tauri::State;

/// 获取或创建今日日记
#[tauri::command]
pub async fn get_or_create_daily_note(state: State<'_, AppState>) -> Result<Card, String> {
    // 生成今日日期格式的 ID
    let today = chrono::Local::now();
    let date_str = today.format("%Y-%m-%d").to_string();
    let daily_id = format!("daily-{}", date_str);

    // 检查是否已存在
    let services = state.get_services().ok_or("Vault not initialized")?;
    if let Some(card) = services.card.get_by_id(&daily_id).await.map_err(|e| e.to_string())? {
        return Ok(card);
    }

    // 创建新的日记卡片
    let title = format!("日记 {}", date_str);

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

    let content_str = serde_json::to_string(&content).map_err(|e| e.to_string())?;

    // 使用 CardService 创建卡片，需要自定义 ID
    // 我们需要直接调用 CardRepository 来创建带自定义 ID 的卡片
    use crate::database::CardRepository;
    use crate::models::CreateCardRequest;
    
    let db = state.get_db().ok_or("Vault not initialized")?;
    let card_repo = CardRepository::new(db);
    let req = CreateCardRequest {
        id: Some(daily_id.clone()),
        title: title.clone(),
        card_type: CardType::Fleeting,
        content: content_str,
        tags: vec!["daily".to_string()],
        aliases: vec![date_str],
        source_id: None,
    };
    
    let mut card = card_repo.create(req).await.map_err(|e| e.to_string())?;
    
    // 生成虚拟路径
    if card.path.is_none() {
        card.path = Some(card.generate_path());
    }
    
    // 更新搜索索引
    if let Ok(Some(idx)) = state.indexer.lock().as_deref() {
        let path = card.path.as_ref().map(|p| p.as_str()).unwrap_or("");
        idx.index_doc_with_type(
            &card.id,
            &card.title,
            &card.plain_text,
            &card.tags,
            path,
            card.modified_at,
            Some(card.card_type.as_str()),
        )
        .ok();
    }
    
    Ok(card)
}

/// 获取指定日期的日记
#[tauri::command]
pub async fn get_daily_note(state: State<'_, AppState>, date: String) -> Result<Option<Card>, String> {
    let daily_id = format!("daily-{}", date);
    let services = state.get_services().ok_or("Vault not initialized")?;
    services.card.get_by_id(&daily_id).await.map_err(|e| e.to_string())
}

/// 获取日记列表（按日期倒序）
#[tauri::command]
pub async fn get_daily_notes(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<CardListItem>, String> {
    // 从所有卡片中筛选日记
    let services = state.get_services().ok_or("Vault not initialized")?;
    let all_cards = services.card.get_all().await.map_err(|e| e.to_string())?;
    let mut notes: Vec<CardListItem> = all_cards
        .into_iter()
        .filter(|c| c.id.starts_with("daily-") || c.tags.contains(&"daily".to_string()))
        .map(|c| c.into())
        .collect();

    notes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    if let Some(lim) = limit {
        notes.truncate(lim);
    }

    Ok(notes)
}

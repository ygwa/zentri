//! Search 相关命令
//! 提供全文搜索、模糊搜索、过滤搜索等 API

use crate::models::{CardSearchResult, CardType};
use crate::state::AppState;
use tauri::State;

/// 搜索卡片
#[tauri::command]
pub fn search_cards(state: State<AppState>, query: String) -> Result<Vec<CardSearchResult>, String> {
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref().ok_or("Indexer not initialized")?;

    let results = indexer.search_with_snippets(&query, 50)?;

    Ok(results
        .into_iter()
        .map(|r| CardSearchResult {
            id: r.id,
            title: r.title,
            score: r.score,
            snippet: r.snippet,
            card_type: r.card_type.map(|s| CardType::from_str(&s)).unwrap_or(CardType::Fleeting),
            tags: r.tags,
        })
        .collect())
}

/// 带过滤条件的搜索
#[tauri::command]
pub fn search_cards_filtered(
    state: State<AppState>,
    query: String,
    card_type: Option<String>,
    tag: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CardSearchResult>, String> {
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref().ok_or("Indexer not initialized")?;

    let results = indexer.search_with_filter(
        &query,
        limit.unwrap_or(50),
        card_type.as_deref(),
        tag.as_deref(),
    )?;

    Ok(results
        .into_iter()
        .map(|r| CardSearchResult {
            id: r.id,
            title: r.title,
            score: r.score,
            snippet: r.snippet,
            card_type: r.card_type.map(|s| CardType::from_str(&s)).unwrap_or(CardType::Fleeting),
            tags: r.tags,
        })
        .collect())
}

/// 模糊搜索 (处理拼写错误)
#[tauri::command]
pub fn fuzzy_search_cards(
    state: State<AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<CardSearchResult>, String> {
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref().ok_or("Indexer not initialized")?;

    let results = indexer.fuzzy_search(&query, limit.unwrap_or(50))?;

    Ok(results
        .into_iter()
        .map(|r| CardSearchResult {
            id: r.id,
            title: r.title,
            score: r.score,
            snippet: r.snippet,
            card_type: r.card_type.map(|s| CardType::from_str(&s)).unwrap_or(CardType::Fleeting),
            tags: r.tags,
        })
        .collect())
}

/// 按标签搜索
#[tauri::command]
pub fn search_by_tag(
    state: State<AppState>,
    tag: String,
    limit: Option<usize>,
) -> Result<Vec<CardSearchResult>, String> {
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref().ok_or("Indexer not initialized")?;

    let results = indexer.search_by_tag(&tag, limit.unwrap_or(50))?;

    Ok(results
        .into_iter()
        .map(|r| CardSearchResult {
            id: r.id,
            title: r.title,
            score: r.score,
            snippet: r.snippet,
            card_type: r.card_type.map(|s| CardType::from_str(&s)).unwrap_or(CardType::Fleeting),
            tags: r.tags,
        })
        .collect())
}

/// 按卡片类型搜索
#[tauri::command]
pub fn search_by_type(
    state: State<AppState>,
    card_type: String,
    limit: Option<usize>,
) -> Result<Vec<CardSearchResult>, String> {
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref().ok_or("Indexer not initialized")?;

    let results = indexer.search_by_type(&card_type, limit.unwrap_or(50))?;

    Ok(results
        .into_iter()
        .map(|r| CardSearchResult {
            id: r.id,
            title: r.title,
            score: r.score,
            snippet: r.snippet,
            card_type: r.card_type.map(|s| CardType::from_str(&s)).unwrap_or(CardType::Fleeting),
            tags: r.tags,
        })
        .collect())
}

/// 同步索引 (全量重建)
#[tauri::command]
pub async fn sync_index(state: State<'_, AppState>) -> Result<usize, String> {
    let indexer = {
        let indexer_guard = state.indexer.lock().unwrap();
        indexer_guard.clone().ok_or("Indexer not initialized")?
    };

    // 获取所有卡片
    let services = state.get_services().ok_or("Vault not initialized")?;
    let cards = services.card.get_all().await.map_err(|e| e.to_string())?;
    let mut count = 0;

    // 准备用于图谱重建的卡片列表
    let mut card_list = Vec::new();

    for card in cards.iter() {
        let should_index = match indexer.get_doc_mtime(&card.id) {
            Ok(Some(indexed_mtime)) => card.modified_at > indexed_mtime,
            Ok(None) => true,
            Err(_) => true,
        };

        if should_index {
            let path = card.path.as_ref().map(|p| p.as_str()).unwrap_or("");
            indexer
                .index_doc_with_type(
                    &card.id,
                    &card.title,
                    &card.plain_text, // 使用纯文本内容
                    &card.tags,
                    path,
                    card.modified_at,
                    Some(card.card_type.as_str()),
                )
                .map_err(|e| e.to_string())?;
            count += 1;
        }
        
        // 添加到图谱列表
        card_list.push(card.clone().into());
    }

    // 同时重建图谱
    if let Some(graph_engine) = state.graph_engine.lock().unwrap().as_ref() {
        graph_engine.rebuild_with_cards(card_list);
    }

    Ok(count)
}

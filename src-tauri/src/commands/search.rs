//! Search 相关命令
//! 提供全文搜索、模糊搜索、过滤搜索等 API

use crate::models::{CardSearchResult, CardType};
use crate::state::AppState;
use crate::storage;
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
    let (vault_path, indexer) = {
        let path_guard = state.vault_path.lock().unwrap();
        let path = path_guard.clone().ok_or("Vault path not set")?;

        let indexer_guard = state.indexer.lock().unwrap();
        let indexer = indexer_guard.clone().ok_or("Indexer not initialized")?;
        (path, indexer)
    };

    // 获取所有卡片
    let cards = storage::read_all_cards(&vault_path);
    let mut count = 0;

    for card_item in cards {
        // 读取完整卡片内容
        if let Some(card) = storage::read_card(&vault_path, &card_item.id) {
            let should_index = match indexer.get_doc_mtime(&card.id) {
                Ok(Some(indexed_mtime)) => card.modified_at > indexed_mtime,
                Ok(None) => true,
                Err(_) => true,
            };

            if should_index {
                indexer
                    .index_doc_with_type(
                        &card.id,
                        &card.title,
                        &card.plain_text, // 使用纯文本内容
                        &card.tags,
                        &card.path,
                        card.modified_at,
                        Some(card.card_type.as_str()),
                    )
                    .map_err(|e| e.to_string())?;
                count += 1;
            }
        }
    }

    // 同时重建图谱
    if let Some(graph_engine) = state.graph_engine.lock().unwrap().as_ref() {
        graph_engine.rebuild();
    }

    Ok(count)
}

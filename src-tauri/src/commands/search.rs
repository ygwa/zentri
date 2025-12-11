//! Search 相关命令

use crate::storage;
use crate::models::{CardSearchResult, CardType};
use crate::state::AppState;
use tauri::State;

/// 搜索卡片
#[tauri::command]
pub fn search_cards(state: State<AppState>, query: String) -> Result<Vec<CardSearchResult>, String> {
    let indexer_guard = state.indexer.lock().unwrap();
    let indexer = indexer_guard.as_ref().ok_or("Indexer not initialized")?;
    
    let results = indexer.search_with_snippets(&query, 50)?;
    
    Ok(results.into_iter().map(|r| CardSearchResult {
        id: r.id,
        title: r.title,
        score: r.score,
        snippet: r.snippet,
        card_type: CardType::Fleeting,
        tags: r.tags,
    }).collect())
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
                indexer.index_doc(
                   &card.id,
                   &card.title,
                   &card.content,
                   &card.tags,
                   &card.path,
                   card.modified_at
                ).map_err(|e| e.to_string())?;
                count += 1;
            }
        }
    }
    
    Ok(count)
}

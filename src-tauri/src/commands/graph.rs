//! Graph 相关命令
//! 提供图谱数据、反向链接、重要性排名、知识集群等 API

use crate::graph::{self, BacklinkInfo, CardImportance, GraphData, KnowledgeCluster};
use crate::state::AppState;
use crate::storage;
use tauri::State;

/// 获取完整图谱数据 (包含布局)
#[tauri::command]
pub fn get_graph_data(state: State<AppState>) -> Result<GraphData, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault path not set")?;

    let cards = storage::read_all_cards(&vault_path);
    Ok(graph::compute_layout(cards))
}

/// 获取指定卡片的反向链接
#[tauri::command]
pub fn get_backlinks(state: State<AppState>, card_id: String) -> Result<Vec<BacklinkInfo>, String> {
    let graph_engine = state
        .graph_engine
        .lock()
        .unwrap()
        .clone()
        .ok_or("Graph engine not initialized")?;

    Ok(graph_engine.get_backlinks(&card_id))
}

/// 获取卡片重要性排名 (PageRank)
#[tauri::command]
pub fn get_card_importance(
    state: State<AppState>,
    limit: Option<usize>,
) -> Result<Vec<CardImportance>, String> {
    let graph_engine = state
        .graph_engine
        .lock()
        .unwrap()
        .clone()
        .ok_or("Graph engine not initialized")?;

    Ok(graph_engine.get_importance_ranking(limit.unwrap_or(50)))
}

/// 获取知识集群 (连通分量)
#[tauri::command]
pub fn get_knowledge_clusters(state: State<AppState>) -> Result<Vec<KnowledgeCluster>, String> {
    let graph_engine = state
        .graph_engine
        .lock()
        .unwrap()
        .clone()
        .ok_or("Graph engine not initialized")?;

    Ok(graph_engine.get_clusters())
}

/// 获取孤立节点 (知识孤岛)
#[tauri::command]
pub fn get_orphan_nodes(state: State<AppState>) -> Result<Vec<String>, String> {
    let graph_engine = state
        .graph_engine
        .lock()
        .unwrap()
        .clone()
        .ok_or("Graph engine not initialized")?;

    Ok(graph_engine.get_orphan_nodes())
}

/// 重建图谱索引
#[tauri::command]
pub fn rebuild_graph(state: State<AppState>) -> Result<(), String> {
    let graph_engine = state
        .graph_engine
        .lock()
        .unwrap()
        .clone()
        .ok_or("Graph engine not initialized")?;

    graph_engine.rebuild();
    Ok(())
}

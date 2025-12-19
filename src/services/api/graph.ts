/**
 * Graph API 模块
 * 提供图谱数据、反向链接、重要性排名、知识集群等 API
 */
import { invoke } from "@tauri-apps/api/core";
import type { GraphData, BacklinkInfo, CardImportance, KnowledgeCluster } from "./types";

/**
 * 获取完整图谱数据 (包含布局、PageRank、集群)
 */
export async function getData(): Promise<GraphData> {
  return await invoke<GraphData>("get_graph_data");
}

/**
 * 获取指定卡片的反向链接
 * @param cardId 卡片 ID
 * @returns 链接到该卡片的所有卡片信息
 */
export async function getBacklinks(cardId: string): Promise<BacklinkInfo[]> {
  return await invoke<BacklinkInfo[]>("get_backlinks", { cardId });
}

/**
 * 获取卡片重要性排名 (PageRank)
 * @param limit 返回数量限制，默认 50
 */
export async function getCardImportance(limit?: number): Promise<CardImportance[]> {
  return await invoke<CardImportance[]>("get_card_importance", { limit });
}

/**
 * 获取知识集群 (连通分量)
 */
export async function getKnowledgeClusters(): Promise<KnowledgeCluster[]> {
  return await invoke<KnowledgeCluster[]>("get_knowledge_clusters");
}

/**
 * 获取孤立节点 (知识孤岛)
 * @returns 没有任何连接的卡片 ID 列表
 */
export async function getOrphanNodes(): Promise<string[]> {
  return await invoke<string[]>("get_orphan_nodes");
}

/**
 * 重建图谱索引
 */
export async function rebuild(): Promise<void> {
  return await invoke<void>("rebuild_graph");
}


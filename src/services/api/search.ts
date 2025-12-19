/**
 * Search API 模块
 * 提供全文搜索、模糊搜索、过滤搜索等功能
 */
import { invoke } from "@tauri-apps/api/core";
import type { SearchResult, SearchFilters } from "./types";

/**
 * 基础全文搜索
 */
export async function search(query: string): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_cards", { query });
}

/**
 * 带过滤条件的搜索
 * @param query 搜索关键词
 * @param filters 过滤条件 (卡片类型、标签、数量限制)
 */
export async function searchWithFilter(
  query: string,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_cards_filtered", {
    query,
    cardType: filters?.cardType,
    tag: filters?.tag,
    limit: filters?.limit,
  });
}

/**
 * 模糊搜索 (处理拼写错误)
 * @param query 搜索关键词
 * @param limit 返回数量限制
 */
export async function fuzzySearch(query: string, limit?: number): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("fuzzy_search_cards", { query, limit });
}

/**
 * 按标签搜索
 * @param tag 标签名
 * @param limit 返回数量限制
 */
export async function searchByTag(tag: string, limit?: number): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_by_tag", { tag, limit });
}

/**
 * 按卡片类型搜索
 * @param cardType 卡片类型
 * @param limit 返回数量限制
 */
export async function searchByType(cardType: string, limit?: number): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_by_type", { cardType, limit });
}

/**
 * 同步索引（全量增量扫描）
 * @returns 更新的文档数量
 */
export async function syncIndex(): Promise<number> {
  return await invoke<number>("sync_index");
}


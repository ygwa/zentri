/**
 * Search API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { SearchResult } from "./types";

/**
 * 搜索卡片
 */
export async function search(query: string): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_cards", { query });
}

/**
 * 同步索引（全量增量扫描）
 */
export async function syncIndex(): Promise<number> {
  return await invoke<number>("sync_index");
}


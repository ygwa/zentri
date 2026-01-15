/**
 * Highlight API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { CreateHighlightRequest } from "./types";
import type { Highlight } from "@/types";

/**
 * 获取所有高亮
 */
export async function getAll(): Promise<Highlight[]> {
  return await invoke<Highlight[]>("get_all_highlights");
}

/**
 * 获取指定文献源的高亮
 */
export async function getBySource(sourceId: string): Promise<Highlight[]> {
  return await invoke<Highlight[]>("get_highlights_by_source", { sourceId });
}

/**
 * 获取指定卡片关联的高亮
 */
export async function getByCard(cardId: string): Promise<Highlight[]> {
  return await invoke<Highlight[]>("get_highlights_by_card", { cardId });
}

/**
 * 创建高亮
 */
export async function create(data: Omit<Highlight, "id" | "createdAt">): Promise<Highlight> {
  const req: CreateHighlightRequest = {
    sourceId: data.sourceId,
    cardId: data.cardId,
    content: data.content,
    note: data.note,
    type: data.type,
    position: data.position ? {
      page: data.position.page,
      chapter: data.position.chapter,
      startOffset: typeof data.position.startOffset === 'string' ? parseInt(data.position.startOffset, 10) : data.position.startOffset,
      endOffset: typeof data.position.endOffset === 'string' ? parseInt(data.position.endOffset, 10) : data.position.endOffset,
    } : undefined,
    color: data.color,
  };
  return await invoke<Highlight>("create_highlight", { req });
}

/**
 * 更新高亮
 */
export async function update(
  id: string,
  data: { note?: string; color?: string; cardId?: string }
): Promise<Highlight | null> {
  return await invoke<Highlight | null>("update_highlight", { id, req: data });
}

/**
 * 删除高亮
 */
export async function deleteHighlight(id: string): Promise<void> {
  await invoke("delete_highlight", { id });
}

// 导出 delete 别名
export { deleteHighlight as delete };

/**
 * 反向链接信息
 */
export interface SourceBacklink {
  cardId: string;
  cardTitle: string;
  highlightId: string;
  highlightContent: string;
  page?: number;
  cfi?: string;
}

/**
 * 获取引用该文献源的所有笔记（反向链接）
 */
export async function getBacklinksForSource(sourceId: string): Promise<SourceBacklink[]> {
  return await invoke<SourceBacklink[]>("get_backlinks_for_source", { sourceId });
}


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
 * 创建高亮
 */
export async function create(data: Omit<Highlight, "id" | "createdAt">): Promise<Highlight> {
  const req: CreateHighlightRequest = {
    sourceId: data.sourceId,
    cardId: data.cardId,
    content: data.content,
    note: data.note,
    position: data.position,
    color: data.color,
  };
  return await invoke<Highlight>("create_highlight", { req });
}

/**
 * 删除高亮
 */
export async function deleteHighlight(id: string): Promise<void> {
  await invoke("delete_highlight", { id });
}

// 导出 delete 别名
export { deleteHighlight as delete };


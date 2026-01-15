/**
 * Bookmark API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { Bookmark } from "@/types";

export interface CreateBookmarkRequest {
  sourceId: string;
  position: string; // CFI 或等效位置标识
  label?: string;
  note?: string;
}

export interface UpdateBookmarkRequest {
  label?: string;
  note?: string;
  position?: string;
}

/**
 * 获取所有书签
 */
export async function getAll(): Promise<Bookmark[]> {
  return await invoke<Bookmark[]>("get_all_bookmarks");
}

/**
 * 获取指定文献源的书签
 */
export async function getBySource(sourceId: string): Promise<Bookmark[]> {
  return await invoke<Bookmark[]>("get_bookmarks_by_source", { sourceId });
}

/**
 * 获取单个书签
 */
export async function get(id: string): Promise<Bookmark | null> {
  return await invoke<Bookmark | null>("get_bookmark", { id });
}

/**
 * 创建书签
 */
export async function create(data: CreateBookmarkRequest): Promise<Bookmark> {
  return await invoke<Bookmark>("create_bookmark", { req: data });
}

/**
 * 更新书签
 */
export async function update(id: string, data: UpdateBookmarkRequest): Promise<Bookmark | null> {
  return await invoke<Bookmark | null>("update_bookmark", { id, req: data });
}

/**
 * 删除书签
 */
export async function deleteBookmark(id: string): Promise<void> {
  await invoke("delete_bookmark", { id });
}

// 导出 delete 别名
export { deleteBookmark as delete };





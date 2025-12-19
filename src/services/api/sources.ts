/**
 * Source API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { CreateSourceRequest, UpdateSourceRequest } from "./types";
import type { Source } from "@/types";

/**
 * 获取所有文献源
 */
export async function getAll(): Promise<Source[]> {
  return await invoke<Source[]>("get_sources");
}

/**
 * 获取单个文献源
 */
export async function get(id: string): Promise<Source | null> {
  return await invoke<Source | null>("get_source", { id });
}

/**
 * 创建文献源
 */
export async function create(data: Omit<Source, "id" | "createdAt" | "updatedAt" | "noteIds">): Promise<Source> {
  const req: CreateSourceRequest = {
    type: data.type,
    title: data.title,
    author: data.author,
    url: data.url,
    cover: data.cover,
    description: data.description,
    tags: data.tags || [],
  };
  return await invoke<Source>("create_source", { req });
}

/**
 * 更新文献源
 */
export async function update(id: string, updates: Partial<Source>): Promise<Source | null> {
  const req: UpdateSourceRequest = {
    title: updates.title,
    author: updates.author,
    url: updates.url,
    cover: updates.cover,
    description: updates.description,
    tags: updates.tags,
    progress: updates.progress,
    lastReadAt: updates.lastReadAt,
  };
  return await invoke<Source | null>("update_source", { id, req });
}

/**
 * 删除文献源
 */
export async function deleteSource(id: string): Promise<void> {
  await invoke("delete_source", { id });
}

// 导出 delete 别名
export { deleteSource as delete };


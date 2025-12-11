/**
 * File Watcher API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { FileChangeInfo } from "./types";

/**
 * 轮询文件变化
 */
export async function pollChanges(): Promise<FileChangeInfo> {
  const result = await invoke<{ changed_ids: string[]; removed_ids: string[] }>("poll_file_changes");
  return {
    changedIds: result.changed_ids || [],
    removedIds: result.removed_ids || [],
  };
}


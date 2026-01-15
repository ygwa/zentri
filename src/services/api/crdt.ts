/**
 * CRDT API 模块
 * 提供协作编辑、历史快照等功能
 */
import { invoke } from "@tauri-apps/api/core";
import type { CrdtSyncResponse, SnapshotInfo } from "./types";

/**
 * 获取文档的完整 CRDT 状态
 * @returns base64 编码的状态数据
 */
export async function getState(docId: string): Promise<string> {
  return await invoke<string>("crdt_get_state", { docId });
}

/**
 * 获取状态向量 (用于增量同步)
 * @returns base64 编码的状态向量
 */
export async function getStateVector(docId: string): Promise<string> {
  return await invoke<string>("crdt_get_state_vector", { docId });
}

/**
 * 应用来自前端的更新
 * @param update base64 编码的更新数据
 */
export async function applyUpdate(docId: string, update: string): Promise<void> {
  return await invoke<void>("crdt_apply_update", { docId, update });
}

/**
 * 获取增量更新 (从给定状态向量)
 * @param stateVector base64 编码的状态向量
 * @returns base64 编码的增量更新
 */
export async function getDiff(docId: string, stateVector: string): Promise<string> {
  return await invoke<string>("crdt_get_diff", { docId, stateVector });
}

/**
 * 双向同步文档
 * 前端发送自己的状态向量和更新，后端返回缺失的更新
 */
export async function sync(
  docId: string,
  clientStateVector: string,
  clientUpdate?: string
): Promise<CrdtSyncResponse> {
  return await invoke<CrdtSyncResponse>("crdt_sync", {
    docId,
    clientStateVector,
    clientUpdate,
  });
}

/**
 * 保存文档到磁盘
 */
export async function save(docId: string): Promise<void> {
  return await invoke<void>("crdt_save", { docId });
}

/**
 * 保存所有脏文档
 * @returns 保存的文档数量
 */
export async function flushAll(): Promise<number> {
  return await invoke<number>("crdt_flush_all");
}

/**
 * 创建历史快照
 */
export async function createSnapshot(
  docId: string,
  description?: string
): Promise<SnapshotInfo> {
  return await invoke<SnapshotInfo>("crdt_create_snapshot", { docId, description });
}

/**
 * 获取快照列表
 */
export async function listSnapshots(docId: string): Promise<SnapshotInfo[]> {
  return await invoke<SnapshotInfo[]>("crdt_list_snapshots", { docId });
}

/**
 * 恢复到指定快照
 * @returns 恢复后的完整状态 (base64 编码)
 */
export async function restoreSnapshot(
  docId: string,
  snapshotTimestamp: number
): Promise<string> {
  return await invoke<string>("crdt_restore_snapshot", { docId, snapshotTimestamp });
}

/**
 * 卸载文档 (释放内存)
 */
export async function unload(docId: string): Promise<void> {
  return await invoke<void>("crdt_unload", { docId });
}

// ============ 辅助函数 ============

/**
 * 将 Uint8Array 转换为 base64 字符串
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 将 base64 字符串转换为 Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}







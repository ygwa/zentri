/**
 * Vault API 模块
 */
import { invoke } from "@tauri-apps/api/core";

/**
 * 获取 Vault 路径
 */
export async function getPath(): Promise<string | null> {
  return await invoke<string | null>("get_vault_path");
}

/**
 * 设置初始 Vault 路径（首次启动时）
 */
export async function setInitialPath(path: string): Promise<void> {
  await invoke("set_initial_vault_path", { path });
}

/**
 * 设置 Vault 路径（切换时使用）
 */
export async function setPath(path: string): Promise<void> {
  // 对于切换操作，使用相同的后端命令
  await invoke("set_initial_vault_path", { path });
}

/**
 * 获取 Vault 历史记录列表
 */
export async function getHistory(): Promise<string[]> {
  return await invoke<string[]>("get_vault_history");
}

/**
 * 检查 Vault 是否已配置
 */
export async function isConfigured(): Promise<boolean> {
  const path = await getPath();
  return path !== null && path !== "";
}


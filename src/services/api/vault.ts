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
 * 设置 Vault 路径
 */
export async function setPath(path: string): Promise<void> {
  await invoke("set_vault_path", { path });
}

/**
 * 检查 Vault 是否已配置
 */
export async function isConfigured(): Promise<boolean> {
  const path = await getPath();
  return path !== null && path !== "";
}


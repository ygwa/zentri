/**
 * API 工具函数
 */
import { invoke } from "@tauri-apps/api/core";

/**
 * 检查是否在 Tauri 环境中运行
 */
export function isTauriEnv(): boolean {
  // @ts-ignore
  return typeof window !== "undefined" && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
}

/**
 * 安全的 Tauri invoke 包装
 */
export async function safeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnv()) {
    throw new Error("Not in Tauri environment");
  }
  return await invoke<T>(command, args);
}

/**
 * 通用字段名转换: snake_case -> camelCase
 */
export function toCamelCase<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[camelKey] = toCamelCase(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result as T;
}

/**
 * 通用字段名转换: camelCase -> snake_case
 */
export function toSnakeCase<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[snakeKey] = toSnakeCase(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result as T;
}


/**
 * 文件 URL 转换工具
 * 在 Tauri 环境中，将本地文件路径转换为可访问的 URL
 */

import { isTauriEnv } from "@/services/api";

/**
 * 将本地文件路径转换为可访问的 URL
 * - Tauri 环境：使用 convertFileSrc 转换
 * - 浏览器环境：直接返回（假设是 blob URL 或 http URL）
 */
export async function getFileUrl(path: string): Promise<string> {
  if (!path) return "";

  // 如果已经是 URL（http/https/blob），直接返回
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("asset://") ||
    path.startsWith("tauri://")
  ) {
    return path;
  }

  // Tauri 环境：转换本地路径
  if (isTauriEnv()) {
    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(path);
    } catch (err) {
      console.error("Failed to convert file src:", err);
      // 降级方案：尝试直接返回路径
      return path;
    }
  }

  // 非 Tauri 环境：直接返回
  return path;
}

/**
 * 检查路径是否是本地文件路径
 */
export function isLocalFilePath(path: string): boolean {
  if (!path) return false;
  
  // 如果是 URL 协议，则不是本地路径
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("asset://") ||
    path.startsWith("tauri://")
  ) {
    return false;
  }

  // macOS/Linux 绝对路径或 Windows 路径
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}


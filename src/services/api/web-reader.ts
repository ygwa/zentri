/**
 * 网页阅读器 API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { WebSnapshot } from "@/types";

/**
 * 网页抓取结果（完整内容）
 */
export interface FetchResult {
  title: string;
  author?: string;
  siteName?: string;
  content: string;        // 清洗后的 HTML
  textContent: string;    // 纯文本
  excerpt?: string;
  wordCount: number;
}

/**
 * 网页元数据（用于表单自动填充）
 */
export interface WebpageMetadata {
  title: string;
  author?: string;
  siteName?: string;
  description?: string;
  favicon?: string;
}

/**
 * 抓取并清洗网页（完整内容）
 */
export async function fetchWebpage(url: string): Promise<FetchResult> {
  return await invoke<FetchResult>("fetch_webpage", { url });
}

/**
 * 快速获取网页元数据（用于表单自动填充）
 */
export async function fetchWebpageMetadata(url: string): Promise<WebpageMetadata> {
  return await invoke<WebpageMetadata>("fetch_webpage_metadata", { url });
}

/**
 * 保存网页快照
 */
export async function saveSnapshot(
  sourceId: string,
  url: string,
  fetchResult: FetchResult
): Promise<WebSnapshot> {
  return await invoke<WebSnapshot>("save_web_snapshot", {
    sourceId,
    url,
    fetchResult,
  });
}

/**
 * 获取网页快照
 */
export async function getSnapshot(sourceId: string): Promise<WebSnapshot | null> {
  return await invoke<WebSnapshot | null>("get_web_snapshot", { sourceId });
}

/**
 * 将 HTML 转换为 Markdown
 */
export async function convertToMarkdown(html: string): Promise<string> {
  return await invoke<string>("convert_to_markdown", { html });
}


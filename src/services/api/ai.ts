/**
 * AI API 模块
 */

import { safeInvoke } from "./utils";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  model_path: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  size: number; // bytes
  url: string;
  description?: string;
}

/**
 * 启动 AI 服务器
 */
export async function startServer(
  modelId: string,
  port?: number
): Promise<number> {
  return await safeInvoke<number>("ai_start_server", {
    modelId,
    port,
  });
}

/**
 * 停止 AI 服务器
 */
export async function stopServer(): Promise<void> {
  return await safeInvoke<void>("ai_stop_server", {});
}

/**
 * 检查服务器状态
 */
export async function checkStatus(): Promise<ServerStatus> {
  return await safeInvoke<ServerStatus>("ai_check_status", {});
}

/**
 * 列出可用模型
 */
export async function listModels(): Promise<ModelInfo[]> {
  return await safeInvoke<ModelInfo[]>("ai_list_models", {});
}

/**
 * 列出已下载的模型
 */
export async function listDownloadedModels(): Promise<string[]> {
  return await safeInvoke<string[]>("ai_list_downloaded_models", {});
}

/**
 * 下载模型
 */
export async function downloadModel(modelId: string): Promise<string> {
  return await safeInvoke<string>("ai_download_model", { modelId });
}

/**
 * 设置活动模型
 */
export async function setActiveModel(modelPath: string): Promise<void> {
  return await safeInvoke<void>("ai_set_active_model", { modelPath });
}

/**
 * 聊天
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  return await safeInvoke<string>("ai_chat", { messages });
}

/**
 * 解释文本
 */
export async function explainText(
  text: string,
  context?: string
): Promise<string> {
  return await safeInvoke<string>("ai_explain_text", {
    text,
    context: context || null,
  });
}

/**
 * RAG 查询
 */
export async function ragQuery(
  query: string,
  sourceId?: string
): Promise<string> {
  return await safeInvoke<string>("ai_rag_query", {
    query,
    sourceId: sourceId || null,
  });
}

/**
 * 索引文献源（用于 RAG）
 */
export async function indexSource(
  sourceId: string,
  content: string
): Promise<void> {
  return await safeInvoke<void>("ai_index_source", {
    sourceId,
    content,
  });
}


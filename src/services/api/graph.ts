/**
 * Graph API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { GraphData } from "./types";

/**
 * 获取知识图谱数据
 */
export async function getData(): Promise<GraphData> {
  return await invoke<GraphData>("get_graph_data");
}


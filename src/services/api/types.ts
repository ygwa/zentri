/**
 * API 类型定义
 */
import type { CardType, SourceType } from "@/types";

// ==================== Card 相关 ====================

export interface CardListItem {
  id: string;
  path: string;
  title: string;
  tags: string[];
  type: CardType;
  preview?: string;
  createdAt: number;
  modifiedAt: number;
  aliases: string[];
  links: string[];
  sourceId?: string;
}

export interface CardFull extends CardListItem {
  content: string;
}

export interface UpdateCardRequest {
  title?: string;
  content?: string;
  tags?: string[];
  cardType?: string;
  links?: string[];
}

// ==================== Source 相关 ====================

export interface CreateSourceRequest {
  type: SourceType;
  title: string;
  author?: string;
  url?: string;
  cover?: string;
  description?: string;
  tags: string[];
}

export interface UpdateSourceRequest {
  title?: string;
  author?: string;
  url?: string;
  cover?: string;
  description?: string;
  tags?: string[];
  progress?: number;
  lastReadAt?: number;
}

// ==================== Highlight 相关 ====================

export interface CreateHighlightRequest {
  sourceId: string;
  cardId?: string;
  content: string;
  note?: string;
  position?: HighlightPosition;
  color?: string;
}

export interface HighlightPosition {
  page?: number;
  chapter?: string;
  startOffset?: number;
  endOffset?: number;
}

// ==================== Search 相关 ====================

export interface SearchResult {
  id: string;
  title: string;
  score: number;
  snippet?: string;
  cardType?: CardType;
  tags?: string[];
}

export interface SearchFilters {
  cardType?: string;
  tag?: string;
  limit?: number;
}

// ==================== Graph 相关 (P2 增强) ====================

export interface GraphNode {
  id: string;
  title: string;           // 卡片标题（用于显示）
  cardType: string;        // 卡片类型（用于着色）
  x: number;
  y: number;
  neighbors: string[];
  linkCount: number;       // 链接数量（用于节点大小）
  importance: number;      // PageRank 分数 (0-1)
  clusterId: number;       // 所属连通分量 ID
}

export interface GraphData {
  nodes: GraphNode[];
  links: Array<{ source: string; target: string }>;
  clusterCount: number;    // 连通分量数量
  orphanCount: number;     // 孤立节点数量
}

/** 反向链接信息 */
export interface BacklinkInfo {
  id: string;
  title: string;
  cardType: string;
  context?: string;        // 引用出现的上下文预览
}

/** 卡片重要性排名 */
export interface CardImportance {
  id: string;
  title: string;
  score: number;
  inboundLinks: number;
  outboundLinks: number;
}

/** 知识集群 */
export interface KnowledgeCluster {
  id: number;
  size: number;
  nodes: string[];
  centerNode?: string;     // 集群中心节点
}

// ==================== Search 相关 (P1 增强) ====================

export interface SearchFilters {
  cardType?: string;
  tag?: string;
  limit?: number;
}

// ==================== CRDT 相关 (P0 新增) ====================

/** CRDT 同步响应 */
export interface CrdtSyncResponse {
  update: string;          // base64 编码的增量更新
  stateVector: string;     // base64 编码的状态向量
}

/** 历史快照信息 */
export interface SnapshotInfo {
  id: string;
  timestamp: number;
  description?: string;
}

// ==================== Watcher 相关 ====================

export interface FileChangeInfo {
  changedIds: string[];
  removedIds: string[];
}


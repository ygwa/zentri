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
  description?: string;
  tags: string[];
}

export interface UpdateSourceRequest {
  title?: string;
  author?: string;
  url?: string;
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
  type: CardType;
  tags: string[];
}

// ==================== Graph 相关 ====================

export interface GraphNode {
  id: string;
  title: string;           // 卡片标题（用于显示）
  cardType: string;        // 卡片类型（用于着色）
  x: number;
  y: number;
  neighbors: string[];
  linkCount: number;       // 链接数量（用于节点大小）
}

export interface GraphData {
  nodes: GraphNode[];
  links: Array<{ source: string; target: string }>;
}

// ==================== Watcher 相关 ====================

export interface FileChangeInfo {
  changedIds: string[];
  removedIds: string[];
}


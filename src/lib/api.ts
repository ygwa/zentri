/**
 * Tauri API 封装层
 * 连接前端与 Rust 后端
 */
import { invoke } from "@tauri-apps/api/core";
import type { Card, Source, Highlight, CardType, SourceType } from "@/types";

// ==================== 类型定义 ====================

/** 卡片列表项 (不含完整内容) */
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

/** 创建文献源请求 */
export interface CreateSourceRequest {
  type: SourceType;
  title: string;
  author?: string;
  url?: string;
  description?: string;
  tags: string[];
}

/** 更新文献源请求 */
export interface UpdateSourceRequest {
  title?: string;
  author?: string;
  url?: string;
  description?: string;
  tags?: string[];
  progress?: number;
  lastReadAt?: number;
}

/** 创建高亮请求 */
export interface CreateHighlightRequest {
  sourceId: string;
  cardId?: string;
  content: string;
  note?: string;
  position?: {
    page?: number;
    chapter?: string;
    startOffset?: string;
    endOffset?: string;
  };
  color?: string;
}

// ==================== Vault 操作 ====================

/**
 * 获取当前 Vault 路径
 */
export async function getVaultPath(): Promise<string | null> {
  return await invoke<string | null>("get_vault_path");
}

/**
 * 设置 Vault 路径
 */
export async function setVaultPath(path: string): Promise<void> {
  return await invoke("set_vault_path", { path });
}

// ==================== Card 操作 ====================

/**
 * 获取所有卡片列表
 */
export async function getCards(): Promise<CardListItem[]> {
  const cards = await invoke<CardListItem[]>("get_cards");
  // 转换字段名 (Rust 使用 snake_case, 前端使用 camelCase)
  return cards.map(normalizeCard);
}

/**
 * 获取单个卡片完整内容
 */
export async function getCard(id: string): Promise<Card | null> {
  const card = await invoke<Card | null>("get_card", { id });
  return card ? normalizeCardFull(card) : null;
}

/**
 * 通过路径获取卡片
 */
export async function getCardByPath(path: string): Promise<Card | null> {
  const card = await invoke<Card | null>("get_card_by_path", { path });
  return card ? normalizeCardFull(card) : null;
}

/**
 * 创建新卡片
 */
export async function createCard(
  cardType: CardType,
  title: string,
  sourceId?: string
): Promise<Card> {
  const card = await invoke<Card>("create_card", {
    cardType,
    title,
    sourceId,
  });
  return normalizeCardFull(card);
}

/**
 * 更新卡片
 */
export async function updateCard(
  id: string,
  updates: {
    title?: string;
    content?: string;
    tags?: string[];
    cardType?: CardType;
    links?: string[];
  }
): Promise<Card> {
  const card = await invoke<Card>("update_card", {
    id,
    ...updates,
  });
  return normalizeCardFull(card);
}

/**
 * 删除卡片
 */
export async function deleteCard(id: string): Promise<void> {
  return await invoke("delete_card", { id });
}

// ==================== Source 操作 ====================

/**
 * 获取所有文献源
 */
export async function getSources(): Promise<Source[]> {
  const sources = await invoke<Source[]>("get_sources");
  return sources.map(normalizeSource);
}

/**
 * 获取单个文献源
 */
export async function getSource(id: string): Promise<Source | null> {
  const source = await invoke<Source | null>("get_source", { id });
  return source ? normalizeSource(source) : null;
}

/**
 * 创建文献源
 */
export async function createSource(req: CreateSourceRequest): Promise<Source> {
  const source = await invoke<Source>("create_source", { req });
  return normalizeSource(source);
}

/**
 * 更新文献源
 */
export async function updateSource(
  id: string,
  req: UpdateSourceRequest
): Promise<Source | null> {
  const source = await invoke<Source | null>("update_source", { id, req });
  return source ? normalizeSource(source) : null;
}

/**
 * 删除文献源
 */
export async function deleteSource(id: string): Promise<void> {
  return await invoke("delete_source", { id });
}

// ==================== Highlight 操作 ====================

/**
 * 获取文献源的所有高亮
 */
export async function getHighlightsBySource(
  sourceId: string
): Promise<Highlight[]> {
  const highlights = await invoke<Highlight[]>("get_highlights_by_source", {
    sourceId,
  });
  return highlights.map(normalizeHighlight);
}

/**
 * 获取所有高亮
 */
export async function getAllHighlights(): Promise<Highlight[]> {
  const highlights = await invoke<Highlight[]>("get_all_highlights");
  return highlights.map(normalizeHighlight);
}

/**
 * 创建高亮
 */
export async function createHighlight(
  req: CreateHighlightRequest
): Promise<Highlight> {
  const highlight = await invoke<Highlight>("create_highlight", { req });
  return normalizeHighlight(highlight);
}

/**
 * 删除高亮
 */
export async function deleteHighlight(id: string): Promise<void> {
  return await invoke("delete_highlight", { id });
}

// ==================== 工具函数 ====================

/**
 * 标准化卡片列表项 (处理 snake_case -> camelCase)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCard(card: any): CardListItem {
  return {
    id: card.id,
    path: card.path,
    title: card.title,
    tags: card.tags || [],
    type: card.cardType || card.type || "fleeting",
    preview: card.preview,
    createdAt: card.createdAt || card.created_at || Date.now(),
    modifiedAt: card.modifiedAt || card.modified_at || Date.now(),
    aliases: card.aliases || [],
    links: card.links || [],
    sourceId: card.sourceId || card.source_id,
  };
}

/**
 * 标准化完整卡片
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCardFull(card: any): Card {
  return {
    id: card.id,
    type: card.cardType || card.type || "fleeting",
    title: card.title,
    content: card.content || "",
    tags: card.tags || [],
    links: card.links || [],
    sourceId: card.sourceId || card.source_id,
    createdAt: card.createdAt || card.created_at || Date.now(),
    updatedAt: card.modifiedAt || card.modified_at || card.updatedAt || Date.now(),
  };
}

/**
 * 标准化文献源
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSource(source: any): Source {
  return {
    id: source.id,
    type: source.sourceType || source.type || "book",
    title: source.title,
    author: source.author,
    url: source.url,
    cover: source.cover,
    description: source.description,
    tags: source.tags || [],
    progress: source.progress || 0,
    lastReadAt: source.lastReadAt || source.last_read_at,
    metadata: source.metadata,
    noteIds: source.noteIds || source.note_ids || [],
    createdAt: source.createdAt || source.created_at || Date.now(),
    updatedAt: source.updatedAt || source.updated_at || Date.now(),
  };
}

/**
 * 标准化高亮
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeHighlight(highlight: any): Highlight {
  return {
    id: highlight.id,
    sourceId: highlight.sourceId || highlight.source_id,
    cardId: highlight.cardId || highlight.card_id,
    content: highlight.content,
    note: highlight.note,
    position: highlight.position,
    color: highlight.color,
    createdAt: highlight.createdAt || highlight.created_at || Date.now(),
  };
}

// ==================== 初始化检测 ====================

/**
 * 检查是否在 Tauri 环境中运行
 */
export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * 检查 Vault 是否已配置
 */
export async function isVaultConfigured(): Promise<boolean> {
  if (!isTauriEnv()) return false;
  const path = await getVaultPath();
  return path !== null && path !== "";
}


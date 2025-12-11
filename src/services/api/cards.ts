/**
 * Card API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { CardListItem, CardFull, UpdateCardRequest } from "./types";
import type { Card, CardType } from "@/types";

/**
 * 获取所有卡片（列表形式，不含完整内容）
 */
export async function getAll(): Promise<CardListItem[]> {
  const cards = await invoke<CardListItem[]>("get_cards");
  return cards.map(normalizeCard);
}

/**
 * 获取单个卡片（含完整内容）
 */
export async function get(id: string): Promise<Card | null> {
  const card = await invoke<CardFull | null>("get_card", { id });
  return card ? normalizeCardFull(card) : null;
}

/**
 * 创建卡片
 */
export async function create(
  cardType: CardType,
  title: string,
  sourceId?: string
): Promise<Card> {
  const card = await invoke<CardFull>("create_card", {
    cardType,
    title,
    sourceId,
  });
  return normalizeCardFull(card);
}

/**
 * 更新卡片
 */
export async function update(id: string, updates: UpdateCardRequest): Promise<Card> {
  const card = await invoke<CardFull>("update_card", {
    id,
    ...updates,
  });
  return normalizeCardFull(card);
}

/**
 * 删除卡片
 */
export async function deleteCard(id: string): Promise<void> {
  await invoke("delete_card", { id });
}

// 导出 delete 别名
export { deleteCard as delete };

// ==================== 数据规范化 ====================

function normalizeCard(card: CardListItem): CardListItem {
  return {
    id: card.id,
    path: card.path,
    title: card.title,
    tags: card.tags || [],
    type: card.type,
    preview: card.preview,
    createdAt: card.createdAt,
    modifiedAt: card.modifiedAt,
    aliases: card.aliases || [],
    links: card.links || [],
    sourceId: card.sourceId,
  };
}

function normalizeCardFull(card: CardFull): Card {
  let content;
  try {
    content = typeof card.content === 'string'
      ? JSON.parse(card.content)
      : card.content;
  } catch {
    content = { type: 'doc', content: [] };
  }

  // Ensure content is valid EditorContent structure
  if (!content || typeof content !== 'object' || content.type !== 'doc') {
    content = { type: 'doc', content: [] };
  }

  return {
    id: card.id,
    type: card.type,
    title: card.title,
    content: content,
    tags: card.tags || [],
    links: card.links || [],
    sourceId: card.sourceId,
    createdAt: card.createdAt,
    updatedAt: card.modifiedAt,
  };
}


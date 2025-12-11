/**
 * Daily Note API 模块
 */
import { invoke } from "@tauri-apps/api/core";
import type { Card } from "@/types";
import type { CardFull, CardListItem } from "./types";

/**
 * 获取或创建今日日记
 */
export async function getOrCreate(): Promise<Card> {
  const card = await invoke<CardFull>("get_or_create_daily_note");
  return normalizeCard(card);
}

/**
 * 获取指定日期的日记
 * @param date 日期格式: YYYY-MM-DD
 */
export async function get(date: string): Promise<Card | null> {
  const card = await invoke<CardFull | null>("get_daily_note", { date });
  return card ? normalizeCard(card) : null;
}

/**
 * 获取日记列表
 */
export async function getList(limit?: number): Promise<Card[]> {
  const cards = await invoke<CardListItem[]>("get_daily_notes", { limit });
  return cards.map((c) => ({
    id: c.id,
    type: c.type,
    title: c.title,
    content: { type: 'doc', content: [] },
    tags: c.tags || [],
    links: c.links || [],
    sourceId: c.sourceId,
    createdAt: c.createdAt,
    updatedAt: c.modifiedAt,
  }));
}

function normalizeCard(card: CardFull): Card {
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


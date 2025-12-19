/**
 * Cards Slice - 卡片相关状态和操作
 */
import type { StateCreator } from "zustand";
import type { Card, EditorContent } from "@/types";
import * as api from "@/services/api";

/** 空文档的默认 JSON 结构 */
const EMPTY_DOC: EditorContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export interface CardsSlice {
  // 数据
  cards: Card[];

  // Actions
  loadCards: () => Promise<void>;
  loadCardContent: (id: string) => Promise<void>;
  createCard: (type: Card["type"], title: string, sourceId?: string) => Promise<Card>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  convertCard: (id: string, targetType: Card["type"]) => Promise<void>;
  addCardReference: (projectId: string, cardId: string) => Promise<void>;
  removeCardReference: (projectId: string, cardId: string) => Promise<void>;

  // Computed
  filteredCards: () => Card[];
  getCardById: (id: string) => Card | undefined;
}

export const createCardsSlice: StateCreator<CardsSlice> = (set, get) => ({
  // 初始状态
  cards: [],

  // Actions
  loadCards: async () => {
    try {
      if (!api.isTauriEnv()) return;

      const cardsData = await api.cards.getAll();
      const cards: Card[] = cardsData.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        content: { type: "doc", content: [] },
        tags: c.tags || [],
        links: c.links || [],
        sourceId: c.sourceId,
        createdAt: c.createdAt,
        updatedAt: c.modifiedAt,
      }));

      set({ cards });
    } catch (err) {
      console.error("Failed to load cards:", err);
    }
  },

  loadCardContent: async (id: string) => {
    try {
      if (!api.isTauriEnv()) return;

      const card = await api.cards.get(id);
      if (!card) return;

      const rawContentAny = card.content as any;
      const rawContent =
        typeof rawContentAny === "string" ? rawContentAny : JSON.stringify(rawContentAny);
      const content = parseCardContent(rawContent);

      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === id ? { ...c, content, links: card.links || [] } : c
        ),
      }));
    } catch (err) {
      console.error("Failed to load card content:", err);
    }
  },

  createCard: async (type, title, sourceId) => {
    if (!api.isTauriEnv()) {
      const mockCard: Card = {
        id: `mock-${Date.now()}`,
        type,
        title,
        content: EMPTY_DOC,
        tags: [],
        links: [],
        sourceId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set((state) => ({ cards: [mockCard, ...state.cards] }));
      return mockCard;
    }

    const created = await api.cards.create(type, title, sourceId);
    const rawContent =
      typeof created.content === "string" ? created.content : JSON.stringify(created.content);
    const content = parseCardContent(rawContent);
    const card: Card = {
      id: created.id,
      type: created.type,
      title: created.title,
      content,
      tags: created.tags || [],
      links: created.links || [],
      sourceId: created.sourceId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };

    set((state) => ({ cards: [card, ...state.cards] }));
    return card;
  },

  updateCard: async (id, updates) => {
    let contentForBackend: string | undefined;
    if (updates.content !== undefined) {
      contentForBackend =
        typeof updates.content === "string"
          ? updates.content
          : JSON.stringify(updates.content);
    }

    const cards = get().cards;
    const links = updates.content ? extractWikiLinksFromContent(updates.content, cards) : undefined;

    if (api.isTauriEnv()) {
      await api.cards.update(id, {
        title: updates.title,
        content: contentForBackend,
        tags: updates.tags,
        cardType: updates.type,
        links,
      });
    }

    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id
          ? { ...c, ...updates, links: links || c.links, updatedAt: Date.now() }
          : c
      ),
    }));
  },

  deleteCard: async (id) => {
    if (api.isTauriEnv()) {
      await api.cards.delete(id);
    }

    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    }));
  },

  convertCard: async (id, targetType) => {
    const card = get().cards.find((c) => c.id === id);
    if (!card) return;
    await get().updateCard(id, { type: targetType });
  },

  addCardReference: async (projectId, cardId) => {
    const project = get().cards.find((c) => c.id === projectId);
    if (!project) return;

    const existingLinks = project.links || [];
    if (existingLinks.includes(cardId)) return;

    await get().updateCard(projectId, { links: [...existingLinks, cardId] });
  },

  removeCardReference: async (projectId, cardId) => {
    const project = get().cards.find((c) => c.id === projectId);
    if (!project) return;

    const links = (project.links || []).filter((l) => l !== cardId);
    await get().updateCard(projectId, { links });
  },

  // Computed
  filteredCards: () => {
    // 注意：CardsSlice 不包含 currentView 和 searchQuery
    // 这些应该在调用时传入，或者从外部获取
    // 这里只返回所有卡片，由调用方进行过滤
    const { cards } = get();
    return cards.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getCardById: (id) => get().cards.find((card) => card.id === id),
});

// ==================== 工具函数 ====================

/**
 * 解析卡片内容 - 支持 JSON 格式和旧的字符串格式
 */
function parseCardContent(content: string | undefined | null): EditorContent {
  if (!content) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "doc") {
        return parsed as EditorContent;
      }
    } catch (e) {
      console.warn("parseCardContent: JSON parse failed", e);
    }
  }

  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
  };
}

/**
 * 从内容中提取 wiki links
 */
function extractWikiLinksFromContent(
  content: EditorContent,
  cards: Card[] = []
): string[] {
  const links: string[] = [];
  extractLinksFromNode(content, links, cards);
  return links;
}

/**
 * 递归从 TipTap JSON 节点中提取 wiki links
 * 支持两种格式：
 * 1. wikiLink 节点（原子节点）
 * 2. 文本节点中的 wikiLink mark
 * 3. 文本中的 [[title]] 格式（作为后备方案）
 */
function extractLinksFromNode(
  node: EditorContent | {
    type: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
    text?: string;
  },
  links: string[],
  cards: Card[] = []
): void {
  // 如果是 wikiLink 节点（原子节点）
  if (node.type === "wikiLink" && "attrs" in node && node.attrs) {
    const href = node.attrs.href as string | undefined;
    if (href && !links.includes(href)) {
      links.push(href);
    }
    // wikiLink 节点是原子节点，没有子节点，直接返回
    return;
  }

  if (node.type === "text" && "text" in node && node.text) {
    if ("marks" in node && node.marks) {
      const wikiLinkMark = node.marks.find((m) => m.type === "wikiLink");
      if (wikiLinkMark && wikiLinkMark.attrs) {
        const href = wikiLinkMark.attrs.href as string | undefined;
        if (href && !links.includes(href)) {
          links.push(href);
        }
      }
    }

    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(node.text)) !== null) {
      const title = match[1].trim();
      const card = cards.find((c) => c.title === title);
      if (card && !links.includes(card.id)) {
        links.push(card.id);
      }
    }
  }

  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === "object" && child !== null) {
        extractLinksFromNode(
          child as {
            type: string;
            attrs?: Record<string, unknown>;
            content?: unknown[];
            marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
            text?: string;
          },
          links,
          cards
        );
      }
    }
  }
}



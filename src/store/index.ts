/**
 * Zentri Store - 应用状态管理
 * 使用 Zustand 实现，按功能域拆分为多个 slice
 */
import { create } from "zustand";
import * as api from "@/services/api";
import type { Card, ViewType, Source, Highlight, EditorContent } from "@/types";

/** 空文档的默认 JSON 结构 */
const EMPTY_DOC: EditorContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

// ==================== 类型定义 ====================

interface AppState {
  // 初始化状态
  isInitialized: boolean;
  isLoading: boolean;
  vaultPath: string | null;
  error: string | null;

  // 数据
  cards: Card[];
  sources: Source[];
  highlights: Highlight[];

  // UI 状态
  currentView: ViewType;
  selectedCardId: string | null;
  searchQuery: string;

  // 初始化
  initialize: () => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;

  // UI Actions
  setCurrentView: (view: ViewType) => void;
  selectCard: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setError: (error: string | null) => void;

  // Card 操作
  loadCards: () => Promise<void>;
  loadCardContent: (id: string) => Promise<void>;
  createCard: (type: Card["type"], title: string, sourceId?: string) => Promise<Card>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  convertCard: (id: string, targetType: Card["type"]) => Promise<void>;
  addCardReference: (projectId: string, cardId: string) => Promise<void>;
  removeCardReference: (projectId: string, cardId: string) => Promise<void>;

  // Source 操作
  loadSources: () => Promise<void>;
  createSource: (data: Omit<Source, "id" | "createdAt" | "updatedAt" | "noteIds">) => Promise<Source>;
  updateSource: (id: string, updates: Partial<Source>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;

  // Highlight 操作
  loadHighlights: () => Promise<void>;
  createHighlight: (data: Omit<Highlight, "id" | "createdAt">) => Promise<Highlight>;
  deleteHighlight: (id: string) => Promise<void>;

  // Tag 操作
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;

  // Daily Note
  openDailyNote: () => Promise<void>;
  getDailyNote: (date: string) => Promise<Card | null>;

  // 文件监听
  startFileWatching: () => void;
  stopFileWatching: () => void;
  pollFileChanges: () => Promise<void>;

  // Computed
  filteredCards: () => Card[];
  getCardById: (id: string) => Card | undefined;
  getSourceById: (id: string) => Source | undefined;
  getHighlightsBySource: (sourceId: string) => Highlight[];
  getNotesBySource: (sourceId: string) => Card[];
}

// 文件监听定时器 ID
let fileWatchIntervalId: ReturnType<typeof setInterval> | null = null;

// ==================== Store 实现 ====================

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  isInitialized: false,
  isLoading: true,
  vaultPath: null,
  error: null,
  cards: [],
  sources: [],
  highlights: [],
  currentView: "all",
  selectedCardId: null,
  searchQuery: "",

  // ==================== 初始化 ====================

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      if (!api.isTauriEnv()) {
        console.log("Not in Tauri environment, using mock data");
        set({ isInitialized: true, isLoading: false, vaultPath: null });
        return;
      }

      try {
        const vaultPath = await api.vault.getPath();

        if (vaultPath) {
          set({ vaultPath });

          await Promise.all([
            get().loadCards(),
            get().loadSources(),
            get().loadHighlights(),
          ]);

          get().startFileWatching();
        }
      } catch (e) {
        console.warn("Failed to get vault path or load data:", e);
      }

      set({ isInitialized: true, isLoading: false });
    } catch (err) {
      console.error("Failed to initialize:", err);
      set({ isInitialized: true, isLoading: false });
    }
  },

  setVaultPath: async (path: string) => {
    try {
      set({ isLoading: true, error: null });
      get().stopFileWatching();

      if (api.isTauriEnv()) {
        await api.vault.setPath(path);
      }

      set({ vaultPath: path });

      await Promise.all([
        get().loadCards(),
        get().loadSources(),
        get().loadHighlights(),
      ]);

      get().startFileWatching();
      set({ isLoading: false });
    } catch (err) {
      console.error("Failed to set vault path:", err);
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "设置路径失败",
      });
    }
  },

  // ==================== UI Actions ====================

  setCurrentView: (view) => set({ currentView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setError: (error) => set({ error }),

  selectCard: (id) => {
    set({ selectedCardId: id });
    if (id) {
      get().loadCardContent(id);
    }
  },

  // ==================== Card 操作 ====================

  loadCards: async () => {
    try {
      if (!api.isTauriEnv()) return;

      const cardsData = await api.cards.getAll();
      const cards: Card[] = cardsData.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        // 列表加载时不包含内容，使用空文档占位（会触发懒加载）
        content: { type: 'doc', content: [] },
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

      // 解析内容 - 支持 JSON 格式和旧的 Markdown 格式
      const rawContent = typeof card.content === 'string' ? card.content : JSON.stringify(card.content);
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
    // 解析后端返回的内容
    const rawContent = typeof created.content === 'string' ? created.content : JSON.stringify(created.content);
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
    // 序列化内容为 JSON 字符串（用于后端存储）
    let contentForBackend: string | undefined;
    if (updates.content !== undefined) {
      contentForBackend = typeof updates.content === 'string'
        ? updates.content
        : JSON.stringify(updates.content);
    }

    // 从内容中提取 wiki links（需要传入 cards 以便通过标题查找ID）
    const cards = get().cards;
    const links = updates.content ? extractWikiLinksFromContent(updates.content, cards) : undefined;

    if (api.isTauriEnv()) {
      console.log("Calling API updateCard:", { id, contentLength: contentForBackend?.length });
      await api.cards.update(id, {
        title: updates.title,
        content: contentForBackend,
        tags: updates.tags,
        cardType: updates.type,
        links,
      });
    } else {
      console.warn("Skipping API update (not in Tauri env)");
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
      selectedCardId: state.selectedCardId === id ? null : state.selectedCardId,
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

  // ==================== Tag 操作 ====================

  renameTag: async (oldTag, newTag) => {
    if (!oldTag || !newTag || oldTag === newTag) return;

    const affectedCards = get().cards.filter(card => card.tags.includes(oldTag));

    // 批量更新所有受影响的卡片
    const updates = affectedCards.map(async (card) => {
      const newTags = card.tags.map(t => t === oldTag ? newTag : t);
      // 去重
      const uniqueTags = Array.from(new Set(newTags));

      await get().updateCard(card.id, { tags: uniqueTags });
    });

    await Promise.all(updates);
  },

  deleteTag: async (tag) => {
    if (!tag) return;

    const affectedCards = get().cards.filter(card => card.tags.includes(tag));

    // 批量更新所有受影响的卡片
    const updates = affectedCards.map(async (card) => {
      const newTags = card.tags.filter(t => t !== tag);
      await get().updateCard(card.id, { tags: newTags });
    });

    await Promise.all(updates);
  },

  // ==================== Source 操作 ====================

  loadSources: async () => {
    try {
      if (!api.isTauriEnv()) return;
      const sources = await api.sources.getAll();
      set({ sources });
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  },

  createSource: async (data) => {
    if (!api.isTauriEnv()) {
      const mockSource: Source = {
        id: `mock-source-${Date.now()}`,
        ...data,
        noteIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set((state) => ({ sources: [mockSource, ...state.sources] }));
      return mockSource;
    }

    const source = await api.sources.create(data);
    set((state) => ({ sources: [source, ...state.sources] }));
    return source;
  },

  updateSource: async (id, updates) => {
    if (api.isTauriEnv()) {
      await api.sources.update(id, updates);
    }

    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    }));
  },

  deleteSource: async (id) => {
    if (api.isTauriEnv()) {
      await api.sources.delete(id);
    }

    set((state) => ({
      sources: state.sources.filter((s) => s.id !== id),
    }));
  },

  // ==================== Highlight 操作 ====================

  loadHighlights: async () => {
    try {
      if (!api.isTauriEnv()) return;
      const highlights = await api.highlights.getAll();
      set({ highlights });
    } catch (err) {
      console.error("Failed to load highlights:", err);
    }
  },

  createHighlight: async (data) => {
    if (!api.isTauriEnv()) {
      const mockHighlight: Highlight = {
        id: `mock-highlight-${Date.now()}`,
        ...data,
        createdAt: Date.now(),
      };
      set((state) => ({ highlights: [mockHighlight, ...state.highlights] }));
      return mockHighlight;
    }

    const highlight = await api.highlights.create(data);
    set((state) => ({ highlights: [highlight, ...state.highlights] }));
    return highlight;
  },

  deleteHighlight: async (id) => {
    if (api.isTauriEnv()) {
      await api.highlights.delete(id);
    }

    set((state) => ({
      highlights: state.highlights.filter((h) => h.id !== id),
    }));
  },

  // ==================== Daily Note ====================

  openDailyNote: async () => {
    try {
      if (!api.isTauriEnv()) {
        const today = new Date().toISOString().split("T")[0];
        const mockCard: Card = {
          id: `00_Inbox/${today}.md`,
          type: "fleeting",
          title: `日记 ${today}`,
          content: {
            type: 'doc', content: [
              { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: today }] },
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '今日待办' }] },
              {
                type: 'taskList', content: [
                  { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }
                ]
              },
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '笔记' }] },
              { type: 'paragraph' }
            ]
          },
          tags: ["daily"],
          links: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => {
          const exists = state.cards.find((c) => c.id === mockCard.id);
          if (!exists) {
            return { cards: [mockCard, ...state.cards], selectedCardId: mockCard.id };
          }
          return { selectedCardId: mockCard.id };
        });
        return;
      }

      const card = await api.dailyNote.getOrCreate();

      set((state) => {
        const exists = state.cards.find((c) => c.id === card.id);
        if (!exists) {
          return {
            cards: [card, ...state.cards],
            selectedCardId: card.id,
            currentView: "all" as const,
          };
        }
        return { selectedCardId: card.id, currentView: "all" as const };
      });
    } catch (err) {
      console.error("Failed to open daily note:", err);
    }
  },

  getDailyNote: async (date: string) => {
    try {
      if (!api.isTauriEnv()) return null;
      return await api.dailyNote.get(date);
    } catch (err) {
      console.error("Failed to get daily note:", err);
      return null;
    }
  },

  // ==================== 文件监听 ====================

  startFileWatching: () => {
    if (fileWatchIntervalId !== null) return;
    if (!api.isTauriEnv()) return;

    console.log("Starting file watching...");
    fileWatchIntervalId = setInterval(() => {
      get().pollFileChanges();
    }, 2000);
  },

  stopFileWatching: () => {
    if (fileWatchIntervalId !== null) {
      console.log("Stopping file watching...");
      clearInterval(fileWatchIntervalId);
      fileWatchIntervalId = null;
    }
  },

  pollFileChanges: async () => {
    try {
      if (!api.isTauriEnv()) return;

      const changes = await api.watcher.pollChanges();

      if (changes.changedIds.length === 0 && changes.removedIds.length === 0) {
        return;
      }

      console.log("File changes detected:", changes);

      // 处理删除的卡片
      if (changes.removedIds.length > 0) {
        set((state) => ({
          cards: state.cards.filter((c) => !changes.removedIds.includes(c.id)),
          selectedCardId: changes.removedIds.includes(state.selectedCardId || "")
            ? null
            : state.selectedCardId,
        }));
      }

      // 处理变化的卡片
      if (changes.changedIds.length > 0) {
        const updatedCards = await Promise.all(
          changes.changedIds.map(async (id) => {
            try {
              return await api.cards.get(id);
            } catch {
              return null;
            }
          })
        );

        set((state) => {
          const newCards = [...state.cards];

          for (const card of updatedCards) {
            if (!card) continue;

            const existingIndex = newCards.findIndex((c) => c.id === card.id);
            const normalizedCard: Card = {
              id: card.id,
              type: card.type,
              title: card.title,
              content: card.content || "",
              tags: card.tags || [],
              links: card.links || [],
              sourceId: card.sourceId,
              createdAt: card.createdAt,
              updatedAt: card.updatedAt,
            };

            if (existingIndex >= 0) {
              newCards[existingIndex] = normalizedCard;
            } else {
              newCards.unshift(normalizedCard);
            }
          }

          return { cards: newCards };
        });
      }
    } catch (err) {
      console.error("Failed to poll file changes:", err);
    }
  },

  // ==================== Computed ====================

  filteredCards: () => {
    const { cards, currentView, searchQuery } = get();
    let filtered = cards;

    // 按类型过滤
    if (currentView !== "all") {
      filtered = filtered.filter((card) => card.type === currentView);
    }

    // 按搜索词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) => {
          return (
            card.title.toLowerCase().includes(query) ||
            // 简单处理：仅检查 tags，或者需要实现从 JSON 提取文本的逻辑
            // 目前暂不支持全文搜索 JSON 内容
            card.tags.some((tag) => tag.toLowerCase().includes(query))
          );
        }
      );
    }

    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getCardById: (id) => get().cards.find((card) => card.id === id),
  getSourceById: (id) => get().sources.find((source) => source.id === id),
  getHighlightsBySource: (sourceId) => get().highlights.filter((h) => h.sourceId === sourceId),
  getNotesBySource: (sourceId) => {
    const source = get().sources.find((s) => s.id === sourceId);
    if (!source) return [];
    return get().cards.filter((card) => source.noteIds.includes(card.id));
  },
}));

// ==================== 工具函数 ====================

/**
 * 解析卡片内容 - 支持 JSON 格式和旧的字符串格式
 */
function parseCardContent(content: string | undefined | null): EditorContent {
  if (!content) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  // 尝试解析为 JSON
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      // 验证是否是有效的 TipTap JSON 格式
      if (parsed.type === "doc") {
        return parsed as EditorContent;
      }
    } catch {
      // 解析失败
    }
  }

  // 如果解析失败或不是 JSON，返回空文档结构（不再支持 raw string）
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: content }] }] };
}

/**
 * 从内容中提取 wiki links
 * 支持 JSON 格式和字符串格式
 */
function extractWikiLinksFromContent(content: EditorContent, cards: Card[] = []): string[] {
  const links: string[] = [];
  extractLinksFromNode(content, links, cards);
  return links;
}

/**
 * 递归从 TipTap JSON 节点中提取 wiki links
 * 注意：WikiLink 是 Mark，不是 Node，所以需要从文本中提取 [[title]] 格式
 */
function extractLinksFromNode(node: EditorContent | { type: string; attrs?: Record<string, unknown>; content?: unknown[]; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; text?: string }, links: string[], cards: Card[] = []): void {
  // 如果是文本节点，检查是否有 wikiLink mark
  if (node.type === "text" && "text" in node && node.text) {
    const text = node.text;
    // 检查是否有 wikiLink mark
    if ("marks" in node && node.marks) {
      const wikiLinkMark = node.marks.find(m => m.type === "wikiLink");
      if (wikiLinkMark && wikiLinkMark.attrs) {
        const href = wikiLinkMark.attrs.href as string | undefined;
        if (href && !links.includes(href)) {
          links.push(href);
        }
      }
    }

    // 同时从文本中提取 [[title]] 格式（作为后备方案）
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(text)) !== null) {
      const title = match[1].trim();
      // 通过标题查找卡片ID
      const card = cards.find(c => c.title === title);
      if (card && !links.includes(card.id)) {
        links.push(card.id);
      }
    }
  }

  // 递归处理子节点
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) {
        extractLinksFromNode(child as { type: string; attrs?: Record<string, unknown>; content?: unknown[]; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; text?: string }, links, cards);
      }
    }
  }
}

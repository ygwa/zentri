import { create } from "zustand";
import * as api from "@/lib/api";
import type { Card, ViewType, Source, Highlight } from "@/types";

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

  // Card 操作 (异步)
  loadCards: () => Promise<void>;
  createCard: (
    type: Card["type"],
    title: string,
    sourceId?: string
  ) => Promise<Card>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;

  // Source 操作 (异步)
  loadSources: () => Promise<void>;
  createSource: (
    data: Omit<Source, "id" | "createdAt" | "updatedAt" | "noteIds">
  ) => Promise<Source>;
  updateSource: (id: string, updates: Partial<Source>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;

  // Highlight 操作 (异步)
  loadHighlights: () => Promise<void>;
  createHighlight: (data: Omit<Highlight, "id" | "createdAt">) => Promise<Highlight>;
  deleteHighlight: (id: string) => Promise<void>;

  // Computed
  filteredCards: () => Card[];
  getCardById: (id: string) => Card | undefined;
  getSourceById: (id: string) => Source | undefined;
  getHighlightsBySource: (sourceId: string) => Highlight[];
  getNotesBySource: (sourceId: string) => Card[];
}

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

      // 检查是否在 Tauri 环境
      if (!api.isTauriEnv()) {
        console.log("Not in Tauri environment, using mock data");
        set({
          isInitialized: true,
          isLoading: false,
          vaultPath: null,
        });
        return;
      }

      // 获取已保存的 Vault 路径
      const vaultPath = await api.getVaultPath();

      if (vaultPath) {
        set({ vaultPath });

        // 加载数据
        await Promise.all([
          get().loadCards(),
          get().loadSources(),
          get().loadHighlights(),
        ]);
      }

      set({ isInitialized: true, isLoading: false });
    } catch (err) {
      console.error("Failed to initialize:", err);
      set({
        isInitialized: true,
        isLoading: false,
        error: err instanceof Error ? err.message : "初始化失败",
      });
    }
  },

  setVaultPath: async (path: string) => {
    try {
      set({ isLoading: true, error: null });

      if (api.isTauriEnv()) {
        await api.setVaultPath(path);
      }

      set({ vaultPath: path });

      // 重新加载数据
      await Promise.all([
        get().loadCards(),
        get().loadSources(),
        get().loadHighlights(),
      ]);

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

  setCurrentView: (view) => set({ currentView: view, selectedCardId: null }),
  selectCard: (id) => set({ selectedCardId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setError: (error) => set({ error }),

  // ==================== Card 操作 ====================

  loadCards: async () => {
    try {
      if (!api.isTauriEnv()) return;

      const cardItems = await api.getCards();

      // 将 CardListItem 转换为 Card (需要获取完整内容)
      const cards: Card[] = cardItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        content: "", // 列表不包含完整内容
        tags: item.tags,
        links: item.links,
        sourceId: item.sourceId,
        createdAt: item.createdAt,
        updatedAt: item.modifiedAt,
      }));

      set({ cards });
    } catch (err) {
      console.error("Failed to load cards:", err);
      set({ error: err instanceof Error ? err.message : "加载卡片失败" });
    }
  },

  createCard: async (type, title, sourceId) => {
    try {
      if (!api.isTauriEnv()) {
        // Mock 模式
        const newCard: Card = {
          id: crypto.randomUUID(),
          type,
          title,
          content: "",
          tags: [],
          links: [],
          sourceId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ cards: [newCard, ...state.cards] }));
        return newCard;
      }

      const card = await api.createCard(type, title, sourceId);
      set((state) => ({ cards: [card, ...state.cards] }));

      // 如果有关联的 source，更新 source 的 noteIds
      if (sourceId) {
        set((state) => ({
          sources: state.sources.map((s) =>
            s.id === sourceId ? { ...s, noteIds: [...s.noteIds, card.id] } : s
          ),
        }));
      }

      return card;
    } catch (err) {
      console.error("Failed to create card:", err);
      throw err;
    }
  },

  updateCard: async (id, updates) => {
    try {
      // 立即更新本地状态（乐观更新）
      set((state) => ({
        cards: state.cards.map((card) =>
          card.id === id ? { ...card, ...updates, updatedAt: Date.now() } : card
        ),
      }));

      // 同步到后端
      if (api.isTauriEnv()) {
        await api.updateCard(id, {
          title: updates.title,
          content: updates.content,
          tags: updates.tags,
          cardType: updates.type,
          links: updates.links,
        });
      }
    } catch (err) {
      console.error("Failed to update card:", err);
      // 回滚或重新加载
      get().loadCards();
      throw err;
    }
  },

  deleteCard: async (id) => {
    try {
      // 立即更新本地状态
      set((state) => ({
        cards: state.cards.filter((card) => card.id !== id),
        selectedCardId: state.selectedCardId === id ? null : state.selectedCardId,
        // 从 sources 的 noteIds 中移除
        sources: state.sources.map((s) => ({
          ...s,
          noteIds: s.noteIds.filter((nid) => nid !== id),
        })),
      }));

      // 同步到后端
      if (api.isTauriEnv()) {
        await api.deleteCard(id);
      }
    } catch (err) {
      console.error("Failed to delete card:", err);
      get().loadCards();
      throw err;
    }
  },

  // ==================== Source 操作 ====================

  loadSources: async () => {
    try {
      if (!api.isTauriEnv()) return;

      const sources = await api.getSources();
      set({ sources });
    } catch (err) {
      console.error("Failed to load sources:", err);
      set({ error: err instanceof Error ? err.message : "加载文献失败" });
    }
  },

  createSource: async (data) => {
    try {
      if (!api.isTauriEnv()) {
        const newSource: Source = {
          ...data,
          id: crypto.randomUUID(),
          noteIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ sources: [newSource, ...state.sources] }));
        return newSource;
      }

      const source = await api.createSource({
        type: data.type,
        title: data.title,
        author: data.author,
        url: data.url,
        description: data.description,
        tags: data.tags,
      });
      set((state) => ({ sources: [source, ...state.sources] }));
      return source;
    } catch (err) {
      console.error("Failed to create source:", err);
      throw err;
    }
  },

  updateSource: async (id, updates) => {
    try {
      set((state) => ({
        sources: state.sources.map((source) =>
          source.id === id
            ? { ...source, ...updates, updatedAt: Date.now() }
            : source
        ),
      }));

      if (api.isTauriEnv()) {
        await api.updateSource(id, {
          title: updates.title,
          author: updates.author,
          url: updates.url,
          description: updates.description,
          tags: updates.tags,
          progress: updates.progress,
          lastReadAt: updates.lastReadAt,
        });
      }
    } catch (err) {
      console.error("Failed to update source:", err);
      get().loadSources();
      throw err;
    }
  },

  deleteSource: async (id) => {
    try {
      set((state) => ({
        sources: state.sources.filter((source) => source.id !== id),
        highlights: state.highlights.filter((h) => h.sourceId !== id),
      }));

      if (api.isTauriEnv()) {
        await api.deleteSource(id);
      }
    } catch (err) {
      console.error("Failed to delete source:", err);
      get().loadSources();
      throw err;
    }
  },

  // ==================== Highlight 操作 ====================

  loadHighlights: async () => {
    try {
      if (!api.isTauriEnv()) return;

      const highlights = await api.getAllHighlights();
      set({ highlights });
    } catch (err) {
      console.error("Failed to load highlights:", err);
    }
  },

  createHighlight: async (data) => {
    try {
      if (!api.isTauriEnv()) {
        const newHighlight: Highlight = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        set((state) => ({ highlights: [...state.highlights, newHighlight] }));
        return newHighlight;
      }

      const highlight = await api.createHighlight({
        sourceId: data.sourceId,
        cardId: data.cardId,
        content: data.content,
        note: data.note,
        position: data.position,
        color: data.color,
      });
      set((state) => ({ highlights: [...state.highlights, highlight] }));
      return highlight;
    } catch (err) {
      console.error("Failed to create highlight:", err);
      throw err;
    }
  },

  deleteHighlight: async (id) => {
    try {
      set((state) => ({
        highlights: state.highlights.filter((h) => h.id !== id),
      }));

      if (api.isTauriEnv()) {
        await api.deleteHighlight(id);
      }
    } catch (err) {
      console.error("Failed to delete highlight:", err);
      get().loadHighlights();
      throw err;
    }
  },

  // ==================== Computed ====================

  filteredCards: () => {
    const { cards, currentView, searchQuery } = get();
    let filtered = cards;

    // Filter by view
    if (currentView !== "all") {
      filtered = filtered.filter((card) => card.type === currentView);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.content.toLowerCase().includes(query) ||
          card.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort by updated time
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getCardById: (id) => get().cards.find((card) => card.id === id),
  getSourceById: (id) => get().sources.find((source) => source.id === id),
  getHighlightsBySource: (sourceId) =>
    get().highlights.filter((h) => h.sourceId === sourceId),
  getNotesBySource: (sourceId) => {
    const source = get().sources.find((s) => s.id === sourceId);
    if (!source) return [];
    return get().cards.filter((card) => source.noteIds.includes(card.id));
  },
}));

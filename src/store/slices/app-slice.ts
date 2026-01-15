/**
 * App Slice - 应用基础状态
 */
import type { StateCreator } from "zustand";
import type { ViewType, Card } from "@/types";
import * as api from "@/services/api";

export interface AppSlice {
  // 初始化状态
  isInitialized: boolean;
  isLoading: boolean;
  vaultPath: string | null;
  error: string | null;

  // UI 状态
  currentView: ViewType;
  selectedCardId: string | null;
  searchQuery: string;

  // Actions
  setCurrentView: (view: ViewType) => void;
  selectCard: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setError: (error: string | null) => void;
  setVaultPath: (path: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsInitialized: (initialized: boolean) => void;
  // File Watching
  startFileWatching: () => void;
  stopFileWatching: () => void;

  // 扩展操作 (moved from index.ts)
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;
  openDailyNote: () => Promise<void>;
  getDailyNote: (date: string) => Promise<any | null>;
}

export const createAppSlice: StateCreator<AppSlice> = (set, get) => ({
  // 初始状态
  isInitialized: false,
  isLoading: true,
  vaultPath: null,
  error: null,
  currentView: "all",
  selectedCardId: null,
  searchQuery: "",

  // Actions
  setCurrentView: (view) => set({ currentView: view }),
  selectCard: (id) => set({ selectedCardId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setError: (error) => set({ error }),
  setVaultPath: (path) => set({ vaultPath: path }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsInitialized: (initialized: boolean) => set({ isInitialized: initialized }),

  // File Watching (implemented in store/index.ts but exposed here)
  startFileWatching: () => { }, // placeholder, overridden by index.ts logic if needed OR needs implementation
  stopFileWatching: () => { },


  // 扩展操作 (moved from index.ts)
  renameTag: async (oldTag, newTag) => {
    if (!oldTag || !newTag || oldTag === newTag) return;
    const state = get() as any;
    const cards = state.cards as Card[];
    const updateCard = state.updateCard;

    const affectedCards = cards.filter((card) => card.tags.includes(oldTag));
    await Promise.all(
      affectedCards.map(async (card) => {
        const newTags = card.tags.map((t) => (t === oldTag ? newTag : t));
        const uniqueTags = Array.from(new Set(newTags));
        await updateCard(card.id, { tags: uniqueTags });
      })
    );
  },

  deleteTag: async (tag) => {
    if (!tag) return;
    const state = get() as any;
    const cards = state.cards as Card[];
    const updateCard = state.updateCard;

    const affectedCards = cards.filter((card) => card.tags.includes(tag));
    await Promise.all(
      affectedCards.map(async (card) => {
        const newTags = card.tags.filter((t) => t !== tag);
        await updateCard(card.id, { tags: newTags });
      })
    );
  },

  openDailyNote: async () => {
    try {
      const state = get() as any;
      const cards = state.cards as Card[];
      const selectCard = state.selectCard;
      const setCurrentView = state.setCurrentView;
      // We cast set to any to bypass slice strict typing since we are updating root state
      const setRoot = set as any;

      if (!api.isTauriEnv()) {
        const today = new Date().toISOString().split("T")[0];
        const mockCard: Card = {
          id: `00_Inbox/${today}.md`,
          type: "fleeting",
          title: `日记 ${today}`,
          content: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: today }],
              },
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "今日待办" }],
              },
              {
                type: "taskList",
                content: [
                  {
                    type: "taskItem",
                    attrs: { checked: false },
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "笔记" }],
              },
              { type: "paragraph" },
            ],
          },
          tags: ["daily"],
          links: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const exists = cards.find((c) => c.id === mockCard.id);
        if (!exists) {            // We need to call a method to add card, OR set state. 
          // set({ cards: ... }) works if set merges to root. Zustand set merges to root.
          setRoot((prev: any) => ({ cards: [mockCard, ...prev.cards] }));
        }
        selectCard(mockCard.id);
        setCurrentView("all");
        return;
      }

      const card = await api.dailyNote.getOrCreate();
      const exists = cards.find((c) => c.id === card.id);
      if (!exists) {
        setRoot((prev: any) => ({ cards: [card, ...prev.cards] }));
      }
      selectCard(card.id);
      setCurrentView("all");
    } catch (err) {
      console.error("Failed to open daily note:", err);
    }
  },

  getDailyNote: async (date) => {
    try {
      if (!api.isTauriEnv()) return null;
      return await api.dailyNote.get(date);
    } catch (err) {
      console.error("Failed to get daily note:", err);
      return null;
    }
  },
});






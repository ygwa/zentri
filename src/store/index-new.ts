/**
 * Zentri Store - 应用状态管理（重构版）
 * 使用 Zustand 实现，按功能域拆分为多个 slice
 */
import { create } from "zustand";
import type { StateCreator } from "zustand";
import * as api from "@/services/api";
import type { Card, ViewType } from "@/types";
import {
  type AppSlice,
  createAppSlice,
  type CardsSlice,
  createCardsSlice,
  type SourcesSlice,
  createSourcesSlice,
  type HighlightsSlice,
  createHighlightsSlice,
  type CanvasSlice,
  createCanvasSlice,
} from "./slices";

// ==================== 组合类型 ====================

type StoreState = AppSlice & CardsSlice & SourcesSlice & HighlightsSlice & CanvasSlice;

// ==================== 初始化 Slice ====================

const createStoreSlice: StateCreator<StoreState> = (...args) => ({
  ...createAppSlice(...args),
  ...createCardsSlice(...args),
  ...createSourcesSlice(...args),
  ...createHighlightsSlice(...args),
  ...createCanvasSlice(...args),
});

// ==================== Store ====================

export const useAppStore = create<StoreState>()(createStoreSlice);

// ==================== 初始化逻辑 ====================

let fileWatchIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * 初始化应用
 */
export async function initializeApp() {
  const { setIsLoading, setIsInitialized, setVaultPath, setError, loadCards, loadSources, loadHighlights, startFileWatching } = useAppStore.getState();

  try {
    setIsLoading(true);
    setError(null);

    if (!api.isTauriEnv()) {
      console.log("Not in Tauri environment, using mock data");
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      const vaultPath = await api.vault.getPath();

      if (vaultPath) {
        setVaultPath(vaultPath);

        await Promise.all([
          loadCards(),
          loadSources(),
          loadHighlights(),
        ]);

        startFileWatching();
      }
    } catch (e) {
      console.warn("Failed to get vault path or load data:", e);
    }

    setIsInitialized(true);
    setIsLoading(false);
  } catch (err) {
    console.error("Failed to initialize:", err);
    setError(err instanceof Error ? err.message : "初始化失败");
    setIsInitialized(true);
    setIsLoading(false);
  }
}

/**
 * 设置 Vault 路径
 */
export async function setVaultPath(path: string) {
  const {
    setIsLoading,
    setVaultPath: setVaultPathState,
    setError,
    stopFileWatching,
    loadCards,
    loadSources,
    loadHighlights,
    startFileWatching,
  } = useAppStore.getState();

  try {
    setIsLoading(true);
    setError(null);
    stopFileWatching();

    if (api.isTauriEnv()) {
      await api.vault.setPath(path);
    }

    setVaultPathState(path);

    await Promise.all([
      loadCards(),
      loadSources(),
      loadHighlights(),
    ]);

    startFileWatching();
    setIsLoading(false);
  } catch (err) {
    console.error("Failed to set vault path:", err);
    setError(err instanceof Error ? err.message : "设置路径失败");
    setIsLoading(false);
  }
}

// ==================== 文件监听 ====================

export function startFileWatching() {
  if (fileWatchIntervalId !== null) return;
  if (!api.isTauriEnv()) return;

  console.log("Starting file watching...");
  fileWatchIntervalId = setInterval(() => {
    pollFileChanges();
  }, 2000);
}

export function stopFileWatching() {
  if (fileWatchIntervalId !== null) {
    console.log("Stopping file watching...");
    clearInterval(fileWatchIntervalId);
    fileWatchIntervalId = null;
  }
}

async function pollFileChanges() {
  try {
    if (!api.isTauriEnv()) return;

    const changes = await api.watcher.pollChanges();

    if (changes.changedIds.length === 0 && changes.removedIds.length === 0) {
      return;
    }

    console.log("File changes detected:", changes);

    const { cards, selectCard, loadCardContent, deleteCard } = useAppStore.getState();

    // 处理删除的卡片
    if (changes.removedIds.length > 0) {
      const { selectedCardId } = useAppStore.getState();
      changes.removedIds.forEach((id) => {
        deleteCard(id);
      });
      if (changes.removedIds.includes(selectedCardId || "")) {
        selectCard(null);
      }
    }

    // 处理变化的卡片
    if (changes.changedIds.length > 0) {
      const { loadCardContent } = useAppStore.getState();
      for (const id of changes.changedIds) {
        loadCardContent(id);
      }
    }
  } catch (err) {
    console.error("Failed to poll file changes:", err);
  }
}

// 扩展 Store 以包含文件监听函数
useAppStore.setState({
  startFileWatching,
  stopFileWatching,
  pollFileChanges,
} as any);

// ==================== 扩展 Store ====================

// 添加一些组合操作
useAppStore.setState({
  // Tag 操作
  renameTag: async (oldTag: string, newTag: string) => {
    if (!oldTag || !newTag || oldTag === newTag) return;

    const { cards, updateCard } = useAppStore.getState();
    const affectedCards = cards.filter((card) => card.tags.includes(oldTag));

    await Promise.all(
      affectedCards.map(async (card) => {
        const newTags = card.tags.map((t) => (t === oldTag ? newTag : t));
        const uniqueTags = Array.from(new Set(newTags));
        await updateCard(card.id, { tags: uniqueTags });
      })
    );
  },

  deleteTag: async (tag: string) => {
    if (!tag) return;

    const { cards, updateCard } = useAppStore.getState();
    const affectedCards = cards.filter((card) => card.tags.includes(tag));

    await Promise.all(
      affectedCards.map(async (card) => {
        const newTags = card.tags.filter((t) => t !== tag);
        await updateCard(card.id, { tags: newTags });
      })
    );
  },

  // Daily Note
  openDailyNote: async () => {
    try {
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
        const { cards, selectCard, setCurrentView } = useAppStore.getState();
        const exists = cards.find((c) => c.id === mockCard.id);
        if (!exists) {
          useAppStore.setState({ cards: [mockCard, ...cards] });
        }
        selectCard(mockCard.id);
        setCurrentView("all");
        return;
      }

      const card = await api.dailyNote.getOrCreate();
      const { cards, selectCard, setCurrentView } = useAppStore.getState();
      const exists = cards.find((c) => c.id === card.id);
      if (!exists) {
        useAppStore.setState({ cards: [card, ...cards] });
      }
      selectCard(card.id);
      setCurrentView("all");
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
});


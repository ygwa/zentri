/**
 * Zentri Store - 应用状态管理（重构版）
 * 使用 Zustand 实现，按功能域拆分为多个 slice
 */
import { create } from "zustand";
import type { StateCreator } from "zustand";
import * as api from "@/services/api";
import type { Card } from "@/types";
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

type StoreState = AppSlice & CardsSlice & SourcesSlice & HighlightsSlice & CanvasSlice & {
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;
  openDailyNote: () => Promise<void>;
  getDailyNote: (date: string) => Promise<Card | null>;
};

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

// ==================== 文件监听 (带页面可见性检测) ====================

let fileWatchIntervalId: ReturnType<typeof setInterval> | null = null;
let isPageVisible = true;
let pollErrorCount = 0;
const MAX_POLL_ERRORS = 3;
const POLL_INTERVAL = 3000; // 3 seconds

// 页面可见性变化处理
function handleVisibilityChange() {
  isPageVisible = !document.hidden;

  if (isPageVisible) {
    console.log("Page visible, resuming file watching...");
    // 恢复轮询前先立即检查一次变化
    pollFileChanges();
  } else {
    console.log("Page hidden, pausing file watching...");
  }
}

// 初始化页面可见性监听
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

export function startFileWatching() {
  if (fileWatchIntervalId !== null) return;
  if (!api.isTauriEnv()) return;

  console.log("Starting file watching (3s interval with visibility detection)...");
  pollErrorCount = 0;

  fileWatchIntervalId = setInterval(() => {
    // 只在页面可见时轮询
    if (isPageVisible) {
      pollFileChanges();
    }
  }, POLL_INTERVAL);
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

    // 重置错误计数
    pollErrorCount = 0;

    if (changes.changedIds.length === 0 && changes.removedIds.length === 0) {
      return;
    }

    console.log("File changes detected:", changes);

    const { selectCard, loadCardContent, deleteCard, selectedCardId } = useAppStore.getState();

    // 处理删除的卡片
    if (changes.removedIds.length > 0) {
      changes.removedIds.forEach((id) => {
        deleteCard(id);
      });
      if (changes.removedIds.includes(selectedCardId || "")) {
        selectCard(null);
      }
    }

    // 处理变化的卡片
    if (changes.changedIds.length > 0) {
      for (const id of changes.changedIds) {
        loadCardContent(id);
      }
    }
  } catch (err) {
    pollErrorCount++;
    console.error(`Poll file changes error (${pollErrorCount}/${MAX_POLL_ERRORS}):`, err);

    // 达到最大错误次数后暂停轮询，等待下一个周期自动重试
    if (pollErrorCount >= MAX_POLL_ERRORS) {
      console.warn("Max poll errors reached, will retry on next cycle");
      pollErrorCount = 0; // 重置，下个周期可以继续尝试
    }
  }
}



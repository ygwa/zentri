/**
 * Highlights Slice - 高亮相关状态和操作
 */
import type { StateCreator } from "zustand";
import type { Highlight } from "@/types";
import * as api from "@/services/api";

export interface HighlightsSlice {
  // 数据
  highlights: Highlight[];

  // Actions
  loadHighlights: () => Promise<void>;
  createHighlight: (data: Omit<Highlight, "id" | "createdAt">) => Promise<Highlight>;
  deleteHighlight: (id: string) => Promise<void>;

  // Computed
  getHighlightsBySource: (sourceId: string) => Highlight[];
}

export const createHighlightsSlice: StateCreator<HighlightsSlice> = (set, get) => ({
  // 初始状态
  highlights: [],

  // Actions
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

  // Computed
  getHighlightsBySource: (sourceId) =>
    get().highlights.filter((h) => h.sourceId === sourceId),
});






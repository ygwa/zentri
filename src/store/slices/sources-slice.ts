/**
 * Sources Slice - 文献源相关状态和操作
 */
import type { StateCreator } from "zustand";
import type { Source } from "@/types";
import * as api from "@/services/api";

export interface SourcesSlice {
  // 数据
  sources: Source[];

  // Actions
  loadSources: () => Promise<void>;
  createSource: (
    data: Omit<Source, "id" | "createdAt" | "updatedAt" | "noteIds">
  ) => Promise<Source>;
  updateSource: (id: string, updates: Partial<Source>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;

  // Computed
  getSourceById: (id: string) => Source | undefined;
  getNotesBySource: (sourceId: string) => string[];
}

export const createSourcesSlice: StateCreator<SourcesSlice> = (set, get) => ({
  // 初始状态
  sources: [],

  // Actions
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

  // Computed
  getSourceById: (id) => get().sources.find((source) => source.id === id),

  getNotesBySource: (sourceId) => {
    const source = get().sources.find((s) => s.id === sourceId);
    return source?.noteIds || [];
  },
});






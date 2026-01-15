/**
 * Canvas Slice - 白板相关状态和操作
 */
import type { StateCreator } from "zustand";
import type { Canvas, CanvasListItem } from "@/types/canvas";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/services/api";

export interface CanvasSlice {
  // 数据
  canvases: CanvasListItem[];
  currentCanvas: Canvas | null;

  // 状态
  isLoadingCanvases: boolean;
  isSavingCanvas: boolean;

  // Actions
  loadCanvases: () => Promise<void>;
  loadCanvas: (id: string) => Promise<Canvas | null>;
  createCanvas: (title: string) => Promise<Canvas>;
  updateCanvas: (
    id: string,
    updates: {
      title?: string;
      nodes?: unknown;
      edges?: unknown;
    }
  ) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;

  // Computed
  getCanvasById: (id: string) => CanvasListItem | undefined;
}

export const createCanvasSlice: StateCreator<CanvasSlice> = (set, get) => ({
  // 初始状态
  canvases: [],
  currentCanvas: null,
  isLoadingCanvases: false,
  isSavingCanvas: false,

  // Actions
  loadCanvases: async () => {
    try {
      if (!isTauriEnv()) return;

      set({ isLoadingCanvases: true });
      const canvases = await invoke<CanvasListItem[]>("get_canvases");
      set({ canvases, isLoadingCanvases: false });
    } catch (err) {
      console.error("Failed to load canvases:", err);
      set({ isLoadingCanvases: false });
    }
  },

  loadCanvas: async (id: string) => {
    try {
      if (!isTauriEnv()) return null;

      const canvas = await invoke<Canvas | null>("get_canvas", { id });
      if (canvas) {
        set({ currentCanvas: canvas });
        return canvas;
      }
      return null;
    } catch (err) {
      console.error("Failed to load canvas:", err);
      return null;
    }
  },

  createCanvas: async (title: string) => {
    if (!isTauriEnv()) {
      const mockCanvas: Canvas = {
        id: `mock-canvas-${Date.now()}`,
        title,
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const listItem: CanvasListItem = {
        id: mockCanvas.id,
        title: mockCanvas.title,
        createdAt: mockCanvas.createdAt,
        updatedAt: mockCanvas.updatedAt,
      };
      set((state) => ({
        canvases: [listItem, ...state.canvases],
        currentCanvas: mockCanvas,
      }));
      return mockCanvas;
    }

    const canvas = await invoke<Canvas>("create_canvas", { title });
    const listItem: CanvasListItem = {
      id: canvas.id,
      title: canvas.title,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
    };
    set((state) => ({
      canvases: [listItem, ...state.canvases],
      currentCanvas: canvas,
    }));
    return canvas;
  },

  updateCanvas: async (id, updates) => {
    if (!isTauriEnv()) {
      // Mock 模式：只更新本地状态
      if (get().currentCanvas?.id === id) {
        set((state) => ({
          currentCanvas: state.currentCanvas
            ? { ...state.currentCanvas, ...updates, updatedAt: Date.now() } as any
            : null,
        }));
      }
      return;
    }

    set({ isSavingCanvas: true });
    try {
      const canvas = await invoke<Canvas>("update_canvas", {
        id,
        title: updates.title,
        nodes: updates.nodes,
        edges: updates.edges,
      });

      // 更新列表中的项
      set((state) => ({
        canvases: state.canvases.map((c) =>
          c.id === id
            ? {
              id: canvas.id,
              title: canvas.title,
              createdAt: canvas.createdAt,
              updatedAt: canvas.updatedAt,
            }
            : c
        ),
        currentCanvas: canvas,
        isSavingCanvas: false,
      }));
    } catch (err) {
      console.error("Failed to update canvas:", err);
      set({ isSavingCanvas: false });
      throw err;
    }
  },

  deleteCanvas: async (id: string) => {
    if (!isTauriEnv()) {
      set((state) => ({
        canvases: state.canvases.filter((c) => c.id !== id),
        currentCanvas:
          state.currentCanvas?.id === id ? null : state.currentCanvas,
      }));
      return;
    }

    await invoke("delete_canvas", { id });
    set((state) => ({
      canvases: state.canvases.filter((c) => c.id !== id),
      currentCanvas:
        state.currentCanvas?.id === id ? null : state.currentCanvas,
    }));
  },

  // Computed
  getCanvasById: (id) => get().canvases.find((canvas) => canvas.id === id),
});






/**
 * App Slice - 应用基础状态
 */
import type { StateCreator } from "zustand";
import type { ViewType } from "@/types";

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
}

export const createAppSlice: StateCreator<AppSlice> = (set) => ({
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
  setSearchQuery: (query) => set({ searchQuery }),
  setError: (error) => set({ error }),
  setVaultPath: (path) => set({ vaultPath: path }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsInitialized: (initialized) => set({ isInitialized: initialized }),
});



import { create } from "zustand";
import type { Card, ViewType } from "@/types";

// Mock 数据
const mockCards: Card[] = [
  {
    id: "1",
    type: "fleeting",
    title: "Rust 所有权的思考",
    content: "今天看书发现，Rust 的所有权其实就像是一种独占式资源管理...",
    tags: ["Rust", "编程"],
    links: ["3"],
    createdAt: Date.now() - 1000 * 60 * 30,
    updatedAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: "2",
    type: "fleeting",
    title: "本周学习回顾",
    content: "这周主要学习了 Tauri 框架和 Rust 的基础语法，感觉 Rust 的学习曲线确实比较陡峭。",
    tags: ["周记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "3",
    type: "permanent",
    title: "零成本抽象 (Zero-Cost Abstraction)",
    content: "零成本抽象是 C++ 和 Rust 的核心设计哲学之一。它的含义是：你不需要为你没有使用的特性付出代价，而你使用的特性也不会比手写代码更慢。",
    tags: ["Rust", "性能"],
    links: ["1", "4"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "4",
    type: "permanent",
    title: "所有权 vs 垃圾回收",
    content: "Rust 的所有权系统与传统 GC 的对比：所有权在编译期完成内存安全检查，GC 在运行时管理内存。",
    tags: ["Rust", "内存管理"],
    links: ["3"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: "5",
    type: "literature",
    title: "《Rust 程序设计语言》笔记",
    content: "第四章：理解所有权。所有权是 Rust 最独特的特性，它让 Rust 无需垃圾回收器即可保证内存安全。",
    tags: ["Rust", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
  },
  {
    id: "6",
    type: "project",
    title: "Zentri 卡片笔记应用",
    content: "一个基于 Tauri + React 的本地优先卡片笔记应用，实现 Zettelkasten 方法论。",
    tags: ["项目", "Tauri"],
    links: ["1", "3", "5"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 1,
  },
];

interface AppState {
  // 数据
  cards: Card[];
  
  // UI 状态
  currentView: ViewType;
  selectedCardId: string | null;
  searchQuery: string;
  
  // Actions
  setCurrentView: (view: ViewType) => void;
  selectCard: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  
  // Card operations
  createCard: (type: Card["type"], title: string) => Card;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  
  // Computed
  filteredCards: () => Card[];
  getCardById: (id: string) => Card | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  cards: mockCards,
  currentView: "all",
  selectedCardId: null,
  searchQuery: "",
  
  setCurrentView: (view) => set({ currentView: view, selectedCardId: null }),
  selectCard: (id) => set({ selectedCardId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  createCard: (type, title) => {
    const newCard: Card = {
      id: crypto.randomUUID(),
      type,
      title,
      content: "",
      tags: [],
      links: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ cards: [newCard, ...state.cards] }));
    return newCard;
  },
  
  updateCard: (id, updates) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, ...updates, updatedAt: Date.now() } : card
      ),
    }));
  },
  
  deleteCard: (id) => {
    set((state) => ({
      cards: state.cards.filter((card) => card.id !== id),
      selectedCardId: state.selectedCardId === id ? null : state.selectedCardId,
    }));
  },
  
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
}));


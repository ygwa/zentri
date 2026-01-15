/**
 * 路由路径常量
 * 集中管理所有路由路径，提供类型安全的路径生成
 */

export const ROUTES = {
  /** 工作区路由 */
  WORKSPACE: {
    ROOT: "/workspace",
    DASHBOARD: "/workspace/dashboard",
    BOARDS: "/workspace/boards",
    CANVAS: (id: string) => `/workspace/canvas/${id}`,
    GRAPH: "/workspace/graph",
  },
  /** 图书馆路由 */
  LIBRARY: {
    ROOT: "/library",
    LIST: "/library",
    SOURCE: (id: string) => `/library/source/${id}`,
  },
  /** 笔记路由 */
  NOTES: {
    ROOT: "/notes",
    CARD: (id: string) => `/notes/card/${id}`,
    PERMANENT: (id: string) => `/notes/permanent/${id}`,
    PROJECT: (id: string) => `/notes/project/${id}`,
  },
  /** 复习路由 */
  REVIEW: {
    ROOT: "/review",
    LIST: "/review",
  },
  /** 标签路由 */
  TAGS: {
    ROOT: "/tags",
    LIST: "/tags",
  },
  /** 设置路由 */
  SETTINGS: {
    ROOT: "/settings",
    PAGE: "/settings",
  },
  /** AI 路由 */
  AI: {
    ROOT: "/ai-chat",
    CHAT: "/ai-chat",
  },
} as const;

/**
 * 向后兼容的旧路径（用于重定向）
 * 保持现有 URL 结构不变
 */
export const LEGACY_ROUTES = {
  DASHBOARD: "/dashboard",
  LIBRARY: "/library",
  REVIEW: "/review",
  TAGS: "/tags",
  BOARDS: "/boards",
  GRAPH: "/graph",
  SETTINGS: "/settings",
  AI_CHAT: "/ai-chat",
  SOURCE: (id: string) => `/source/${id}`,
  CANVAS: (id: string) => `/canvas/${id}`,
  PERMANENT: (id: string) => `/permanent/${id}`,
  PROJECT: (id: string) => `/project/${id}`,
  CARD: (id: string) => `/card/${id}`,
} as const;


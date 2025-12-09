// 卡片类型
export type CardType = "fleeting" | "literature" | "permanent" | "project";

// 卡片数据结构
export interface Card {
  id: string;
  type: CardType;
  title: string;
  content: string;
  tags: string[];
  links: string[]; // 关联的卡片 ID
  sourceId?: string; // 关联的文献源 ID（用于文献笔记）
  createdAt: number;
  updatedAt: number;
}

// 视图类型
export type ViewType = "all" | CardType;

// ==================== 文献库类型 ====================

// 文献源类型
export type SourceType = "book" | "article" | "webpage" | "video" | "podcast" | "paper";

// 文献源（书籍、网页等）
export interface Source {
  id: string;
  type: SourceType;
  title: string;
  author?: string;
  url?: string; // 网页链接或文件路径
  cover?: string; // 封面图片
  description?: string;
  tags: string[];
  // 阅读进度
  progress: number; // 0-100
  lastReadAt?: number;
  // 元数据
  metadata?: {
    isbn?: string;
    publisher?: string;
    publishDate?: string;
    pageCount?: number;
    duration?: number; // 视频/播客时长（秒）
  };
  // 关联的文献笔记 ID 列表
  noteIds: string[];
  createdAt: number;
  updatedAt: number;
}

// 文献笔记高亮/摘录
export interface Highlight {
  id: string;
  sourceId: string;
  cardId?: string; // 关联的卡片笔记 ID
  content: string; // 高亮内容
  note?: string; // 批注
  position?: {
    // 位置信息（用于定位）
    page?: number;
    chapter?: string;
    startOffset?: number;
    endOffset?: number;
  };
  color?: string;
  createdAt: number;
}


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
  createdAt: number;
  updatedAt: number;
}

// 视图类型
export type ViewType = "all" | CardType;


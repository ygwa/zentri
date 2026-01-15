import type { ExtendedRouteObject } from "../types";
import { AIChatPage } from "@/pages/ai-chat-page";

/**
 * AI 路由配置
 */
export const aiRoutes: ExtendedRouteObject[] = [
  {
    path: "ai-chat",
    element: <AIChatPage />,
    meta: {
      layout: "main",
      title: "AI 聊天",
    },
  },
];


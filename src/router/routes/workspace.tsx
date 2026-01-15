import type { ExtendedRouteObject } from "../types";
import { DashboardPage } from "@/pages/dashboard-page";
import { BoardsPage } from "@/pages/boards-page";
import { CanvasDetailPage } from "@/pages/canvas-detail-page";
import { GraphPage } from "@/pages/graph-page";

/**
 * 工作区路由配置
 */
export const workspaceRoutes: ExtendedRouteObject[] = [
  {
    path: "dashboard",
    element: <DashboardPage />,
    meta: {
      layout: "main",
      title: "工作台",
    },
  },
  {
    path: "boards",
    element: <BoardsPage />,
    meta: {
      layout: "main",
      title: "画板",
    },
  },
  {
    path: "canvas/:id",
    element: <CanvasDetailPage />,
    meta: {
      layout: "fullscreen",
      title: "画布",
    },
  },
  {
    path: "graph",
    element: <GraphPage />,
    meta: {
      layout: "fullscreen",
      title: "知识图谱",
    },
  },
];


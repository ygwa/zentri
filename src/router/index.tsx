import { createBrowserRouter, Navigate } from "react-router-dom";
import { LayoutRouter } from "@/components/layout/layout-router";
import type { ExtendedRouteObject } from "./types";
import { workspaceRoutes } from "./routes/workspace.tsx";
import { libraryRoutes } from "./routes/library.tsx";
import { notesRoutes } from "./routes/notes.tsx";
import { reviewRoutes } from "./routes/review.tsx";
import { tagsRoutes } from "./routes/tags.tsx";
import { settingsRoutes } from "./routes/settings.tsx";
import { aiRoutes } from "./routes/ai.tsx";

/**
 * 整合所有路由配置
 * 保持现有 URL 路径不变以确保向后兼容
 */
const allRoutes: ExtendedRouteObject[] = [
  ...workspaceRoutes,
  ...libraryRoutes,
  ...notesRoutes,
  ...reviewRoutes,
  ...tagsRoutes,
  ...settingsRoutes,
  ...aiRoutes,
];

/**
 * 创建路由配置
 * 使用扁平结构保持现有 URL 路径不变
 * 注意：React Router 的 RouteObject 不直接支持 meta 字段，
 * 但我们可以通过类型断言来使用扩展的路由对象
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <LayoutRouter />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...(allRoutes as any), // 类型断言以支持扩展的 meta 字段
    ],
  },
]);


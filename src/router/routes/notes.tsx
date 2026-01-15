import type { ExtendedRouteObject } from "../types";
import { CardDetailPage } from "@/pages/card-detail-page";
import { PermanentNotePage } from "@/pages/permanent-note-page";
import { ProjectNotePage } from "@/pages/project-note-page";

/**
 * 笔记路由配置
 */
export const notesRoutes: ExtendedRouteObject[] = [
  {
    path: "card/:id",
    element: <CardDetailPage />,
    meta: {
      layout: "focus",
      title: "笔记",
    },
  },
  {
    path: "permanent/:id",
    element: <PermanentNotePage />,
    meta: {
      layout: "focus",
      title: "永久笔记",
    },
  },
  {
    path: "project/:id",
    element: <ProjectNotePage />,
    meta: {
      layout: "focus",
      title: "项目笔记",
    },
  },
];


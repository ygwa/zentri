import type { ExtendedRouteObject } from "../types";
import { LibraryPage } from "@/pages/library-page";
import { SourceDetailPage } from "@/pages/source-detail-page";

/**
 * 图书馆路由配置
 */
export const libraryRoutes: ExtendedRouteObject[] = [
  {
    path: "library",
    element: <LibraryPage />,
    meta: {
      layout: "main",
      title: "图书馆",
    },
  },
  {
    path: "source/:id",
    element: <SourceDetailPage />,
    meta: {
      layout: "main",
      title: "文献详情",
    },
  },
];


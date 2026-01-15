import type { ExtendedRouteObject } from "../types";
import { TagsPage } from "@/pages/tags-page";

/**
 * 标签路由配置
 */
export const tagsRoutes: ExtendedRouteObject[] = [
  {
    path: "tags",
    element: <TagsPage />,
    meta: {
      layout: "main",
      title: "标签",
    },
  },
];


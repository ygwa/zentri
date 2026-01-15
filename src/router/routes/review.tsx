import type { ExtendedRouteObject } from "../types";
import { ReviewPage } from "@/pages/review-page";

/**
 * 复习路由配置
 */
export const reviewRoutes: ExtendedRouteObject[] = [
  {
    path: "review",
    element: <ReviewPage />,
    meta: {
      layout: "main",
      title: "复习",
    },
  },
];


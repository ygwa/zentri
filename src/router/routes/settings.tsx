import type { ExtendedRouteObject } from "../types";
import { SettingsPage } from "@/pages/settings-page";

/**
 * 设置路由配置
 */
export const settingsRoutes: ExtendedRouteObject[] = [
  {
    path: "settings",
    element: <SettingsPage />,
    meta: {
      layout: "settings",
      title: "设置",
    },
  },
];


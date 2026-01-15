import type { LayoutType, ExtendedRouteObject } from "./types";
import { workspaceRoutes } from "./routes/workspace.tsx";
import { libraryRoutes } from "./routes/library.tsx";
import { notesRoutes } from "./routes/notes.tsx";
import { reviewRoutes } from "./routes/review.tsx";
import { tagsRoutes } from "./routes/tags.tsx";
import { settingsRoutes } from "./routes/settings.tsx";

/**
 * 所有路由配置
 */
const allRoutes: ExtendedRouteObject[] = [
  ...workspaceRoutes,
  ...libraryRoutes,
  ...notesRoutes,
  ...reviewRoutes,
  ...tagsRoutes,
  ...settingsRoutes,
];

/**
 * 根据路径匹配路由并获取布局类型
 * @param pathname 当前路径
 * @returns 布局类型，如果未匹配则返回 'main'
 */
export function getLayoutFromPath(pathname: string): LayoutType {
  // 移除前导斜杠并分割路径
  const pathSegments = pathname.split("/").filter(Boolean);
  
  // 遍历所有路由配置，查找匹配的路由
  for (const route of allRoutes) {
    if (!route.path) continue;
    
    // 将路由路径转换为正则表达式
    const routePathSegments = route.path.split("/").filter(Boolean);
    
    // 如果路径段数量不匹配，跳过
    if (routePathSegments.length !== pathSegments.length) {
      continue;
    }
    
    // 检查路径是否匹配（支持参数占位符 :id）
    let isMatch = true;
    for (let i = 0; i < routePathSegments.length; i++) {
      const routeSegment = routePathSegments[i];
      const pathSegment = pathSegments[i];
      
      // 如果是参数占位符（:id），匹配任何值
      if (routeSegment.startsWith(":")) {
        continue;
      }
      
      // 否则必须完全匹配
      if (routeSegment !== pathSegment) {
        isMatch = false;
        break;
      }
    }
    
    if (isMatch && route.meta?.layout) {
      return route.meta.layout;
    }
  }
  
  // 默认返回 main 布局
  return "main";
}

/**
 * 根据路径获取路由元数据
 * @param pathname 当前路径
 * @returns 路由元数据，如果未匹配则返回 null
 */
export function getRouteMeta(pathname: string): ExtendedRouteObject["meta"] | null {
  const pathSegments = pathname.split("/").filter(Boolean);
  
  for (const route of allRoutes) {
    if (!route.path) continue;
    
    const routePathSegments = route.path.split("/").filter(Boolean);
    
    if (routePathSegments.length !== pathSegments.length) {
      continue;
    }
    
    let isMatch = true;
    for (let i = 0; i < routePathSegments.length; i++) {
      const routeSegment = routePathSegments[i];
      const pathSegment = pathSegments[i];
      
      if (routeSegment.startsWith(":")) {
        continue;
      }
      
      if (routeSegment !== pathSegment) {
        isMatch = false;
        break;
      }
    }
    
    if (isMatch) {
      return route.meta || null;
    }
  }
  
  return null;
}


import type { RouteObject } from "react-router-dom";

/**
 * 布局类型
 */
export type LayoutType = "main" | "fullscreen" | "focus" | "settings";

/**
 * 路由元数据
 * 用于管理路由的布局、标题等信息
 */
export interface RouteMeta {
  /** 布局类型 */
  layout: LayoutType;
  /** 页面标题 */
  title?: string;
  /** 是否需要认证（预留） */
  requiresAuth?: boolean;
}

/**
 * 扩展的路由对象
 * 在 React Router 的 RouteObject 基础上添加元数据支持
 */
export type ExtendedRouteObject = RouteObject & {
  /** 路由元数据 */
  meta?: RouteMeta;
  /** 子路由 */
  children?: ExtendedRouteObject[];
};


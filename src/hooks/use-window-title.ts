/**
 * 动态窗口标题 Hook
 * 根据当前页面状态更新窗口标题
 */
import { useEffect, useMemo } from "react";
import { isTauriEnv } from "@/services/api/utils";

const APP_NAME = "Zentri";

/**
 * 设置窗口标题
 * @param title - 要设置的标题，会自动添加应用名称后缀
 */
export async function setWindowTitle(title: string | null) {
  const fullTitle = title ? `${title} - ${APP_NAME}` : APP_NAME;
  
  // 同时更新 document.title（用于非 Tauri 环境）
  document.title = fullTitle;
  
  // 在 Tauri 环境中更新窗口标题
  if (isTauriEnv()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      
      // 检测平台
      const isMacOS = navigator.platform.toLowerCase().includes("mac");
      
      // 在 macOS 上，设置空标题以隐藏系统标题栏文字（我们使用自定义标题栏显示居中标题）
      // 在其他平台上，显示完整标题
      const windowTitle = isMacOS ? "" : fullTitle;
      await currentWindow.setTitle(windowTitle);
    } catch (e) {
      console.warn("Failed to set window title:", e);
    }
  }
}

/**
 * 根据视图类型获取标题
 */
const VIEW_TITLES: Record<string, string> = {
  all: "所有卡片",
  fleeting: "闪念",
  literature: "文献笔记",
  permanent: "永久笔记",
  project: "项目",
  sources: "文献源",
  graph: "知识图谱",
  kanban: "看板",
  dashboard: "工作台",
  library: "书架",
  review: "回顾",
  tags: "标签",
  settings: "设置",
};

interface UseWindowTitleOptions {
  /** 当前视图类型 */
  currentView?: string;
  /** 当前选中的卡片标题 */
  selectedCardTitle?: string | null;
  /** 当前打开的文献源标题 */
  openedSourceTitle?: string | null;
}

/**
 * Hook: 自动管理窗口标题
 * 
 * 优先级：
 * 1. 打开的文献源标题
 * 2. 选中的卡片标题
 * 3. 当前视图名称
 * 4. 默认应用名称
 */
export function useWindowTitle({
  currentView,
  selectedCardTitle,
  openedSourceTitle,
}: UseWindowTitleOptions) {
  // 使用 useMemo 计算最终标题，避免不必要的重新计算
  const finalTitle = useMemo(() => {
    if (openedSourceTitle) {
      // 优先显示打开的文献源
      return openedSourceTitle;
    } else if (selectedCardTitle) {
      // 其次显示选中的卡片
      return selectedCardTitle;
    } else if (currentView && VIEW_TITLES[currentView]) {
      // 最后显示当前视图
      return VIEW_TITLES[currentView];
    }
    return null;
  }, [currentView, selectedCardTitle, openedSourceTitle]);

  useEffect(() => {
    setWindowTitle(finalTitle);
  }, [finalTitle]);
}


/**
 * 原生功能 Hook
 * 处理文件拖拽、系统主题等原生功能
 */
import { useEffect } from "react";
import { isTauriEnv } from "@/services/api/utils";

// 声明全局函数类型
declare global {
  interface Window {
    handleFileDrop?: (paths: string[]) => void;
  }
}

/**
 * 处理 Tauri 原生文件拖拽
 */
export function useNativeFileDrop(onFileDrop: (paths: string[]) => void) {
  useEffect(() => {
    if (!isTauriEnv()) return;

    // 注册全局文件拖拽处理函数
    window.handleFileDrop = (paths: string[]) => {
      onFileDrop(paths);
    };

    return () => {
      delete window.handleFileDrop;
    };
  }, [onFileDrop]);
}

/**
 * 监听系统主题变化（深色/浅色模式）
 */
export function useSystemTheme() {
  useEffect(() => {
    if (!isTauriEnv()) return;

    const updateTheme = async () => {
      try {
        
        
        // 获取系统主题
        // Tauri 2.0 可能使用不同的 API，这里需要根据实际 API 调整
        // 如果 API 不支持，可以使用 CSS media query 监听
        
        // 使用 CSS media query 作为备选方案
        const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
        
        const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
          const isDark = e.matches;
          document.documentElement.classList.toggle("dark", isDark);
        };
        
        // 初始设置
        handleThemeChange(darkModeQuery);
        
        // 监听变化
        if (darkModeQuery.addEventListener) {
          darkModeQuery.addEventListener("change", handleThemeChange);
          return () => {
            darkModeQuery.removeEventListener("change", handleThemeChange);
          };
        } else {
          // 兼容旧版 API
          darkModeQuery.addListener(handleThemeChange);
          return () => {
            darkModeQuery.removeListener(handleThemeChange);
          };
        }
      } catch (error) {
        console.warn("Failed to setup system theme listener:", error);
      }
    };

    updateTheme();
  }, []);
}


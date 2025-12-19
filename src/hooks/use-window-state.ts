/**
 * 窗口状态管理 Hook
 * 
 * 注意：窗口配置的保存和恢复现在完全由 Rust 端处理
 * - 窗口配置在 Rust 端 setup hook 中恢复
 * - resize、move、close 事件在 Rust 端监听并保存
 * - 这样可以确保正确处理 DPI 缩放，使用逻辑大小而不是物理大小
 * 
 * 这个 hook 现在主要用于标记初始化状态，实际功能已移至 Rust 端
 */
import { useEffect, useRef } from "react";
import { isTauriEnv } from "@/services/api/utils";

export function useWindowState() {
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!isTauriEnv()) {
      return;
    }

    // 标记已初始化
    // 窗口配置的保存和恢复完全由 Rust 端处理
    isInitializedRef.current = true;
  }, []);
}


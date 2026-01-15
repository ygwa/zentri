import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router/index";
import { VaultSelector } from "@/components/vault-selector";
import { useAppStore, initializeApp, setVaultPath } from "@/store";
import { isTauriEnv } from "@/services/api";
import { useWindowState } from "@/hooks/use-window-state";
import { useNativeFileDrop } from "@/hooks/use-native-features";
import { useTheme } from "@/hooks/use-theme";

import "./App.css";

function App() {
  const { isInitialized, isLoading, vaultPath, error } = useAppStore();
  
  // 系统主题自动同步（useTheme 已处理）
  useTheme();

  // 初始化窗口状态管理（保存和恢复窗口位置、大小）
  useWindowState();

  // 处理 Tauri 原生文件拖拽
  useNativeFileDrop(async (paths: string[]) => {
    if (!isTauriEnv()) return;
    
    // 过滤出 PDF 和 EPUB 文件
    const supportedExtensions = ['.pdf', '.epub'];
    const validPaths = paths.filter(path => {
      const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
      return supportedExtensions.includes(ext);
    });

    if (validPaths.length === 0) return;

    // 导入文件
    try {
      const { importBook } = await import("@/services/api/sources");
      for (const path of validPaths) {
        await importBook(path);
      }
      // 刷新资源列表
      const { loadSources } = useAppStore.getState();
      await loadSources();
    } catch (err) {
      console.error("Failed to import dropped files:", err);
    }
  });

  // // 禁用全局默认右键菜单（消除浏览器痕迹）
  // useEffect(() => {
  //   const handleContextMenu = (e: MouseEvent) => {
  //     // 允许在编辑器和特定区域使用右键菜单
  //     const target = e.target as HTMLElement;
  //     const isEditable = target.closest('[contenteditable="true"]') ||
  //                       target.closest('.ProseMirror') ||
  //                       target.closest('[data-editable="true"]') ||
  //                       target.closest('[data-allow-context-menu="true"]');
      
  //     if (!isEditable) {
  //       e.preventDefault();
  //     }
  //   };

  //   document.addEventListener('contextmenu', handleContextMenu);
  //   return () => {
  //     document.removeEventListener('contextmenu', handleContextMenu);
  //   };
  // }, []);

  // 初始化应用
  useEffect(() => {
    initializeApp();
  }, []);

  // 加载状态
  if (!isInitialized || isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/25 mb-6 animate-pulse">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-8 h-8 text-white"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-muted-foreground">正在启动 Zentri...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">出现错误</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 需要选择 Vault 路径（仅在 Tauri 环境中）
  if (isTauriEnv() && !vaultPath) {
    return <VaultSelector onSelect={setVaultPath} isLoading={isLoading} />;
  }

  // 主界面
  return (
    <div className="h-full w-full overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;

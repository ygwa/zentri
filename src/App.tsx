import { useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { VaultSelector } from "@/components/vault-selector";
import { useAppStore } from "@/store";
import { isTauriEnv } from "@/services/api";

import "./App.css";

function App() {
  const { isInitialized, isLoading, vaultPath, error, initialize, setVaultPath } =
    useAppStore();

  // 初始化应用
  useEffect(() => {
    initialize();
  }, [initialize]);

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
      <MainLayout />
    </div>
  );
}

export default App;

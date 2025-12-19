/**
 * 自定义窗口标题栏组件
 * 替换系统默认标题栏，实现标题居中显示
 */
import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { isTauriEnv } from "@/services/api/utils";

interface WindowTitleBarProps {
  title: string;
}

export function WindowTitleBar({ title }: WindowTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState<string>("");

  useEffect(() => {
    if (!isTauriEnv()) return;

    // 检测平台 - 使用 navigator.platform（在浏览器和 Tauri 环境中都可用）
    const detectPlatform = () => {
      const navPlatform = navigator.platform.toLowerCase();
      if (navPlatform.includes("mac")) {
        setPlatform("darwin");
      } else if (navPlatform.includes("win")) {
        setPlatform("windows");
      } else {
        setPlatform("linux");
      }
    };

    detectPlatform();

    const checkMaximized = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();
        const maximized = await currentWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.warn("Failed to check window state:", error);
      }
    };

    checkMaximized();

    // 监听窗口最大化状态变化
    const setupListeners = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();
        
        const unlisten = await currentWindow.onResized(async () => {
          const maximized = await currentWindow.isMaximized();
          setIsMaximized(maximized);
        });

        return unlisten;
      } catch (error) {
        console.warn("Failed to setup window listeners:", error);
      }
    };

    const cleanup = setupListeners();
    return () => {
      cleanup.then((unlisten) => {
        if (unlisten) unlisten();
      });
    };
  }, []);

  const handleMinimize = async () => {
    if (!isTauriEnv()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      await currentWindow.minimize();
    } catch (error) {
      console.warn("Failed to minimize window:", error);
    }
  };

  const handleMaximize = async () => {
    if (!isTauriEnv()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      await currentWindow.toggleMaximize();
    } catch (error) {
      console.warn("Failed to toggle maximize:", error);
    }
  };

  const handleClose = async () => {
    if (!isTauriEnv()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      await currentWindow.close();
    } catch (error) {
      console.warn("Failed to close window:", error);
    }
  };

  if (!isTauriEnv()) {
    return null;
  }

  const isMacOS = platform === "darwin";

  // macOS 风格的窗口控制按钮
  const MacOSControls = () => (
    <div className="flex items-center gap-2 px-3" data-tauri-drag-region>
      <button
        onClick={handleClose}
        className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center group"
        title="关闭"
      >
        <X size={8} className="text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={handleMinimize}
        className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors flex items-center justify-center group"
        title="最小化"
      >
        <Minus size={8} className="text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center group"
        title={isMaximized ? "还原" : "最大化"}
      >
        <Square size={6} className="text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );

  // Windows/Linux 风格的窗口控制按钮
  const WindowsControls = () => (
    <div className="flex items-center h-full">
      <button
        onClick={handleMinimize}
        className="w-12 h-full flex items-center justify-center hover:bg-zinc-100 transition-colors group"
        title="最小化"
      >
        <Minus size={14} className="text-zinc-600 group-hover:text-zinc-900" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-12 h-full flex items-center justify-center hover:bg-zinc-100 transition-colors group"
        title={isMaximized ? "还原" : "最大化"}
      >
        <Square size={12} className="text-zinc-600 group-hover:text-zinc-900" />
      </button>
      <button
        onClick={handleClose}
        className="w-12 h-full flex items-center justify-center hover:bg-red-500 transition-colors group"
        title="关闭"
      >
        <X size={14} className="text-zinc-600 group-hover:text-white" />
      </button>
    </div>
  );

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-white border-b border-zinc-200 flex items-center shrink-0 select-none relative z-50"
    >
      {/* macOS: 左侧窗口控制按钮 */}
      {isMacOS && <MacOSControls />}

      {/* 居中标题 */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-medium text-zinc-700 truncate max-w-[60%]">
          {title}
        </span>
      </div>

      {/* Windows/Linux: 右侧窗口控制按钮 */}
      {!isMacOS && <WindowsControls />}
    </div>
  );
}


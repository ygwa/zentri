/**
 * 自定义窗口标题栏组件
 * 替换系统默认标题栏，实现标题居中显示
 */
import { isTauriEnv } from "@/services/api/utils";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

interface WindowTitleBarProps {
  title: string;
  onSearchClick?: () => void;
}

export function WindowTitleBar({ title, onSearchClick }: WindowTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState<string>("");
  const [isToggling, setIsToggling] = useState(false);

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

        // 使用防抖来避免频繁更新状态
        let resizeTimeout: NodeJS.Timeout;
        const unlisten = await currentWindow.onResized(async () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(async () => {
            try {
              const maximized = await currentWindow.isMaximized();
              setIsMaximized(maximized);
            } catch (error) {
              console.warn("Failed to check maximized state:", error);
            }
          }, 100); // 100ms 防抖
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

  const handleDoubleClick = async (e: React.MouseEvent) => {
    if (!isTauriEnv() || isToggling) return;
    // 阻止事件冒泡，避免多次触发
    e.stopPropagation();
    e.preventDefault();

    // 设置标志防止快速连续触发
    setIsToggling(true);
    try {
      // 双击标题栏时切换最大化/还原状态
      await handleMaximize();
      // 短暂延迟后更新状态
      setTimeout(async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const currentWindow = getCurrentWindow();
          const maximized = await currentWindow.isMaximized();
          setIsMaximized(maximized);
        } catch (error) {
          console.warn("Failed to update maximized state:", error);
        } finally {
          setIsToggling(false);
        }
      }, 200);
    } catch (error) {
      setIsToggling(false);
      console.warn("Failed to handle double click:", error);
    }
  };

  if (!isTauriEnv()) {
    return null;
  }

  const isMacOS = platform === "darwin";

  // Windows/Linux 风格的窗口控制按钮
  const WindowsControls = () => (
    <div className="flex items-center h-full">
      <button
        onClick={handleMinimize}
        className="w-8 h-full flex items-center justify-center hover:bg-zinc-100 transition-colors group"
        title="最小化"
        data-tauri-drag-region={false}
      >
        <Minus size={12} className="text-zinc-600 group-hover:text-zinc-900" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-8 h-full flex items-center justify-center hover:bg-zinc-100 transition-colors group"
        title={isMaximized ? "还原" : "最大化"}
        data-tauri-drag-region={false}
      >
        <Square size={10} className="text-zinc-600 group-hover:text-zinc-900" />
      </button>
      <button
        onClick={handleClose}
        className="w-8 h-full flex items-center justify-center hover:bg-red-500 transition-colors group"
        title="关闭"
        data-tauri-drag-region={false}
      >
        <X size={12} className="text-zinc-600 group-hover:text-white" />
      </button>
    </div>
  );

  // macOS 风格的标题栏：使用原生交通灯按钮，显示标题
  // 注意：macOS 上使用 -webkit-app-region: drag 后，系统会自动处理双击缩放
  // 不需要 JS 事件处理，避免延迟
  if (isMacOS) {
    return (
      <div
        data-tauri-drag-region
        className="h-8 bg-white border-b border-zinc-200 flex items-center shrink-0 select-none relative z-50 safe-area-top"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(32px + env(safe-area-inset-top, 0px))',
        }}
      >
        {/* macOS: 左侧留出空间给原生交通灯按钮（约 80px，确保完全覆盖） */}
        <div className="w-[80px] h-full flex-shrink-0" data-tauri-drag-region />

        {/* 中间区域：标题居中 */}
        <div className="flex-1 flex items-center justify-center" data-tauri-drag-region>
          <span 
            className="text-xs font-medium text-zinc-700 truncate max-w-[60%] cursor-pointer hover:text-zinc-900 transition-colors"
            onClick={onSearchClick}
            title="点击打开命令面板 (Ctrl/Cmd+K)"
          >
            {title}
          </span>
        </div>

      </div>
    );
  }

  // Windows/Linux 风格的标题栏：自定义按钮 + 标题 + 工具栏
  // 使用与主背景一致的颜色
  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className="h-7 bg-white border-b border-zinc-200 flex items-center shrink-0 select-none relative z-50 safe-area-top"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(28px + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* 左侧可拖拽区域 */}
      <div className="flex-1 flex items-center justify-center" data-tauri-drag-region>
        <span 
          className="text-xs font-medium text-zinc-700 truncate max-w-[60%] cursor-pointer hover:text-zinc-900 transition-colors"
          onClick={onSearchClick}
          title="点击打开命令面板 (Ctrl/Cmd+K)"
        >
          {title}
        </span>
      </div>


      {/* Windows/Linux: 右侧窗口控制按钮 */}
      <WindowsControls />
    </div>
  );
}


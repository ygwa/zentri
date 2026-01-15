import { Outlet } from "react-router-dom";
import { useLayoutShared } from "@/hooks/use-layout-shared";
import { ReaderOverlay, GlobalCommandPalette } from "./layout-shared-components";

/**
 * 全屏布局
 * 适用于：Canvas, Graph
 * - 无侧边栏
 * - 无 header（或最小化 header）
 * - 全屏显示内容
 * - 保留必要的全局功能（Command Palette）
 */
export function FullscreenLayout() {
    const {
        readingSource,
        setReadingSource,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        handleOpenCard,
    } = useLayoutShared();
    return (
        <div className="flex flex-col h-screen w-screen bg-white text-zinc-900 font-sans overflow-hidden">
            
            {/* Fullscreen Viewport */}
            <div className="flex-1 overflow-hidden relative">
                <Outlet />
            </div>

            {/* Reader Overlay */}
            <ReaderOverlay
                sourceId={readingSource}
                onClose={() => setReadingSource(null)}
            />

            {/* Command Palette Overlay */}
            <GlobalCommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                onViewChange={() => {
                    // 导航功能由 CommandPalette 内部处理
                }}
                onOpenCard={handleOpenCard}
            />
        </div>
    );
}


import { Outlet } from "react-router-dom";
import { WindowTitleBar } from "@/components/window-title-bar";
import { useLayoutShared } from "@/hooks/use-layout-shared";
import { useAppStore } from "@/store";
import { ReaderOverlay, GlobalCommandPalette } from "./layout-shared-components";

/**
 * 专注布局
 * 适用于：Permanent Note, Project Note, Card Detail
 * - 无侧边栏（或可切换的侧边栏）
 * - 最小化 header（仅保留必要导航）
 * - 专注于编辑体验
 * - 保留全局功能（Command Palette）
 */
export function FocusLayout() {
    const {
        readingSource,
        setReadingSource,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        handleOpenCard,
    } = useLayoutShared();
    const { vaultPath } = useAppStore();

    // 从 vaultPath 提取 vault 名称作为标题
    const getVaultName = (): string => {
        if (!vaultPath) return "KNOWLEDGE_BASE";
        const parts = vaultPath.split(/[/\\]/).filter(Boolean);
        const vaultName = parts[parts.length - 1] || "KNOWLEDGE_BASE";
        return vaultName.toUpperCase().replace(/[\s-]/g, "_");
    };

    const vaultName = getVaultName();

    return (
        <div className="flex flex-col h-screen w-screen bg-white text-zinc-900 font-sans overflow-hidden">
            {/* 自定义窗口标题栏 */}
            <WindowTitleBar 
                title={vaultName}
                onSearchClick={() => setIsCommandPaletteOpen(true)}
            />
            
            {/* Focus Viewport - 无 header，由页面组件自己处理 */}
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


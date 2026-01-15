import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Layout,
    BookOpen,
    GitGraph,
    Settings,
    Command,
    Repeat,
    Hash,
    CalendarDays,
    Sparkles
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { WindowTitleBar } from "@/components/window-title-bar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { readerNavigation, type NavigationTarget } from "@/lib/reader-navigation";
import { useWindowTitle } from "@/hooks/use-window-title";
import { getCardRoute } from "@/lib/card-routes";
import { LEGACY_ROUTES } from "@/router/constants";

// Views (only for overlays)
import { ReaderView } from "@/components/views/reader-view";

export function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [readingSource, setReadingSource] = useState<string | null>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const { getSourceById, getCardById, selectedCardId, vaultPath } = useAppStore();

    // 从路径获取当前视图
    const currentView = location.pathname.split('/').pop() || 'dashboard';

    // 从路由中获取当前卡片信息
    const pathParts = location.pathname.split('/').filter(Boolean);
    const currentCardId = pathParts[0] === 'permanent' || pathParts[0] === 'project' || pathParts[0] === 'card'
        ? pathParts[1]
        : null;

    // 获取当前标题信息（优先级：打开的文献源 > 路由中的卡片 > 选中的卡片 > 当前视图）
    const currentSource = readingSource ? getSourceById(readingSource) : null;
    const currentCard = currentCardId ? getCardById(currentCardId) : null;
    const selectedCard = selectedCardId && !currentCardId ? getCardById(selectedCardId) : null;

    // 更新窗口标题（系统标题栏）
    useWindowTitle({
        currentView: currentView as any,
        selectedCardTitle: currentCard?.title || selectedCard?.title || null,
        openedSourceTitle: currentSource?.title || null,
    });

    // 处理引用跳转导航
    const handleReaderNavigation = useCallback((target: NavigationTarget) => {
        console.log('Navigation request:', target);

        // 打开阅读器并跳转到指定位置
        setReadingSource(target.sourceId);
    }, []);

    // 注册导航处理器
    useEffect(() => {
        const unsubscribe = readerNavigation.subscribe(handleReaderNavigation);
        return unsubscribe;
    }, [handleReaderNavigation]);

    // 键盘快捷键监听
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleOpenCard = (id: string) => {
        const card = getCardById(id);
        if (card) {
            // 根据卡片类型导航到对应的路由
            navigate(getCardRoute(card.type, id));
        } else {
            // 如果卡片不存在，使用默认路由
            navigate(LEGACY_ROUTES.CARD(id));
        }
    };

    // 移除查询参数监听，现在使用路由导航

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
            {/* 自定义窗口标题栏（Windows/Linux，macOS 上会自动隐藏） */}
            <WindowTitleBar 
                title={vaultName}
                onSearchClick={() => setIsCommandPaletteOpen(true)}
            />
            
            {/* Top Main Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Sidebar */}
                <aside className="w-14 h-full bg-zinc-50 flex flex-col items-center py-4 border-r border-zinc-200 shrink-0 z-50 text-gray-500">
                    <div className="w-8 h-8 bg-blue-700 rounded-sm flex items-center justify-center text-white font-bold mb-6 cursor-pointer hover:bg-blue-600 transition-colors font-mono tracking-tighter" onClick={() => navigate(LEGACY_ROUTES.DASHBOARD)}>
                        Z_
                    </div>
                    <div className="flex flex-col w-full items-center gap-4 p-2">
                        <NavIcon
                            icon={Layout}
                            active={currentView === "dashboard"}
                            onClick={() => navigate(LEGACY_ROUTES.DASHBOARD)}
                            tooltip="工作台 (Cmd+1)"
                        />
                        <NavIcon
                            icon={BookOpen}
                            active={currentView === "library"}
                            onClick={() => navigate(LEGACY_ROUTES.LIBRARY)}
                            tooltip="书架 (Cmd+2)"
                        />
                        <NavIcon
                            icon={GitGraph}
                            active={currentView === "graph"}
                            onClick={() => navigate(LEGACY_ROUTES.GRAPH)}
                            tooltip="图谱 (Cmd+3)"
                        />
                        <NavIcon
                            icon={CalendarDays}
                            active={currentView === "boards"}
                            onClick={() => navigate(LEGACY_ROUTES.BOARDS)}
                            tooltip="看板 (Cmd+4)"
                        />
                        <NavIcon
                            icon={Repeat}
                            active={currentView === "review"}
                            onClick={() => navigate(LEGACY_ROUTES.REVIEW)}
                            tooltip="回顾 (Cmd+4)"
                        />
                        <NavIcon
                            icon={Hash}
                            active={currentView === "tags"}
                            onClick={() => navigate(LEGACY_ROUTES.TAGS)}
                            tooltip="标签 (Cmd+5)"
                        />
                        <NavIcon
                            icon={Sparkles}
                            active={currentView === "ai-chat"}
                            onClick={() => navigate(LEGACY_ROUTES.AI_CHAT)}
                            tooltip="AI 聊天"
                        />
                    </div>
                    <div className="mt-auto flex flex-col space-y-4 w-full items-center pb-2">
                        <NavIcon
                            icon={Command}
                            onClick={() => setIsCommandPaletteOpen(true)}
                            tooltip="命令面板 (Cmd+K)"
                        />
                        <NavIcon
                            icon={Settings}
                            active={currentView === "settings"}
                            onClick={() => navigate(LEGACY_ROUTES.SETTINGS)}
                            tooltip="设置"
                        />
                        <div className="w-6 h-6 rounded-sm bg-zinc-800 border border-zinc-700 text-[9px] flex items-center justify-center text-zinc-400 font-mono">JS</div>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                    {/* Viewport */}
                    <div className="flex-1 overflow-hidden relative bg-[#f8f9fa]">
                        <Outlet />
                    </div>

                    {/* Reader Overlay */}
                    {readingSource && (() => {
                        const source = getSourceById(readingSource);
                        return source ? (
                            <ReaderView
                                source={source}
                                onClose={() => {
                                    setReadingSource(null);
                                }}
                            />
                        ) : null;
                    })()}

                    {/* Command Palette Overlay */}
                    <CommandPalette
                        isOpen={isCommandPaletteOpen}
                        onClose={() => setIsCommandPaletteOpen(false)}
                        onViewChange={(view) => {
                            const routeMap: Record<string, string> = {
                                dashboard: LEGACY_ROUTES.DASHBOARD,
                                library: LEGACY_ROUTES.LIBRARY,
                                graph: LEGACY_ROUTES.GRAPH,
                                review: LEGACY_ROUTES.REVIEW,
                                tags: LEGACY_ROUTES.TAGS,
                                settings: LEGACY_ROUTES.SETTINGS,
                                boards: LEGACY_ROUTES.BOARDS,
                                "ai-chat": LEGACY_ROUTES.AI_CHAT,
                            };
                            const route = routeMap[view] || `/${view}`;
                            navigate(route);
                        }}
                        onOpenCard={handleOpenCard}
                    />
                </div>
            </div>
        </div>
    );
}

function NavIcon({ icon: Icon, active, onClick, tooltip }: { icon: any, active?: boolean, onClick?: () => void, tooltip?: string }) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            className={cn(
                "p-2 rounded-sm transition-all relative group w-full flex items-center justify-center",
                active
                    ? 'bg-blue-600/20 text-blue-600'
                    : 'hover:text-zinc-900 hover:bg-zinc-100'
            )}
        >
            <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        </button>
    );
}

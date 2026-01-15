import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { readerNavigation, type NavigationTarget } from "@/lib/reader-navigation";
import { useWindowTitle } from "@/hooks/use-window-title";
import { getCardRoute } from "@/lib/card-routes";
import { useTheme } from "@/hooks/use-theme";

/**
 * 共享的布局逻辑 Hook
 * 提供全局功能：菜单处理、导航历史、Reader Overlay、Command Palette 等
 */
export function useLayoutShared() {
    const location = useLocation();
    const navigate = useNavigate();
    const [readingSource, setReadingSource] = useState<string | null>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const { 
        getSourceById, 
        getCardById, 
        selectedCardId, 
        vaultPath,
        createCard,
        selectCard,
        deleteCard,
        createCanvas,
        createSource
    } = useAppStore();
    
    // 用于存储导航历史
    const navigationHistoryRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);

    // 从路径获取当前视图
    const currentView = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';

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

    // 记录导航历史
    useEffect(() => {
        const currentPath = location.pathname;
        const history = navigationHistoryRef.current;
        const index = historyIndexRef.current;
        
        // 如果当前路径与历史记录的最后一项不同，则添加新记录
        if (history.length === 0 || history[history.length - 1] !== currentPath) {
            // 如果不在历史记录的末尾，删除后面的记录
            if (index < history.length - 1) {
                navigationHistoryRef.current = history.slice(0, index + 1);
            }
            navigationHistoryRef.current.push(currentPath);
            historyIndexRef.current = navigationHistoryRef.current.length - 1;
        }
    }, [location.pathname]);

    // 全局菜单处理函数
    const handleMenuAction = useCallback(async (action: string, params?: any) => {
        try {
            switch (action) {
                case 'createCard': {
                    const { type, title } = params || { type: 'permanent', title: 'Untitled Note' };
                    const card = await createCard(type, title);
                    if (card) {
                        selectCard(card.id);
                        navigate(getCardRoute(type, card.id));
                    }
                    break;
                }
                case 'createCanvas': {
                    const canvas = await createCanvas('New Canvas');
                    if (canvas) {
                        navigate(`/canvas/${canvas.id}`);
                    }
                    break;
                }
                case 'createSource': {
                    navigate('/library');
                    setTimeout(() => {
                        const event = new CustomEvent('openCreateSourceDialog');
                        window.dispatchEvent(event);
                    }, 100);
                    break;
                }
                case 'importBook': {
                    navigate('/library');
                    setTimeout(() => {
                        const event = new CustomEvent('openImportBookDialog');
                        window.dispatchEvent(event);
                    }, 100);
                    break;
                }
                case 'navigate': {
                    const { path } = params || {};
                    if (path) {
                        navigate(path);
                    }
                    break;
                }
                case 'toggleTheme': {
                    const currentTheme = theme || 'light';
                    if (currentTheme === 'light') {
                        setTheme('dark');
                    } else if (currentTheme === 'dark') {
                        setTheme('auto');
                    } else {
                        setTheme('light');
                    }
                    break;
                }
                case 'goBack': {
                    const history = navigationHistoryRef.current;
                    const index = historyIndexRef.current;
                    if (index > 0) {
                        historyIndexRef.current = index - 1;
                        navigate(history[index - 1]);
                    }
                    break;
                }
                case 'goForward': {
                    const history = navigationHistoryRef.current;
                    const index = historyIndexRef.current;
                    if (index < history.length - 1) {
                        historyIndexRef.current = index + 1;
                        navigate(history[index + 1]);
                    }
                    break;
                }
                case 'deleteCard': {
                    const pathParts = location.pathname.split('/').filter(Boolean);
                    const cardIdFromPath = (pathParts[0] === 'permanent' || pathParts[0] === 'project' || pathParts[0] === 'card')
                        ? pathParts[1]
                        : null;
                    const cardId = selectedCardId || cardIdFromPath;
                    if (cardId) {
                        if (confirm('确定要删除这张卡片吗？')) {
                            await deleteCard(cardId);
                            navigate('/dashboard');
                        }
                    }
                    break;
                }
                case 'duplicateCard': {
                    const pathParts = location.pathname.split('/').filter(Boolean);
                    const cardIdFromPath = (pathParts[0] === 'permanent' || pathParts[0] === 'project' || pathParts[0] === 'card')
                        ? pathParts[1]
                        : null;
                    const cardId = selectedCardId || cardIdFromPath;
                    if (cardId) {
                        const card = getCardById(cardId);
                        if (card) {
                            const newCard = await createCard(card.type, `${card.title} (Copy)`);
                            if (newCard) {
                                selectCard(newCard.id);
                                navigate(getCardRoute(newCard.type, newCard.id));
                            }
                        }
                    }
                    break;
                }
                case 'renameCard': {
                    const pathParts = location.pathname.split('/').filter(Boolean);
                    const cardIdFromPath = (pathParts[0] === 'permanent' || pathParts[0] === 'project' || pathParts[0] === 'card')
                        ? pathParts[1]
                        : null;
                    const cardId = selectedCardId || cardIdFromPath;
                    if (cardId) {
                        const event = new CustomEvent('openRenameCardDialog', { detail: { cardId } });
                        window.dispatchEvent(event);
                    }
                    break;
                }
                case 'find': {
                    const event = new CustomEvent('openFindDialog');
                    window.dispatchEvent(event);
                    break;
                }
                case 'findReplace': {
                    const event = new CustomEvent('openFindReplaceDialog');
                    window.dispatchEvent(event);
                    break;
                }
                case 'openHelp': {
                    const repoUrl = 'https://github.com/your-username/zentri';
                    window.open(`${repoUrl}#readme`, '_blank');
                    break;
                }
                case 'showShortcuts': {
                    setIsCommandPaletteOpen(true);
                    break;
                }
            }
        } catch (error) {
            console.error('Menu action error:', error);
        }
    }, [navigate, createCard, selectCard, deleteCard, createCanvas, createSource, selectedCardId, location.pathname, getCardById, theme, setTheme]);

    // 设置 Tauri 菜单事件监听
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            try {
                const { listen } = await import("@tauri-apps/api/event");
                unlisten = await listen<{ action: string; payload?: any }>("menu-action", (event) => {
                    const { action, payload } = event.payload;
                    
                    // Handle special reloadWindow action
                    if (action === "reloadWindow") {
                        window.location.reload();
                        return;
                    }
                    
                    handleMenuAction(action, payload);
                });
            } catch (e) {
                // Not in Tauri environment, set up window fallback for dev
                (window as any).handleMenuAction = handleMenuAction;
            }
        };

        setupListener();

        return () => {
            if (unlisten) {
                unlisten();
            } else {
                delete (window as any).handleMenuAction;
            }
        };
    }, [handleMenuAction]);

    const handleOpenCard = useCallback((id: string) => {
        const card = getCardById(id);
        if (card) {
            navigate(getCardRoute(card.type, id));
        } else {
            navigate(`/card/${id}`);
        }
    }, [getCardById, navigate]);

    return {
        readingSource,
        setReadingSource,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        currentView,
        currentSource,
        currentCard,
        selectedCard,
        vaultPath,
        handleOpenCard,
    };
}


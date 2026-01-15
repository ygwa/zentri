import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { X, ChevronLeft, Eye, Maximize2, GitGraph, ArrowRight, LayoutTemplate, Calendar, Activity, Quote, Search, History, Star, MoreVertical, Focus, Sparkles } from "lucide-react";
import { useAppStore } from "@/store";
import { ZentriEditor } from "@/components/editor";
import { TiptapToolbar } from "@/components/ui/tiptap-toolbar";
import { cn } from "@/lib/utils";
import { LocalGraph } from "@/components/views/local-graph";
import { getContentPreview } from "@/lib/content-preview";
import { ContentRenderer } from "@/components/content-renderer";
import { FleetingNoteModal } from "@/components/views/fleeting-note-modal";
import { AISidebar } from "@/components/views/ai-sidebar";
import { useBacklinks } from "@/hooks/use-backlinks";
import type { EditorContent, Card } from "@/types";
import type { JSONContent, Editor } from "@tiptap/core";

interface NoteEditorViewProps {
    cardId: string;
    onClose: () => void;
    onNavigate?: (cardId: string) => void;
    stackSize?: number;
    onBack?: () => void;
}

import { preprocessContent } from "@/lib/content-transformer";
import { useDebounce } from "@/hooks/use-debounce";

// 将EditorContent转换为JSONContent
function normalizeContent(content: EditorContent | string | undefined): JSONContent | null {
    if (!content) return null;
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            return preprocessContent(parsed) as JSONContent;
        } catch {
            // Fallback for raw string content (convert to paragraph with possible WikiLinks)
            // Ideally we'd parse the string too, but for now wrap it.
            return preprocessContent({
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
            }) as JSONContent;
        }
    }
    return preprocessContent(content as JSONContent) as JSONContent;
}

export function NoteEditorView({ cardId, onClose, onNavigate, stackSize = 1, onBack }: NoteEditorViewProps) {
    const { cards, getCardById, updateCard, getSourceById, loadCardContent, createCard } = useAppStore();
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [rightSidebarMode, setRightSidebarMode] = useState<'context' | 'ai'>('context');
    const [previewCard, setPreviewCard] = useState<Card | null>(null as Card | null);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const [fleetingNoteId, setFleetingNoteId] = useState<string | null>(null);
    const [focusMode, setFocusMode] = useState<boolean>(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');
    const [isStarred, setIsStarred] = useState(false);
    const [selectedText, setSelectedText] = useState<string>("");

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const card = getCardById(cardId);
    const source = card?.sourceId ? getSourceById(card.sourceId) : null;

    // 本地标题状态，用于立即更新 UI
    const [localTitle, setLocalTitle] = useState(card?.title || 'Untitled');
    const debouncedTitle = useDebounce(localTitle, 800);
    const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);
    const lastSavedTitleRef = useRef<string>(card?.title || '');

    // 内容已经在 store 中加载完成，无需再次加载
    // 如果卡片不存在，可能是还没有加载到 store 中，等待 loadCards 完成

    if (!card) return null;

    // 当 cardId 改变时，重置预览和 AI 状态，并同步标题
    useEffect(() => {
        setPreviewCard(null);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // 同步标题
        if (card) {
            setLocalTitle(card.title || 'Untitled');
            lastSavedTitleRef.current = card.title || '';
        }
    }, [cardId]);

    // 防抖保存标题
    useEffect(() => {
        if (!card) return;
        
        // 如果标题没有变化，或者正在通过同步外部变化来更新本地状态，则不保存
        if (debouncedTitle === lastSavedTitleRef.current) {
            return;
        }
        
        if (titleSaveTimeoutRef.current) {
            clearTimeout(titleSaveTimeoutRef.current);
        }
        
        isSavingRef.current = true;
        titleSaveTimeoutRef.current = setTimeout(() => {
            const titleToSave = debouncedTitle || 'Untitled';
            updateCard(card.id, { title: titleToSave }).then(() => {
                lastSavedTitleRef.current = titleToSave;
                isSavingRef.current = false;
            }).catch(() => {
                isSavingRef.current = false;
            });
        }, 300);
        
        return () => {
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
        };
    }, [debouncedTitle, card?.id, updateCard]);

    // 处理链接点击 - 预览或打开链接的卡片
    const handleLinkClick = useCallback(async (linkId: string) => {
        // 先尝试通过 ID 查找
        let linkedCard = getCardById(linkId);
        
        // 如果找不到，尝试通过标题查找
        if (!linkedCard) {
            linkedCard = cards.find(c => c.title === linkId);
        }
        
        if (linkedCard) {
            // 确保加载卡片内容
            await loadCardContent(linkedCard.id);
            // 重新获取卡片（内容已更新）
            const updatedCard = getCardById(linkedCard.id) || linkedCard;
            setPreviewCard(updatedCard);
        }
    }, [cards, getCardById, loadCardContent]);

    // 打开链接的卡片（全屏）
    const handleOpenLink = useCallback((e: React.MouseEvent, linkId: string) => {
        e.stopPropagation();
        if (onNavigate) {
            onNavigate(linkId);
        }
        setPreviewCard(null);
    }, [onNavigate]);

    // 使用 useBacklinks hook 获取带上下文的反向链接
    const { backlinks: backlinksWithContext, isLoading: isLoadingBacklinks } = useBacklinks(cardId);

    // 使用 useMemo 优化计算
    const { linkedCards, backlinks } = useMemo(() => {
        const linksOut = card.links?.length || 0;
        const backlinks = cards.filter(c => c.links?.includes(card.id));
        const linksIn = backlinks.length;

        const getStatus = (): 'healthy' | 'orphan' | 'hub' | 'stub' => {
            if (linksIn === 0 && linksOut === 0) return 'orphan';
            if (linksIn > 3 || linksOut > 3) return 'hub';
            if (linksIn === 0 && linksOut > 0) return 'stub';
            return 'healthy';
        };

        const linkedCards = (card.links || [])
            .map(id => cards.find(c => c.id === id))
            .filter(Boolean) as typeof cards;

        return { linksOut, linksIn, status: getStatus(), linkedCards, backlinks };
    }, [card.links, card.id, cards]);

    // 防抖保存内容
    const handleContentChange = useCallback((jsonContent: JSONContent) => {
        const contentStr = JSON.stringify(jsonContent);

        if (contentStr === lastSavedContentRef.current) {
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            updateCard(card.id, { content: jsonContent as any });
            lastSavedContentRef.current = contentStr;
        }, 500);
    }, [card.id, updateCard]);

    // 处理标题变更 - 立即更新本地状态，防抖保存
    const handleTitleChange = useCallback((newTitle: string) => {
        setLocalTitle(newTitle);
    }, []);

    // 处理链接变更
    const handleLinksChange = useCallback((links: string[]) => {
        updateCard(card.id, { links });
    }, [card.id, updateCard]);

    // 创建新卡片（创建为闪念笔记）
    const handleCreateCard = useCallback(async (title: string) => {
        try {
            const newCard = await createCard('fleeting', title);
            return { id: newCard.id, title: newCard.title };
        } catch (err) {
            console.error("Failed to create card:", err);
            return null;
        }
    }, [createCard]);

    // 处理闪念笔记创建后的回调
    const handleFleetingNoteCreated = useCallback((cardId: string) => {
        setFleetingNoteId(cardId);
    }, []);

    // 卡片列表用于自动补全
    const cardsForAutocomplete = useMemo(() => {
        return cards.filter(c => c.id !== card.id);
    }, [cards, card.id]);

    // 计算字符数
    const charCount = useMemo(() => {
        if (!card.content) return 0;
        // Strict EditorContent (JSON) handling
        const preview = getContentPreview(card.content);
        return preview.length;
    }, [card.content]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="absolute inset-0 bg-[#f0f0f2] z-30 flex flex-col animate-in slide-in-from-bottom-2 duration-150">
            {/* Global Toolbar - Three Zones Layout */}
            <div className="h-10 border-b border-zinc-200/80 grid grid-cols-3 items-center px-4 bg-white/95 backdrop-blur-sm shrink-0 z-20">
                {/* LEFT: Context - Navigation & Path */}
                <div className="flex items-center gap-2 min-w-0">
                    <button 
                        onClick={onClose} 
                        className="hover:bg-zinc-100 p-1.5 rounded-sm text-zinc-500 transition-colors shrink-0"
                        title="Close"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    {stackSize > 1 && onBack && (
                        <button 
                            onClick={onBack} 
                            className="hover:bg-zinc-100 p-1.5 rounded-sm text-zinc-500 transition-colors shrink-0"
                            title="Back"
                        >
                            <ChevronLeft size={14} />
                        </button>
                    )}
                    <div className="h-4 w-[1px] bg-zinc-300 shrink-0"></div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider shrink-0">
                            {card.type === 'fleeting' ? 'Inbox' : 
                             card.type === 'literature' ? 'Literature' : 
                             card.type === 'permanent' ? 'Slipbox' : 
                             card.type === 'project' ? 'Projects' : 'Notes'}
                        </span>
                        <span className="text-zinc-300 text-[10px]">/</span>
                        <span className="text-xs font-medium text-zinc-700 truncate">
                            {localTitle || 'Untitled'}
                        </span>
                    </div>
                </div>

                {/* CENTER: Evolution Path */}
                <div className="flex items-center justify-center gap-1.5 shrink-0">
                    <div className={cn(
                        "text-[9px] font-medium px-2 py-0.5 rounded transition-all",
                        card.type === 'fleeting' 
                            ? 'bg-amber-100 text-amber-700 font-bold' 
                            : 'text-zinc-400'
                    )}>
                        Captured
                    </div>
                    <ArrowRight size={10} className="text-zinc-300" />
                    <div className={cn(
                        "text-[9px] font-medium px-2 py-0.5 rounded transition-all",
                        card.type === 'literature' 
                            ? 'bg-blue-100 text-blue-700 font-bold' 
                            : 'text-zinc-400'
                    )}>
                        Refined
                    </div>
                    <ArrowRight size={10} className="text-zinc-300" />
                    <div className={cn(
                        "text-[9px] font-medium px-2 py-0.5 rounded transition-all",
                        card.type === 'permanent' 
                            ? 'bg-emerald-100 text-emerald-700 font-bold' 
                            : 'text-zinc-400'
                    )}>
                        ● Permanent
                    </div>
                </div>

                {/* RIGHT: Actions */}
                <div className="flex items-center justify-end gap-1 shrink-0">
                    <button
                        onClick={() => {
                            // TODO: 实现搜索功能
                            console.log("Search");
                        }}
                        className="p-1.5 rounded-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                        title="Search"
                    >
                        <Search size={14} />
                    </button>
                    <button
                        onClick={() => {
                            // TODO: 实现历史功能
                            console.log("History");
                        }}
                        className="p-1.5 rounded-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                        title="History"
                    >
                        <History size={14} />
                    </button>
                    <button
                        onClick={() => setIsStarred(!isStarred)}
                        className={cn(
                            "p-1.5 rounded-sm transition-colors",
                            isStarred 
                                ? 'text-amber-500 hover:text-amber-600' 
                                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                        )}
                        title="Star"
                    >
                        <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                        onClick={() => {
                            // TODO: 实现更多/导出功能
                            console.log("More");
                        }}
                        className="p-1.5 rounded-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                        title="More"
                    >
                        <MoreVertical size={14} />
                    </button>
                    <button
                        onClick={() => setFocusMode(!focusMode)}
                        className={cn(
                            "p-1.5 rounded-sm transition-colors ml-1",
                            focusMode ? 'bg-blue-50 text-blue-600' : 'text-zinc-400 hover:bg-zinc-100'
                        )}
                        title="专注模式 (隐藏网格和侧边栏)"
                    >
                        <Focus size={14} />
                    </button>
                    <button
                        onClick={() => setShowRightSidebar(!showRightSidebar)}
                        className={cn(
                            "p-1.5 rounded-sm transition-colors ml-1",
                            showRightSidebar ? 'bg-blue-50 text-blue-600' : 'text-zinc-400 hover:bg-zinc-100'
                        )}
                        title="Toggle Sidebar"
                    >
                        <LayoutTemplate size={14} />
                    </button>
                </div>
            </div>

            {/* Main Workspace: Desk + Card + Sidebar */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* CENTER: The Desk (Background) */}
                <div className="flex-1 bg-[#f0f0f2] flex flex-col items-center overflow-y-auto relative min-w-0" onClick={() => setPreviewCard(null)}>
                    {/* Engineering Grid Texture - 确保背景能够扩展到整个可滚动区域 */}
                    {!focusMode && (
                        <div className="absolute top-0 left-0 right-0 bottom-0 min-h-full pointer-events-none opacity-[0.10]" style={{ backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>
                    )}

                    {/* Floating Toolbar Container */}
                    <div className="sticky top-4 z-10 pointer-events-none flex justify-center w-full min-w-0">
                        <div className="pointer-events-auto">
                            <TiptapToolbar editor={editorInstance} />
                        </div>
                    </div>

                    {/* The "Physical" Card - A4 纸大小，居中显示 */}
                    <div className="w-full max-w-[700px] min-w-[400px] bg-white  mt-8 mb-20 shadow-2xl border border-zinc-300 transition-all flex flex-col relative rounded-sm" style={{ marginLeft: 'max(16px, calc((100% - 700px) / 2))', marginRight: 'max(16px, calc((100% - 700px) / 2))' }}>
                        {/* Card Decoration Top */}
                        <div className={`h-1 w-full ${card.type === 'permanent' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>

                        <div className="px-12 py-12 flex-1 flex flex-col">
                            {/* Title */}
                            <div className="mb-8">
                                <input
                                    value={localTitle}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="w-full text-4xl font-extrabold text-zinc-900 placeholder-zinc-300 border-none focus:ring-0 p-0 mb-4 bg-transparent leading-tight tracking-tight"
                                    placeholder="Untitled Note"
                                />

                                {/* Meta Row */}
                                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono tracking-wide">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} /> {new Date(card.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Activity size={10} /> {charCount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Lit Note Source Banner */}
                            {card.type === 'literature' && source && (
                                <div className="mb-8 p-3 bg-orange-50/50 border border-orange-100 rounded-sm flex items-start gap-3">
                                    <Quote size={14} className="text-orange-400 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <div className="text-xs font-serif text-zinc-800 italic">
                                            {source.title || "Unlinked Source"}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Body Text */}
                            <div className="prose prose-zinc overflow-y-auto max-w-none font-serif text-[17px] leading-8 text-zinc-800 mb-12">
                                <div className="min-h-[200px]">
                                    <ZentriEditor
                                        key={cardId}
                                        content={normalizeContent(card.content)}
                                        onChange={handleContentChange}
                                        onLinksChange={handleLinksChange}
                                        cards={cardsForAutocomplete}
                                        onCreateCard={handleCreateCard}
                                        onFleetingNoteCreated={handleFleetingNoteCreated}
                                        onLinkClick={handleLinkClick}
                                        onEditorReady={(editor) => {
                                            setEditorInstance(editor);
                                            // 编辑器加载后，更新所有 wiki link 节点的 href
                                            if (editor) {
                                                setTimeout(() => {
                                                    const doc = editor.state.doc;
                                                    const tr = editor.state.tr;
                                                    let updated = false;
                                                    
                                                    doc.descendants((node, pos) => {
                                                        if (node.type.name === 'wikiLink') {
                                                            const title = node.attrs.title;
                                                            const currentHref = node.attrs.href;
                                                            // 如果 href 是 title 而不是卡片 ID，尝试查找对应的卡片
                                                            if (currentHref === title || !currentHref) {
                                                                const card = cards.find(c => c.title === title || c.id === title);
                                                                if (card && card.id !== currentHref) {
                                                                    tr.setNodeMarkup(pos, undefined, {
                                                                        ...node.attrs,
                                                                        href: card.id,
                                                                        exists: true
                                                                    });
                                                                    updated = true;
                                                                }
                                                            }
                                                        }
                                                    });
                                                    
                                                    if (updated) {
                                                        tr.setMeta('addToHistory', false);
                                                        editor.view.dispatch(tr);
                                                    }
                                                }, 100);

                                                // 监听选择变化，更新选中的文本
                                                editor.on('selectionUpdate', () => {
                                                    const { selection } = editor.state;
                                                    const { from, to } = selection;
                                                    if (from !== to) {
                                                        const selectedText = editor.state.doc.textBetween(from, to, ' ');
                                                        setSelectedText(selectedText);
                                                    } else {
                                                        setSelectedText("");
                                                    }
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* --- FOOTER SECTION: References & Backlinks on the Card --- */}
                            <div className="mt-auto pt-8 border-t border-zinc-100">
                                <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    REFERENCES & BACKLINKS
                                </div>

                                <div className="space-y-1">
                                    {linkedCards.length > 0 ? (
                                        linkedCards.map((linked, idx) => (
                                            <div
                                                key={linked.id}
                                                className="flex gap-2 items-baseline hover:bg-blue-50/50 p-1.5 rounded-sm cursor-pointer group transition-colors"
                                                onClick={() => handleLinkClick(linked.id)}
                                            >
                                                <span className="text-blue-400 font-mono text-[10px] font-bold shrink-0">[{idx + 1}]</span>
                                                <span className="text-xs text-zinc-700 group-hover:text-blue-600 group-hover:underline decoration-blue-300 underline-offset-2">
                                                    {linked.title || 'Untitled'}
                                                </span>
                                            </div>
                                        ))
                                    ) : null}
                                    {backlinks.length > 0 && (
                                        backlinks.map((backlink, idx) => (
                                            <div
                                                key={backlink.id}
                                                className="flex gap-2 items-baseline hover:bg-blue-50/50 p-1.5 rounded-sm cursor-pointer group transition-colors"
                                                onClick={() => handleLinkClick(backlink.id)}
                                            >
                                                <span className="text-blue-400 font-mono text-[10px] font-bold shrink-0">[{linkedCards.length + idx + 1}]</span>
                                                <span className="text-xs text-zinc-700 group-hover:text-blue-600 group-hover:underline decoration-blue-300 underline-offset-2">
                                                    {backlink.title || 'Untitled'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                    {linkedCards.length === 0 && backlinks.length === 0 && (
                                        <div className="text-zinc-400 text-xs py-2">No references</div>
                                    )}
                                </div>

                                {card.tags.length > 0 && (
                                    <div className="mt-6 flex flex-wrap gap-1.5">
                                        {card.tags.map(t => (
                                            <span key={t} className="px-2 py-0.5 bg-zinc-50 text-zinc-600 border border-zinc-200 rounded text-[10px] hover:bg-zinc-100 cursor-pointer transition-colors">
                                                #{t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Sidebar (Network Context OR Feynman AI OR Preview) */}
                {showRightSidebar && !focusMode && (
                    <div className="w-80 bg-white border-l border-zinc-200 flex flex-col shrink-0 z-10 h-full shadow-lg">
                        {/* Sidebar Header */}
                        <div className="h-10 px-4 border-b border-zinc-200/80 flex items-center justify-between bg-white/95 backdrop-blur-sm shrink-0 z-10">
                            <div className="flex items-center gap-2">
                                {previewCard ? (
                                    <>
                                        <Eye size={12} className="text-blue-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Previewing</span>
                                    </>
                                ) : rightSidebarMode === 'ai' ? (
                                    <>
                                        <Sparkles size={12} className="text-blue-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">AI Assistant</span>
                                    </>
                                ) : (
                                    <>
                                        <GitGraph size={12} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Network Context</span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {previewCard ? (
                                    <button onClick={() => setPreviewCard(null)} className="text-zinc-400 hover:text-zinc-700">
                                        <X size={12} />
                                    </button>
                                ) : (
                                    <div className="flex bg-zinc-100 rounded-sm p-0.5 gap-0.5">
                                        <button
                                            onClick={() => setRightSidebarMode('context')}
                                            className={`p-1.5 rounded-sm transition-all ${rightSidebarMode === 'context' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                                            title="Network Context"
                                        >
                                            <GitGraph size={14} />
                                        </button>
                                        <button
                                            onClick={() => setRightSidebarMode('ai')}
                                            className={`p-1.5 rounded-sm transition-all ${rightSidebarMode === 'ai' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                                            title="AI Assistant"
                                        >
                                            <Sparkles size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {rightSidebarMode === 'ai' && !previewCard ? (
                                // --- AI MODE ---
                                <AISidebar
                                    cardId={cardId}
                                    cardTitle={localTitle}
                                    cardContent={getContentPreview(card.content)}
                                    selectedText={selectedText}
                                />
                            ) : previewCard ? (
                                // --- PREVIEW MODE ---
                                <div className="animate-in slide-in-from-right-4 duration-200 bg-white">
                                    <div className="p-4 bg-blue-50/20 border-b border-zinc-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <button
                                                onClick={(e) => handleOpenLink(e, previewCard.id)}
                                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded-sm hover:bg-blue-700 transition-colors"
                                            >
                                                <Maximize2 size={8} /> OPEN
                                            </button>
                                        </div>
                                        <h3 className="text-sm font-bold text-zinc-900 leading-tight">{previewCard.title || 'Untitled'}</h3>
                                    </div>
                                    <div className="p-4 overflow-y-auto">
                                        <ContentRenderer 
                                            content={previewCard.content} 
                                            onLinkClick={handleLinkClick}
                                        />
                                    </div>
                                </div>
                            ) : (
                                // --- CONTEXT MODE (Default) ---
                                <div>
                                    {/* 1. Interactive Local Graph */}
                                    <LocalGraph
                                        centerId={cardId}
                                        onNodeClick={handleLinkClick}
                                        className="h-48 w-full border-b border-zinc-100 bg-zinc-50/30"
                                    />

                                    <div className="p-4 space-y-6">
                                        {/* Backlinks with Context */}
                                        {(backlinksWithContext.length > 0 || isLoadingBacklinks) && (
                                            <div>
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase mb-2 flex items-center justify-between">
                                                    <span>Backlinks ({backlinksWithContext.length})</span>
                                                </div>
                                                {isLoadingBacklinks ? (
                                                    <div className="text-[10px] text-zinc-400 py-2">加载中...</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {backlinksWithContext.slice(0, 8).map(backlink => {
                                                            const isPreviewing = (previewCard as any)?.id === backlink.id;
                                                            return (
                                                                <div
                                                                    key={backlink.id}
                                                                    className={`p-2.5 bg-white border rounded-sm shadow-sm cursor-pointer transition-all group ${isPreviewing
                                                                        ? 'border-blue-400 bg-blue-50/30'
                                                                        : 'border-zinc-200 hover:border-blue-400'
                                                                        }`}
                                                                    onClick={() => handleLinkClick(backlink.id)}
                                                                >
                                                                    <div className="mb-1.5 flex items-center gap-1.5">
                                                                        <span className={`text-xs font-semibold group-hover:underline ${isPreviewing ? 'text-blue-700' : 'text-blue-600'
                                                                            }`}>{backlink.title || 'Untitled'}</span>
                                                                        <span className="text-[8px] px-1 py-0.5 rounded uppercase font-medium bg-zinc-100 text-zinc-600">
                                                                            {backlink.cardType}
                                                                        </span>
                                                                    </div>
                                                                    {backlink.context && (
                                                                        <div className="text-[10px] text-zinc-500 italic leading-relaxed line-clamp-2 mt-1">
                                                                            {backlink.context}
                                                                        </div>
                                                                    )}
                                                                    {!backlink.context && (
                                                                        <div className="text-[10px] text-zinc-400 truncate leading-relaxed mt-1">
                                                                            {getContentPreview(cards.find(c => c.id === backlink.id)?.content, 60)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Outgoing Links */}
                                        {linkedCards.length > 0 && (
                                            <div>
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Outgoing Links ({linkedCards.length})</div>
                                                <div className="space-y-1.5">
                                                    {linkedCards.slice(0, 8).map(linked => {
                                                        const isPreviewing = (previewCard as any)?.id === linked.id;
                                                        return (
                                                            <div
                                                                key={linked.id}
                                                                className={`flex items-center justify-between p-2 rounded-sm cursor-pointer border transition-all group ${isPreviewing
                                                                    ? 'bg-blue-50/30 border-blue-200'
                                                                    : 'hover:bg-zinc-50 border-transparent hover:border-zinc-200'
                                                                    }`}
                                                                onClick={() => handleLinkClick(linked.id)}
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                                        <span className={`text-xs font-medium truncate ${isPreviewing
                                                                            ? 'text-blue-700'
                                                                            : 'text-zinc-600 group-hover:text-blue-600'
                                                                            }`}>{linked.title || 'Untitled'}</span>
                                                                        <span className="text-[8px] px-1 py-0.5 rounded uppercase font-medium bg-zinc-100 text-zinc-600 shrink-0">
                                                                            {linked.type}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[10px] text-zinc-400 truncate">
                                                                        {getContentPreview(linked.content, 50)}
                                                                    </div>
                                                                </div>
                                                                <ArrowRight size={10} className={`${isPreviewing
                                                                    ? 'text-blue-500'
                                                                    : 'text-zinc-300 group-hover:text-blue-400'
                                                                    } -rotate-45 shrink-0 ml-2`} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Fleeting Note Modal */}
            {fleetingNoteId && (
                <FleetingNoteModal
                    cardId={fleetingNoteId}
                    onClose={() => setFleetingNoteId(null)}
                    onDelete={() => setFleetingNoteId(null)}
                    onConvertToPermanent={(id) => {
                        setFleetingNoteId(null);
                        if (onNavigate) {
                            onNavigate(id);
                        }
                    }}
                    onOpenPermanentNote={(id) => {
                        setFleetingNoteId(null);
                        if (onNavigate) {
                            onNavigate(id);
                        }
                    }}
                />
            )}
        </div>
    );
}


import { useState, useEffect, useMemo } from "react";
import {
    ChevronLeft, ChevronRight, Book, AlignLeft,
    ArrowRight, Download, FileText, Plus, Search, X
} from "lucide-react";
import { useAppStore } from "@/store";
import type { Source, Highlight, WebSnapshot } from "@/types";
import * as api from "@/services/api";
import { UnifiedReader, detectFileType, WebReader, type SupportedBookFormat } from "@/components/reader";
import { ZentriEditor } from "@/components/editor";
import { getContentPreview } from "@/lib/content-preview";
import { preprocessContent } from "@/lib/content-transformer";
import type { JSONContent } from "@tiptap/core";


interface ReaderViewProps {
    source: Source;
    onClose: () => void;
}

export function ReaderView({ source, onClose }: ReaderViewProps) {
    const { createHighlight, updateSource, createCard, cards, getCardById, updateCard, loadCardContent } = useAppStore();
    const [showNotes, setShowNotes] = useState(true);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [noteSearchQuery, setNoteSearchQuery] = useState('');
    const [showNoteSelector, setShowNoteSelector] = useState(false);

    // 过滤笔记列表
    const filteredNotes = useMemo(() => {
        return cards
            .filter(c => c.type === 'literature' || c.type === 'permanent')
            .filter(c => {
                if (!noteSearchQuery) return true;
                const q = noteSearchQuery.toLowerCase();
                return (c.title?.toLowerCase().includes(q) || 
                        getContentPreview(c.content, 100).toLowerCase().includes(q));
            })
            .slice(0, 5);
    }, [cards, noteSearchQuery]);
    const [fileUrl, setFileUrl] = useState<string>('');
    const [fileType, setFileType] = useState<SupportedBookFormat | null>(null);
    const [webSnapshot, setWebSnapshot] = useState<WebSnapshot | null>(null);
    const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
    const [currentPage, setCurrentPage] = useState<number>(() => {
        // 所有格式统一使用进度百分比（0-100）
        if (source.type === 'book' || source.type === 'paper') {
            return source.progress || 0;
        }
        return 0;
    });
    

    // 加载文件URL或网页快照
    useEffect(() => {
        const loadContent = async () => {
            if (source.type === 'webpage' || source.type === 'article') {
                // 网页类型：加载快照
                setIsLoadingSnapshot(true);
                try {
                    if (source.url) {
                        if (api.isTauriEnv()) {
                            // Tauri 环境：从数据库加载或抓取
                            let snapshot = await api.webReader.getSnapshot(source.id);

                            // 如果没有快照，尝试抓取并保存
                            if (!snapshot) {
                                try {
                                    const fetchResult = await api.webReader.fetchWebpage(source.url);
                                    snapshot = await api.webReader.saveSnapshot(
                                        source.id,
                                        source.url,
                                        fetchResult
                                    );
                                } catch (err) {
                                    console.error("Failed to fetch webpage:", err);
                                }
                            }

                            setWebSnapshot(snapshot);
                        } else {
                            // 浏览器环境：暂时显示提示
                            console.warn("Web snapshot is only available in Tauri environment");
                            setWebSnapshot(null);
                        }
                    }
                } catch (err) {
                    console.error("Failed to load web snapshot:", err);
                    setWebSnapshot(null);
                } finally {
                    setIsLoadingSnapshot(false);
                }
            } else {
                // 文件类型：直接使用原始 URL，让阅读器组件自己处理
                // 这样阅读器可以根据 URL 类型（相对路径 vs 绝对路径）选择不同的加载方式
                if (source.url) {
                    // 不在这里转换 URL，让 EpubReader 自己判断是相对路径还是绝对路径
                    setFileUrl(source.url);
                    const detected = detectFileType(source.url);
                    setFileType(detected);
                }
            }
        };
        loadContent();
    }, [source.url, source.type, source.id]);

    // 加载高亮
    useEffect(() => {
        const loadHighlights = async () => {
            try {
                if (api.isTauriEnv()) {
                    const data = await api.highlights.getBySource(source.id);
                    setHighlights(data);
                } else {
                    // 使用store中的highlights
                    const { highlights: allHighlights } = useAppStore.getState();
                    const sourceHighlights = allHighlights.filter(h => h.sourceId === source.id);
                    if (sourceHighlights.length > 0) {
                        setHighlights(sourceHighlights);
                    } else {
                        // Mock data for development
                        setHighlights([
                            {
                                id: 'h-1',
                                sourceId: source.id,
                                content: "Ownership is Rust's most unique feature",
                                note: "This is the core value prop.",
                                createdAt: Date.now(),
                            },
                            {
                                id: 'h-2',
                                sourceId: source.id,
                                content: "memory is managed through a system of ownership with a set of rules that the compiler checks",
                                note: "Compiler-driven memory management vs GC vs Manual.",
                                createdAt: Date.now(),
                            },
                        ]);
                    }
                }
            } catch (err) {
                console.error("Failed to load highlights:", err);
            }
        };
        loadHighlights();
    }, [source.id]);

    // 处理高亮
    const handleHighlight = async (
        text: string, 
        position: string | number, 
        type?: "highlight" | "underline" | "strikethrough",
        rects?: Array<{ x: number; y: number; width: number; height: number }>
    ) => {
        try {
            // 验证输入
            if (!text || !text.trim()) {
                throw new Error("高亮内容不能为空");
            }

            // 构建位置数据
            let positionData;
            if (typeof position === 'number') {
                // PDF 高亮：需要页码和矩形坐标
                if (rects && rects.length > 0) {
                    positionData = { page: position, rects };
                } else {
                    // 如果没有 rects，仍然保存但记录警告
                    console.warn('PDF highlight created without rects - restoration may fail');
                    positionData = { page: position };
                }
            } else if (typeof position === 'string') {
                if (position.startsWith('text:')) {
                    positionData = { selector: position };
                } else if (position.toLowerCase().startsWith('epubcfi')) {
                    positionData = { cfi: position };
                } else if (position.startsWith('temp-')) {
                    // 临时位置，不应该保存
                    throw new Error("位置标识无效，请重新选择文本");
                } else {
                    positionData = { cfi: position }; // 默认作为 CFI 处理
                }
            } else {
                throw new Error("无效的位置标识");
            }

            // 创建高亮
            const highlight = await createHighlight({
                sourceId: source.id,
                content: text.trim(),
                position: positionData,
                type: type || "highlight",
                color: 'rgba(255, 235, 59, 0.4)',
            });
            
            // 更新本地状态
            setHighlights(prev => [highlight, ...prev]);
            console.log("Highlight created successfully:", highlight.id);
        } catch (err) {
            console.error("Failed to create highlight:", err);
            const errorMessage = err instanceof Error ? err.message : "创建高亮失败";
            // 可以显示错误提示给用户
            alert(errorMessage);
            throw err; // 重新抛出错误，让调用者知道保存失败
        }
    };

    // 处理网页高亮
    const handleWebHighlight = async (text: string, selector: string) => {
        await handleHighlight(text, selector);
    };

    // 处理添加到笔记
    const handleAddToNote = async (text: string, position: string | number) => {
        try {
            const positionData = typeof position === 'number'
                ? { page: position }
                : typeof position === 'string' && position.startsWith('text:')
                    ? { selector: position }
                    : { chapter: String(position) };

            // 创建高亮
            const highlight = await createHighlight({
                sourceId: source.id,
                content: text,
                position: positionData,
                color: 'rgba(255, 235, 59, 0.4)',
            });
            setHighlights(prev => [highlight, ...prev]);

            // 创建fleeting卡片（书摘类型）
            const card = await createCard('fleeting', text);
            // 添加 highlight 标签
            if (card) {
                const { updateCard } = useAppStore.getState();
                await updateCard(card.id, { tags: ['highlight'] });
            }
        } catch (err) {
            console.error("Failed to add to note:", err);
        }
    };

    // 处理网页添加到笔记
    const handleWebAddToNote = async (text: string, selector: string) => {
        await handleAddToNote(text, selector);
    };

    // 刷新网页快照
    const handleRefreshSnapshot = async () => {
        if (!source.url) return;
        setIsLoadingSnapshot(true);
        try {
            if (api.isTauriEnv()) {
                const fetchResult = await api.webReader.fetchWebpage(source.url);
                const snapshot = await api.webReader.saveSnapshot(
                    source.id,
                    source.url,
                    fetchResult
                );
                setWebSnapshot(snapshot);
            }
        } catch (err) {
            console.error("Failed to refresh snapshot:", err);
        } finally {
            setIsLoadingSnapshot(false);
        }
    };

    // 处理进度更新
    const handleProgress = async (progress: number) => {
        try {
            await updateSource(source.id, {
                progress: Math.round(progress),
                lastReadAt: Date.now(),
            });
        } catch (err) {
            console.error("Failed to update progress:", err);
        }
    };

    // 处理进度和 CFI 更新
    const handleProgressCfi = async (progress: number, cfi: string) => {
        try {
            await updateSource(source.id, {
                progress: Math.round(progress),
                lastReadAt: Date.now(),
                metadata: {
                    lastCfi: cfi,
                },
            });
        } catch (err) {
            console.error("Failed to update progress with CFI:", err);
        }
    };

    // 处理页码变化
    const handlePageChange = (page: number, _total: number) => {
        setCurrentPage(page);
        
    };

    // 处理翻页（统一使用百分比）
    const handlePageNavigation = (direction: 'prev' | 'next') => {
        // 所有格式统一使用百分比，每次跳转 5%
        const step = 5;
        const newProgress = direction === 'prev'
            ? Math.max(0, currentPage - step)
            : Math.min(100, currentPage + step);
        setCurrentPage(newProgress);
    };

    // 处理高亮更新
    const handleHighlightUpdate = async (id: string, updates: { note?: string; color?: string }) => {
        try {
            if (api.isTauriEnv()) {
                await api.highlights.update(id, updates);
                // 更新本地状态
                setHighlights(prev => prev.map(h => 
                    h.id === id ? { ...h, ...updates } : h
                ));
            } else {
                // 浏览器环境：更新 store
                
                // 如果 store 有 updateHighlight 方法，使用它
                setHighlights(prev => prev.map(h => 
                    h.id === id ? { ...h, ...updates } : h
                ));
            }
        } catch (err) {
            console.error("Failed to update highlight:", err);
        }
    };

    // 处理高亮删除
    const handleHighlightDelete = async (id: string) => {
        try {
            if (api.isTauriEnv()) {
                await api.highlights.delete(id);
            } else {
                const { deleteHighlight } = useAppStore.getState();
                await deleteHighlight(id);
            }
            // 更新本地状态
            setHighlights(prev => prev.filter(h => h.id !== id));
        } catch (err) {
            console.error("Failed to delete highlight:", err);
        }
    };

    // 处理书签添加
    const handleBookmarkAdd = async (position: string | number) => {
        // 书签已通过 API 创建，这里可以显示提示
        console.log("Bookmark added at:", position);
    };

    // 提取高亮到Inbox
    const handleExtractToInbox = async (highlight: Highlight) => {
        try {
            const card = await createCard('fleeting', highlight.content);
            // 添加 highlight 标签
            if (card) {
                const { updateCard } = useAppStore.getState();
                await updateCard(card.id, { tags: ['highlight'] });
            }
        } catch (err) {
            console.error("Failed to extract to inbox:", err);
        }
    };

    // 导出高亮为Markdown
    const handleExportHighlights = () => {
        const markdown = highlights.map((h, i) => {
            let md = `## Highlight ${i + 1}\n\n`;
            md += `> ${h.content}\n\n`;
            if (h.note) {
                md += `**Note:** ${h.note}\n\n`;
            }
            return md;
        }).join('---\n\n');

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${source.title}-highlights.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 如果是网页类型，检查快照
    if (source.type === 'webpage' || source.type === 'article') {
        if (isLoadingSnapshot) {
            return (
                <div className="absolute inset-0 bg-white z-30 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4 bg-zinc-50 shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="hover:bg-zinc-200 rounded-sm p-1 text-zinc-500 transition-colors flex items-center gap-2"
                            >
                                <ChevronLeft size={16} />
                                <span className="text-xs font-medium">Back to Bookshelf</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-zinc-400">
                        <div className="text-center">
                            <Book size={48} className="mx-auto mb-4 opacity-30 animate-pulse" />
                            <p className="text-sm">正在加载网页内容...</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (!webSnapshot) {
            return (
                <div className="absolute inset-0 bg-white z-30 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4 bg-zinc-50 shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="hover:bg-zinc-200 rounded-sm p-1 text-zinc-500 transition-colors flex items-center gap-2"
                            >
                                <ChevronLeft size={16} />
                                <span className="text-xs font-medium">Back to Bookshelf</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-zinc-400">
                        <div className="text-center">
                            <Book size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-sm mb-2">无法加载网页内容</p>
                            {source.url && (
                                <p className="text-xs text-zinc-500 mb-4">{source.url}</p>
                            )}
                            {api.isTauriEnv() && source.url && (
                                <button
                                    onClick={handleRefreshSnapshot}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    重试
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    } else {
        // 文件类型：如果没有文件URL，显示占位内容
        if (!fileUrl || !fileType) {
            return (
                <div className="absolute inset-0 bg-white z-30 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4 bg-zinc-50 shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="hover:bg-zinc-200 rounded-sm p-1 text-zinc-500 transition-colors flex items-center gap-2"
                            >
                                <ChevronLeft size={16} />
                                <span className="text-xs font-medium">Back to Bookshelf</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-zinc-400">
                        <div className="text-center">
                            <Book size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-sm">No file available for this source</p>
                        </div>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="absolute inset-0 bg-white z-30 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Reader Toolbar */}
            <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4 bg-zinc-50 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="hover:bg-zinc-200 rounded-sm p-1 text-zinc-500 transition-colors flex items-center gap-2"
                    >
                        <ChevronLeft size={16} />
                        <span className="text-xs font-medium">Back to Bookshelf</span>
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-300"></div>
                    <div className="flex items-center gap-2">
                        <Book size={14} className="text-blue-600" />
                        <span className="text-xs font-bold text-zinc-800">{source.title}</span>
                        <span className="text-[10px] text-zinc-500 bg-zinc-200 px-1.5 rounded-sm font-mono">
                            {source.type.toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* 进度条 */}
                    {(source.type === 'book' || source.type === 'paper') && (
                        <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${source.progress || 0}%` }}
                                ></div>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 w-10 text-right shrink-0">
                                {source.progress || 0}%
                            </span>
                        </div>
                    )}
                    {/* 进度导航（所有格式统一使用百分比） */}
                    {(source.type === 'book' || source.type === 'paper') && fileType && (
                        <div className="flex items-center bg-white border border-zinc-200 rounded-sm p-1 gap-2">
                            <button
                                onClick={() => handlePageNavigation('prev')}
                                disabled={currentPage <= 0}
                                className="p-1 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs font-mono text-zinc-600 w-16 text-center">
                                {currentPage}%
                            </span>
                            <button
                                onClick={() => handlePageNavigation('next')}
                                disabled={currentPage >= 100}
                                className="p-1 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowNotes(!showNotes)}
                        className={`p-1.5 rounded-sm text-zinc-600 border transition-colors ${showNotes
                            ? 'bg-blue-50 border-blue-200 text-blue-600'
                            : 'border-transparent hover:bg-zinc-200'
                            }`}
                        title="Toggle Literature Notes"
                    >
                        <AlignLeft size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Reader Content */}
                <div className="flex-1 overflow-hidden bg-white relative">
                    {source.type === 'webpage' || source.type === 'article' ? (
                        webSnapshot && (
                            <WebReader
                                snapshot={webSnapshot}
                                sourceId={source.id}
                                sourceTitle={source.title}
                                highlights={highlights}
                                onHighlight={handleWebHighlight}
                                onAddToNote={handleWebAddToNote}
                                onRefresh={handleRefreshSnapshot}
                                className="h-full"
                            />
                        )
                    ) : (
                        fileUrl && fileType && (
                            <UnifiedReader
                                url={fileUrl}
                                fileType={fileType}
                                sourceId={source.id}
                                sourceTitle={source.title}
                                highlights={highlights}
                                onHighlight={handleHighlight}
                                onAddToNote={handleAddToNote}
                                onProgress={handleProgress}
                                onProgressCfi={handleProgressCfi}
                                onPageChange={handlePageChange}
                                currentPage={currentPage}
                                currentCfi={source.metadata?.lastCfi}
                                onHighlightUpdate={handleHighlightUpdate}
                                onHighlightDelete={handleHighlightDelete}
                                onBookmarkAdd={handleBookmarkAdd}
                                className="h-full"
                            />
                        )
                    )}
                </div>

                {/* Literature Notes Sidebar */}
                {showNotes && (
                    <div className="w-80 border-l border-zinc-200 bg-zinc-50 flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
                        <div className="h-10 border-b border-zinc-200 flex items-center justify-between px-3 bg-zinc-100/50">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                Literature Notes
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowNoteSelector(!showNoteSelector)}
                                    className="p-1 hover:bg-zinc-200 rounded-sm text-zinc-500 transition-colors"
                                    title={showNoteSelector ? "隐藏笔记选择器" : "选择已有笔记"}
                                >
                                    <FileText size={12} />
                                </button>
                                <span className="text-[10px] font-mono text-zinc-400">
                                    {highlights.length} Items
                                </span>
                            </div>
                        </div>

                        {/* Note Selector */}
                        {showNoteSelector && (
                            <div className="border-b border-zinc-200 bg-white p-2">
                                <div className="flex items-center gap-1 mb-2">
                                    <Search size={12} className="text-zinc-400" />
                                    <input
                                        type="text"
                                        value={noteSearchQuery}
                                        onChange={(e) => setNoteSearchQuery(e.target.value)}
                                        placeholder="搜索笔记..."
                                        className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-sm px-2 py-1 focus:outline-none focus:border-blue-400"
                                    />
                                    {selectedNoteId && (
                                        <button
                                            onClick={() => {
                                                setSelectedNoteId(null);
                                                setShowNoteSelector(false);
                                            }}
                                            className="p-1 hover:bg-zinc-200 rounded-sm text-zinc-400"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {filteredNotes.map(card => (
                                    <button
                                        key={card.id}
                                        onClick={async () => {
                                            await loadCardContent(card.id);
                                            setSelectedNoteId(card.id);
                                            setShowNoteSelector(false);
                                        }}
                                        className={`w-full text-left p-2 rounded-sm text-xs hover:bg-zinc-50 transition-colors ${
                                            selectedNoteId === card.id ? 'bg-blue-50 border border-blue-200' : ''
                                        }`}
                                    >
                                        <div className="font-medium text-zinc-800 truncate">{card.title || 'Untitled'}</div>
                                        <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                            {getContentPreview(card.content, 50)}
                                        </div>
                                    </button>
                                ))}
                                <button
                                    onClick={async () => {
                                        const newCard = await createCard('literature', '', source.id);
                                        if (newCard) {
                                            await loadCardContent(newCard.id);
                                            setSelectedNoteId(newCard.id);
                                            setShowNoteSelector(false);
                                        }
                                    }}
                                    className="w-full mt-2 p-2 border border-dashed border-zinc-300 rounded-sm text-xs text-zinc-600 hover:bg-zinc-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Plus size={12} />
                                    新建笔记
                                </button>
                            </div>
                        )}

                        {/* Note Editor */}
                        {selectedNoteId && (() => {
                            const note = getCardById(selectedNoteId);
                            if (!note) return null;
                            
                            const normalizeContent = (content: any): JSONContent | null => {
                                if (!content) return null;
                                if (typeof content === 'string') {
                                    try {
                                        return preprocessContent(JSON.parse(content)) as JSONContent;
                                    } catch {
                                        return null;
                                    }
                                }
                                return preprocessContent(content as JSONContent) as JSONContent;
                            };

                            return (
                                <div className="flex-1 flex flex-col border-b border-zinc-200 bg-white">
                                    <div className="h-10 border-b border-zinc-200 flex items-center justify-between px-3 bg-zinc-50 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <FileText size={12} className="text-blue-600" />
                                            <span className="text-xs font-medium text-zinc-800 truncate">
                                                {note.title || 'Untitled'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setSelectedNoteId(null)}
                                            className="p-1 hover:bg-zinc-200 rounded-sm text-zinc-400"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3">
                                        <input
                                            value={note.title || ''}
                                            onChange={(e) => updateCard(note.id, { title: e.target.value })}
                                            className="w-full text-sm font-semibold text-zinc-900 mb-3 border-none outline-none bg-transparent"
                                            placeholder="Untitled"
                                        />
                                        <ZentriEditor
                                            key={selectedNoteId}
                                            content={normalizeContent(note.content)}
                                            onChange={(content) => updateCard(note.id, { content: content as any })}
                                            cards={cards.filter(c => c.id !== selectedNoteId)}
                                            placeholder="记录你的想法..."
                                            className="text-sm leading-relaxed"
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {highlights.length > 0 ? highlights.map(highlight => (
                                <div
                                    key={highlight.id}
                                    className="bg-white border border-zinc-200 rounded-sm p-3 shadow-sm hover:border-blue-300 transition-colors group"
                                >
                                    <div className="flex gap-2 mb-2">
                                        <div className="w-1 bg-yellow-400 rounded-full shrink-0"></div>
                                        <p className="text-xs text-zinc-600 italic font-serif leading-relaxed">
                                            "{highlight.content}"
                                        </p>
                                    </div>

                                    {highlight.note && (
                                        <div className="mt-2 pl-3 border-l border-zinc-100">
                                            <div className="text-[11px] text-zinc-800 font-medium mb-1">Note:</div>
                                            <p className="text-[11px] text-zinc-500">{highlight.note}</p>
                                        </div>
                                    )}

                                    <div className="mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleExtractToInbox(highlight)}
                                            className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-sm border border-blue-100 transition-colors"
                                        >
                                            <ArrowRight size={10} /> Extract to Inbox
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-zinc-400 text-xs">
                                    No highlights yet. Select text to create one.
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-zinc-200">
                            <button
                                onClick={handleExportHighlights}
                                disabled={highlights.length === 0}
                                className="w-full py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={12} />
                                Export Highlights (Markdown)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


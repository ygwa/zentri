import { useState, useEffect } from "react";
import {
    ChevronLeft, ChevronRight, Book, AlignLeft,
    ArrowRight, Download
} from "lucide-react";
import { useAppStore } from "@/store";
import type { Source, Highlight } from "@/types";
import * as api from "@/services/api";
import { UnifiedReader, detectFileType } from "@/components/reader";
import { getFileUrl } from "@/lib/file-url";

interface ReaderViewProps {
    source: Source;
    onClose: () => void;
}

export function ReaderView({ source, onClose }: ReaderViewProps) {
    const { createHighlight, updateSource, createCard } = useAppStore();
    const [showNotes, setShowNotes] = useState(true);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [fileUrl, setFileUrl] = useState<string>('');
    const [fileType, setFileType] = useState<'epub' | 'pdf' | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages] = useState(320);

    // 加载文件URL
    useEffect(() => {
        const loadFileUrl = async () => {
            if (source.url) {
                const url = await getFileUrl(source.url);
                setFileUrl(url);
                const detected = detectFileType(source.url);
                setFileType(detected);
            }
        };
        loadFileUrl();
    }, [source.url]);

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
                }
            } catch (err) {
                console.error("Failed to load highlights:", err);
            }
        };
        loadHighlights();
    }, [source.id]);

    // 处理高亮
    const handleHighlight = async (text: string, position: string | number) => {
        try {
            const highlight = await createHighlight({
                sourceId: source.id,
                content: text,
                position: typeof position === 'number'
                    ? { page: position }
                    : { chapter: String(position) },
            });
            setHighlights(prev => [highlight, ...prev]);
        } catch (err) {
            console.error("Failed to create highlight:", err);
        }
    };

    // 处理添加到笔记
    const handleAddToNote = async (text: string, position: string | number) => {
        try {
            // 创建高亮
            const highlight = await createHighlight({
                sourceId: source.id,
                content: text,
                position: typeof position === 'number'
                    ? { page: position }
                    : { chapter: String(position) },
            });
            setHighlights(prev => [highlight, ...prev]);

            // 创建fleeting卡片
            await createCard('fleeting', text);
        } catch (err) {
            console.error("Failed to add to note:", err);
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

    // 提取高亮到Inbox
    const handleExtractToInbox = async (highlight: Highlight) => {
        try {
            await createCard('fleeting', highlight.content);
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

    // 如果没有文件URL，显示占位内容
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
                    <div className="flex items-center bg-white border border-zinc-200 rounded-sm p-1 gap-2">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            className="p-1 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-mono text-zinc-600 w-16 text-center">
                            Pg {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            className="p-1 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
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
                    <UnifiedReader
                        url={fileUrl}
                        fileType={fileType}
                        sourceId={source.id}
                        sourceTitle={source.title}
                        highlights={highlights}
                        onHighlight={handleHighlight}
                        onAddToNote={handleAddToNote}
                        onProgress={handleProgress}
                        className="h-full"
                    />
                </div>

                {/* Literature Notes Sidebar */}
                {showNotes && (
                    <div className="w-80 border-l border-zinc-200 bg-zinc-50 flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
                        <div className="h-10 border-b border-zinc-200 flex items-center justify-between px-3 bg-zinc-100/50">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                Literature Notes
                            </h3>
                            <span className="text-[10px] font-mono text-zinc-400">
                                {highlights.length} Items
                            </span>
                        </div>

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


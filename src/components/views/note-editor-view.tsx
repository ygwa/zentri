import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { X, Save, ChevronLeft, Eye, Maximize2, GitGraph, ArrowRight, LayoutTemplate, Calendar, Activity, Quote, Plus } from "lucide-react";
import { useAppStore } from "@/store";
import { ZentriEditor } from "@/components/editor";
import { Badge } from "@/components/ui/badge-new";
import { TiptapToolbar } from "@/components/ui/tiptap-toolbar";
import { cn } from "@/lib/utils";
import { getContentPreview } from "@/lib/content-preview";
import type { EditorContent, Card } from "@/types";
import type { JSONContent, Editor } from "@tiptap/core";

interface NoteEditorViewProps {
    cardId: string;
    onClose: () => void;
    onNavigate?: (cardId: string) => void;
    stackSize?: number;
    onBack?: () => void;
}

// 将EditorContent转换为JSONContent
function normalizeContent(content: EditorContent | string | undefined): JSONContent | null {
    if (!content) return null;
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            return parsed as JSONContent;
        } catch {
            return {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
            };
        }
    }
    return content as JSONContent;
}

export function NoteEditorView({ cardId, onClose, onNavigate, stackSize = 1, onBack }: NoteEditorViewProps) {
    const { cards, getCardById, updateCard, getSourceById } = useAppStore();
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [rightSidebarMode, setRightSidebarMode] = useState<'context' | 'feynman'>('context');
    const [previewCard, setPreviewCard] = useState<Card | null>(null as Card | null);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');

    // Feynman AI states

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const card = getCardById(cardId);
    const source = card?.sourceId ? getSourceById(card.sourceId) : null;

    if (!card) return null;

    // 当 cardId 改变时，重置预览和 AI 状态
    useEffect(() => {
        setPreviewCard(null);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
    }, [cardId]);

    // 处理链接点击 - 预览或打开链接的卡片
    const handleLinkClick = useCallback((linkId: string) => {
        const linkedCard = getCardById(linkId) || cards.find(c => c.title === linkId);
        if (linkedCard) {
            setPreviewCard(linkedCard);
        }
    }, [cards, getCardById]);

    // 打开链接的卡片（全屏）
    const handleOpenLink = useCallback((e: React.MouseEvent, linkId: string) => {
        e.stopPropagation();
        if (onNavigate) {
            onNavigate(linkId);
        }
        setPreviewCard(null);
    }, [onNavigate]);

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

    // 处理标题变更
    const handleTitleChange = useCallback((newTitle: string) => {
        if (newTitle !== card.title) {
            updateCard(card.id, { title: newTitle });
        }
    }, [card.id, card.title, updateCard]);

    // 处理链接变更
    const handleLinksChange = useCallback((links: string[]) => {
        updateCard(card.id, { links });
    }, [card.id, updateCard]);

    // 创建新卡片
    const handleCreateCard = useCallback((title: string) => {
        // TODO: 实现创建新卡片的功能
        console.log("Create card:", title);
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
        };
    }, []);

    return (
        <div className="absolute inset-0 bg-[#f0f0f2] z-30 flex flex-col animate-in slide-in-from-bottom-2 duration-150">
            {/* Global Toolbar */}
            <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4 bg-white shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="hover:bg-zinc-100 p-1.5 rounded-sm text-zinc-500 flex items-center gap-1 transition-colors">
                        <ChevronLeft size={16} /> <span className="text-xs font-bold uppercase">Back</span>
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-300"></div>
                    {stackSize > 1 && onBack && (
                        <button onClick={onBack} className="hover:bg-zinc-100 p-1.5 rounded-sm text-zinc-500 flex items-center gap-1 transition-colors text-xs font-bold uppercase">
                            <ChevronLeft size={14} /> Back
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-sm border border-zinc-200">{card.id}</span>
                        {card.type === 'permanent' ? (
                            <Badge color="blue">PERMANENT</Badge>
                        ) : card.type === 'literature' ? (
                            <Badge color="blue">LITERATURE</Badge>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowRightSidebar(!showRightSidebar)}
                        className={cn(
                            "p-2 rounded-sm transition-colors",
                            showRightSidebar ? 'bg-blue-50 text-blue-600' : 'text-zinc-400 hover:bg-zinc-100'
                        )}
                        title="Toggle Sidebar"
                    >
                        <LayoutTemplate size={16} />
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium transition-transform active:scale-95">
                        <Save size={12} /> <span className="font-mono text-[9px] uppercase">Save</span>
                    </button>
                </div>
            </div>

            {/* Main Workspace: Desk + Card + Sidebar */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* CENTER: The Desk (Background) */}
                <div className="flex-1 bg-[#f0f0f2] flex flex-col items-center overflow-y-auto relative" onClick={() => setPreviewCard(null)}>
                    {/* Engineering Grid Texture */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>

                    {/* Floating Toolbar Container */}
                    <div className="sticky top-4 z-10 pointer-events-none flex justify-center w-full">
                        <div className="pointer-events-auto">
                            <TiptapToolbar editor={editorInstance} />
                        </div>
                    </div>

                    {/* The "Physical" Card */}
                    <div className="w-full max-w-[700px] bg-white min-h-[600px] mt-8 mb-20 shadow-2xl border border-zinc-300 transition-all flex flex-col relative rounded-sm">
                        {/* Card Decoration Top */}
                        <div className={`h-1 w-full ${card.type === 'permanent' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>

                        <div className="px-12 py-12 flex-1 flex flex-col">
                            {/* Title */}
                            <div className="mb-8">
                                <input
                                    value={card.title || 'Untitled'}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="w-full text-4xl font-extrabold text-zinc-900 placeholder-zinc-300 border-none focus:ring-0 p-0 mb-4 bg-transparent leading-tight tracking-tight"
                                    placeholder="Untitled Note"
                                />

                                {/* Meta Row */}
                                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono tracking-wide">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} /> {new Date(card.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Activity size={10} /> {charCount} chars
                                    </span>
                                </div>
                            </div>

                            {/* Lit Note Source Banner */}
                            {card.type === 'literature' && source && (
                                <div className="mb-8 p-3 bg-orange-50/50 border border-orange-100 rounded-sm flex items-start gap-3">
                                    <Quote size={14} className="text-orange-400 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <div className="text-[9px] font-bold text-orange-800/60 uppercase tracking-wide mb-0.5">Source Reference</div>
                                        <div className="text-xs font-serif text-zinc-800 italic">
                                            {source.title || "Unlinked Source"}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Body Text */}
                            <div className="prose prose-zinc max-w-none font-serif text-[17px] leading-8 text-zinc-800 mb-12">
                                <div className="min-h-[200px]">
                                    <ZentriEditor
                                        key={cardId}
                                        content={normalizeContent(card.content)}
                                        onChange={handleContentChange}
                                        onLinksChange={handleLinksChange}
                                        cards={cardsForAutocomplete}
                                        onCreateCard={async (title) => {
                                            handleCreateCard(title);
                                            return null;
                                        }}
                                        onLinkClick={handleLinkClick}
                                        onEditorReady={(editor) => {
                                            setEditorInstance(editor);
                                        }}
                                    />
                                </div>
                            </div>

                            {/* --- FOOTER SECTION: References & Backlinks on the Card --- */}
                            <div className="mt-auto pt-8 border-t border-zinc-100">
                                <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    REFERENCES & BACKLINKS
                                </div>

                                <div className="space-y-1 font-mono text-xs text-zinc-500">
                                    {linkedCards.length > 0 ? (
                                        linkedCards.map((linked, idx) => (
                                            <div
                                                key={linked.id}
                                                className="flex gap-2 items-baseline hover:bg-blue-50/50 p-1 rounded-sm cursor-pointer group transition-colors"
                                                onClick={() => handleLinkClick(linked.id)}
                                            >
                                                <span className="text-blue-400 font-bold">[{idx + 1}]</span>
                                                <span className="group-hover:text-blue-600 group-hover:underline decoration-blue-300 underline-offset-2">
                                                    [[{linked.id}]] {linked.title || 'Untitled'}
                                                </span>
                                            </div>
                                        ))
                                    ) : null}
                                    {backlinks.length > 0 && (
                                        backlinks.map((backlink, idx) => (
                                            <div
                                                key={backlink.id}
                                                className="flex gap-2 items-baseline hover:bg-blue-50/50 p-1 rounded-sm cursor-pointer group transition-colors"
                                                onClick={() => handleLinkClick(backlink.id)}
                                            >
                                                <span className="text-blue-400 font-bold">[{linkedCards.length + idx + 1}]</span>
                                                <span className="group-hover:text-blue-600 group-hover:underline decoration-blue-300 underline-offset-2">
                                                    [[{backlink.id}]] {backlink.title || 'Untitled'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                    {linkedCards.length === 0 && backlinks.length === 0 && (
                                        <div className="text-zinc-400 text-xs">No links</div>
                                    )}
                                </div>

                                <div className="mt-6 flex flex-wrap gap-2">
                                    {card.tags.map(t => (
                                        <span key={t} className="px-2 py-1 bg-zinc-50 text-zinc-500 border border-zinc-200 rounded-sm text-[10px] hover:bg-zinc-100 cursor-pointer">
                                            #{t}
                                        </span>
                                    ))}
                                    <button className="px-2 py-1 text-zinc-400 hover:text-zinc-600 text-[10px] border border-dashed border-zinc-300 rounded-sm flex items-center gap-1 hover:border-zinc-400 transition-colors">
                                        <Plus size={8} /> Add Tag
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Sidebar (Network Context OR Feynman AI OR Preview) */}
                {showRightSidebar && (
                    <div className="w-80 bg-white border-l border-zinc-200 flex flex-col shrink-0 z-10 h-full shadow-lg">
                        {/* Sidebar Header */}
                        <div className="h-12 px-4 border-b border-zinc-200 flex items-center justify-between bg-white shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-2">
                                {previewCard ? (
                                    <>
                                        <Eye size={12} className="text-blue-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Previewing</span>
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
                                    <div className="flex bg-zinc-100 rounded-sm p-0.5">
                                        <button
                                            onClick={() => setRightSidebarMode('context')}
                                            className={`p-1.5 rounded-sm transition-all ${rightSidebarMode === 'context' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                                            title="Network Context"
                                        >
                                            <GitGraph size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {previewCard ? (
                                // --- PREVIEW MODE ---
                                <div className="animate-in slide-in-from-right-4 duration-200 bg-white">
                                    <div className="p-4 bg-blue-50/20 border-b border-zinc-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[9px] font-mono text-zinc-400 bg-white border border-zinc-200 px-1 rounded-sm">{previewCard.id.slice(0, 12)}</span>
                                            <button
                                                onClick={(e) => handleOpenLink(e, previewCard.id)}
                                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded-sm hover:bg-blue-700 transition-colors"
                                            >
                                                <Maximize2 size={8} /> OPEN
                                            </button>
                                        </div>
                                        <h3 className="text-sm font-bold text-zinc-900 leading-tight mb-2">{previewCard.title || 'Untitled'}</h3>
                                    </div>
                                    <div className="p-4 prose prose-sm prose-zinc font-serif text-zinc-600 overflow-y-auto">
                                        {getContentPreview(previewCard.content)}
                                    </div>
                                </div>
                            ) : (
                                // --- CONTEXT MODE (Default) ---
                                <div>
                                    {/* 1. Interactive Local Graph */}
                                    <div className="h-48 bg-zinc-50/30 border-b border-zinc-100 relative overflow-hidden flex items-center justify-center group">
                                        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>

                                        {/* Mock Graph Visual */}
                                        <svg className="w-full h-full pointer-events-none">
                                            {backlinks.length > 0 && (
                                                <line x1="50%" y1="50%" x2="20%" y2="30%" stroke="#e2e8f0" strokeWidth="1.5" />
                                            )}
                                            {linkedCards.length > 0 && (
                                                <line x1="50%" y1="50%" x2="80%" y2="40%" stroke="#e2e8f0" strokeWidth="1.5" />
                                            )}
                                            {backlinks.slice(0, 1).map((_, idx) => (
                                                <g key={`backlink-${idx}`}>
                                                    <circle cx="20%" cy="30%" r="3" fill="#cbd5e1" />
                                                    <text x="20%" y="25%" textAnchor="middle" className="text-[8px] fill-zinc-400">{backlinks[0]?.id.slice(0, 2) || 'D4'}</text>
                                                </g>
                                            ))}
                                            {linkedCards.slice(0, 1).map((linked, idx) => (
                                                <g key={`linked-${idx}`}>
                                                    <circle cx="80%" cy="40%" r="3" fill="#cbd5e1" />
                                                    <text x="80%" y="35%" textAnchor="middle" className="text-[8px] fill-zinc-400">{linked.id.slice(0, 2)}</text>
                                                </g>
                                            ))}
                                            <circle cx="50%" cy="50%" r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                                            <text x="50%" y="60%" textAnchor="middle" className="text-[8px] fill-blue-500 font-bold">CURRENT</text>
                                        </svg>
                                    </div>

                                    <div className="p-4 space-y-6">
                                        {/* Backlinks */}
                                        {backlinks.length > 0 && (
                                            <div>
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Backlinks</div>
                                                <div className="space-y-2">
                                                    {backlinks.slice(0, 5).map(backlink => {
                                                        const isPreviewing = (previewCard as any)?.id === backlink.id;
                                                        return (
                                                            <div
                                                                key={backlink.id}
                                                                className={`p-2 bg-white border rounded-sm shadow-sm cursor-pointer transition-all group ${isPreviewing
                                                                    ? 'border-blue-400 bg-blue-50/30'
                                                                    : 'border-zinc-200 hover:border-blue-400'
                                                                    }`}
                                                                onClick={() => handleLinkClick(backlink.id)}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className={`text-xs font-medium group-hover:underline ${isPreviewing ? 'text-blue-700' : 'text-blue-600'
                                                                        }`}>{backlink.title || 'Untitled'}</span>
                                                                    <span className="text-[8px] text-zinc-300">REVIEW</span>
                                                                </div>
                                                                <div className="text-[10px] text-zinc-400 truncate">{getContentPreview(backlink.content, 50)}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Outgoing */}
                                        {linkedCards.length > 0 && (
                                            <div>
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Outgoing</div>
                                                <div className="space-y-1">
                                                    {linkedCards.slice(0, 5).map(linked => {
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
                                                                <span className={`text-xs ${isPreviewing
                                                                    ? 'text-blue-700'
                                                                    : 'text-zinc-600 group-hover:text-blue-600'
                                                                    }`}>{linked.title || 'Untitled'}</span>
                                                                <ArrowRight size={10} className={`${isPreviewing
                                                                    ? 'text-blue-500'
                                                                    : 'text-zinc-300 group-hover:text-blue-400'
                                                                    } -rotate-45`} />
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
        </div>
    );
}


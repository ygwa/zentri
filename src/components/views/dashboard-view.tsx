import { useState, useEffect, useCallback } from "react";
import { Filter, Plus, ArrowRight, CornerDownRight, FileText, Cpu, Lightbulb, HelpCircle, BookMarked, Rows3, LayoutGrid, Inbox } from "lucide-react";
import { useAppStore } from "@/store";
import { Card as CardData } from "@/types";
import { StatusStrip } from "@/components/ui/status-strip";
import { FleetingNoteModal } from "./fleeting-note-modal";

interface DashboardViewProps {
    onOpenCard: (id: string) => void;
    onOpenProject?: (id: string) => void;
}

// 计算卡片的链接统计
function getCardLinkStats(card: CardData, allCards: CardData[]) {
    const linksOut = card.links?.length || 0;
    const linksIn = allCards.filter(c => c.links?.includes(card.id)).length;
    return { linksIn, linksOut };
}

// 计算卡片状态
function getCardStatus(card: CardData, allCards: CardData[]): 'healthy' | 'orphan' | 'hub' | 'stub' {
    const { linksIn, linksOut } = getCardLinkStats(card, allCards);
    if (linksIn === 0 && linksOut === 0) return 'orphan';
    if (linksIn > 3 || linksOut > 3) return 'hub';
    if (linksIn === 0 && linksOut > 0) return 'stub';
    return 'healthy';
}

// 提取内容预览文本
function getContentPreview(content: CardData['content']): string {
    // 尝试从TipTap JSON中提取文本
    if (content && typeof content === 'object' && 'content' in content) {
        const extractText = (node: any): string => {
            if (node.text) return node.text;
            if (node.content && Array.isArray(node.content)) {
                return node.content.map(extractText).join(' ');
            }
            return '';
        };
        const text = (content.content || []).map(extractText).join(' ').slice(0, 100);
        return text || 'No content...';
    }
    return 'No content...';
}

export function DashboardView({ onOpenCard, onOpenProject }: DashboardViewProps) {
    const { cards, createCard } = useAppStore();
    const [editingFleetingId, setEditingFleetingId] = useState<string | null>(null);
    const [compactMode, setCompactMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('dashboard-compact-mode');
        return saved === 'true';
    });

    const fleetingCards = cards.filter(c => c.type === 'fleeting');
    const permanentCards = cards.filter(c => c.type === 'permanent');
    const outputCards = cards.filter(c => c.type === 'project');

    // 按类型分组 inbox 卡片
    const ideaCards = fleetingCards.filter(c => c.tags.includes('idea'));
    const questionCards = fleetingCards.filter(c => c.tags.includes('question'));
    const highlightCards = fleetingCards.filter(c => c.tags.includes('highlight'));
    const otherCards = fleetingCards.filter(c => !c.tags.includes('idea') && !c.tags.includes('question') && !c.tags.includes('highlight'));

    // 处理点击 capture 框，创建新卡片并打开编辑器
    const handleCaptureClick = useCallback(async () => {
        try {
            const newCard = await createCard('fleeting', 'Untitled', undefined);
            if (newCard) {
                // 等待一下确保卡片已创建并加载
                setTimeout(() => {
                    setEditingFleetingId(newCard.id);
                }, 50);
            }
        } catch (error) {
            console.error('Failed to create card:', error);
        }
    }, [createCard]);

    // 键盘快捷键：Cmd+I 快速捕获
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+I 或 Ctrl+I 快速捕获
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
                // 如果正在编辑某个卡片，不触发
                if (editingFleetingId) return;
                e.preventDefault();
                handleCaptureClick();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingFleetingId, handleCaptureClick]);

    return (
        <div className="flex h-full overflow-hidden divide-x divide-zinc-200 bg-[#f4f4f5]">
            {/* Column 1: Inbox (Capture Stream) */}
            <div className="w-72 flex flex-col bg-[#fafafa] shrink-0">
                <div className="h-10 border-b border-zinc-200 flex items-center px-3 justify-between bg-[#fafafa] shrink-0">
                    <h2 className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-2">
                        Inbox <span className="bg-zinc-200 px-1.5 rounded-sm text-zinc-600 font-mono text-[10px]">{fleetingCards.length}</span>
                    </h2>
                    <div className="flex gap-1">
                        <button className="text-zinc-400 hover:text-zinc-700 p-1 hover:bg-zinc-200 rounded-sm transition-colors"><Filter size={12} /></button>
                    </div>
                </div>

                {/* Quick Input */}
                <div className="p-2 border-b border-zinc-200 bg-white">
                    <div className="relative">
                        <textarea
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-sm p-2 focus:outline-none focus:border-blue-500 focus:ring-0 transition-all resize-none font-sans placeholder-zinc-400 text-zinc-700 cursor-pointer"
                            rows={2}
                            placeholder="点击或按 Cmd+I 捕获想法、问题或摘录..."
                            readOnly
                            onClick={handleCaptureClick}
                            onFocus={(e) => {
                                e.target.blur();
                                handleCaptureClick();
                            }}
                        />
                        <div className="absolute right-2 bottom-2 text-[9px] text-zinc-400 font-mono border border-zinc-200 px-1 rounded-sm">Cmd+I</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                    {/* 想法 (Ideas) */}
                    {ideaCards.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <Lightbulb size={12} className="text-yellow-600" />
                                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">想法</h3>
                                <span className="text-[9px] text-zinc-400 font-mono bg-zinc-100 px-1 rounded-sm">{ideaCards.length}</span>
                            </div>
                            <div className="space-y-2">
                                {ideaCards.map((item) => {
                                    const preview = getContentPreview(item.content);
                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative p-2.5 bg-white rounded-sm border border-yellow-200 hover:border-yellow-400 hover:shadow-sm transition-all cursor-pointer"
                                            onClick={() => setEditingFleetingId(item.id)}
                                        >
                                            {item.title && (
                                                <h3 className="text-xs text-zinc-800 leading-relaxed mb-1 font-semibold line-clamp-1">{item.title}</h3>
                                            )}
                                            {preview && (
                                                <p className="text-xs text-zinc-600 leading-relaxed mb-1.5 line-clamp-2">{preview}</p>
                                            )}
                                            {!item.title && !preview && (
                                                <p className="text-xs text-zinc-400 italic mb-1.5">Empty note</p>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-yellow-600 font-mono bg-yellow-50 px-1 rounded-sm border border-yellow-100">想法</span>
                                                <span className="text-[9px] text-zinc-400 font-mono">
                                                    {new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 问题 (Questions) */}
                    {questionCards.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <HelpCircle size={12} className="text-blue-600" />
                                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">问题</h3>
                                <span className="text-[9px] text-zinc-400 font-mono bg-zinc-100 px-1 rounded-sm">{questionCards.length}</span>
                            </div>
                            <div className="space-y-2">
                                {questionCards.map((item) => {
                                    const preview = getContentPreview(item.content);
                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative p-2.5 bg-white rounded-sm border border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer"
                                            onClick={() => setEditingFleetingId(item.id)}
                                        >
                                            {item.title && (
                                                <h3 className="text-xs text-zinc-800 leading-relaxed mb-1 font-semibold line-clamp-1">{item.title}</h3>
                                            )}
                                            {preview && (
                                                <p className="text-xs text-zinc-600 leading-relaxed mb-1.5 line-clamp-2">{preview}</p>
                                            )}
                                            {!item.title && !preview && (
                                                <p className="text-xs text-zinc-400 italic mb-1.5">Empty note</p>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-blue-600 font-mono bg-blue-50 px-1 rounded-sm border border-blue-100">问题</span>
                                                <span className="text-[9px] text-zinc-400 font-mono">
                                                    {new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 摘录 (Highlights) */}
                    {highlightCards.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <BookMarked size={12} className="text-green-600" />
                                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">摘录</h3>
                                <span className="text-[9px] text-zinc-400 font-mono bg-zinc-100 px-1 rounded-sm">{highlightCards.length}</span>
                            </div>
                            <div className="space-y-2">
                                {highlightCards.map((item) => {
                                    const preview = getContentPreview(item.content);
                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative p-2.5 bg-white rounded-sm border border-green-200 hover:border-green-400 hover:shadow-sm transition-all cursor-pointer"
                                            onClick={() => setEditingFleetingId(item.id)}
                                        >
                                            {item.title && (
                                                <h3 className="text-xs text-zinc-800 leading-relaxed mb-1 font-semibold line-clamp-1">{item.title}</h3>
                                            )}
                                            {preview && (
                                                <p className="text-xs text-zinc-600 leading-relaxed mb-1.5 line-clamp-2">{preview}</p>
                                            )}
                                            {!item.title && !preview && (
                                                <p className="text-xs text-zinc-400 italic mb-1.5">Empty note</p>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-green-600 font-mono bg-green-50 px-1 rounded-sm border border-green-100">摘录</span>
                                                <span className="text-[9px] text-zinc-400 font-mono">
                                                    {new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 其他 (Other) */}
                    {otherCards.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">其他</h3>
                                <span className="text-[9px] text-zinc-400 font-mono bg-zinc-100 px-1 rounded-sm">{otherCards.length}</span>
                            </div>
                            <div className="space-y-2">
                                {otherCards.map((item) => {
                                    const preview = getContentPreview(item.content);
                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative p-2.5 bg-white rounded-sm border border-zinc-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer"
                                            onClick={() => setEditingFleetingId(item.id)}
                                        >
                                            {item.title && (
                                                <h3 className="text-xs text-zinc-800 leading-relaxed mb-1 font-semibold line-clamp-1">{item.title}</h3>
                                            )}
                                            {preview && (
                                                <p className="text-xs text-zinc-600 leading-relaxed mb-1.5 line-clamp-2">{preview}</p>
                                            )}
                                            {!item.title && !preview && (
                                                <p className="text-xs text-zinc-400 italic mb-1.5">Empty note</p>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <div className="flex gap-1">
                                                    {item.tags.slice(0, 2).map(tag => (
                                                        <span key={tag} className="text-[9px] text-zinc-600 font-mono bg-zinc-50 px-1 rounded-sm border border-zinc-200">#{tag}</span>
                                                    ))}
                                                </div>
                                                <span className="text-[9px] text-zinc-400 font-mono">
                                                    {new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 空状态 */}
                    {fleetingCards.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                                <Inbox size={24} className="text-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-zinc-600 mb-1">Inbox 是空的</h3>
                            <p className="text-xs text-zinc-400 mb-4 max-w-[200px]">使用上方输入框或按 Cmd+I 快速捕获想法、问题或摘录</p>
                            <button
                                onClick={handleCaptureClick}
                                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                <Plus size={14} />
                                创建第一个笔记
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Column 2: Library (Permanent Notes) */}
            <div className="flex-1 flex flex-col bg-white min-w-[400px]">
                <div className="h-10 border-b border-zinc-200 flex items-center px-4 justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">Zettelkasten</h2>
                        <div className="h-3 w-[1px] bg-zinc-300"></div>
                        <div className="flex items-center gap-1 text-[9px] text-blue-600 bg-blue-50 px-1.5 rounded-sm border border-blue-100 font-bold uppercase">
                            <Cpu size={10} /> Permanent Notes
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const newMode = !compactMode;
                                setCompactMode(newMode);
                                localStorage.setItem('dashboard-compact-mode', String(newMode));
                            }}
                            className="text-zinc-400 hover:text-zinc-700 p-1 hover:bg-zinc-200 rounded-sm transition-colors"
                            title={compactMode ? "展开模式" : "紧凑模式"}
                        >
                            {compactMode ? <LayoutGrid size={12} /> : <Rows3 size={12} />}
                        </button>
                        <div className="flex gap-2 text-[10px] text-zinc-400 font-mono">
                            <span>{permanentCards.length} NODES</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f4f4f5]">
                    {permanentCards.map((card) => {
                        const { linksIn, linksOut } = getCardLinkStats(card, cards);
                        const status = getCardStatus(card, cards);
                        const preview = getContentPreview(card.content);

                        return (
                            <div
                                key={card.id}
                                onClick={() => onOpenCard(card.id)}
                                className="relative pl-3 pr-3 py-2 bg-white rounded-sm border border-zinc-200 hover:border-blue-300 transition-all cursor-pointer group flex gap-3 items-start shadow-sm"
                            >
                                {/* Left: ID & Meta */}
                                <div className="w-24 shrink-0 flex flex-col gap-2 pt-0.5 border-r border-dashed border-zinc-200 pr-2">
                                    <span className="font-mono text-[10px] text-zinc-500 tracking-tight font-semibold">{card.id.slice(0, 12)}</span>
                                    <div className="flex items-center gap-1">
                                        <div className="flex items-center gap-1 text-[9px] text-blue-600 bg-blue-50 px-1 rounded-sm border border-blue-100 font-bold uppercase w-fit">
                                            <Cpu size={8} /> Perm
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Content */}
                                <div className="flex-1 min-w-0 relative">
                                    <div className="absolute top-0 right-0 flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <StatusStrip status={status} asBadge={true} />
                                    </div>
                                    <div className="flex justify-between items-start mb-1 pr-16">
                                        <h3 className="font-bold text-zinc-800 text-sm truncate pr-2">{card.title || 'Untitled'}</h3>
                                    </div>
                                    {!compactMode && (
                                        <p className="text-[11px] text-zinc-600 line-clamp-1 leading-relaxed mb-1.5 font-normal">
                                            {preview}
                                        </p>
                                    )}

                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-1">
                                            {card.tags.slice(0, 3).map(tag => (
                                                <span key={tag} className="text-[9px] text-zinc-600 bg-zinc-100 px-1 rounded-sm border border-zinc-200">#{tag}</span>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <span className="flex items-center gap-0.5 text-[9px] text-zinc-400 font-mono">
                                                <CornerDownRight size={8} className="scale-x-[-1]" /> {linksIn}
                                            </span>
                                            <span className="flex items-center gap-0.5 text-[9px] text-zinc-400 font-mono">
                                                <ArrowRight size={8} /> {linksOut}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Column 3: Output (Outliner) */}
            <div className="w-72 flex flex-col bg-zinc-50 shrink-0 border-l border-zinc-200">
                <div className="h-10 border-b border-zinc-200 flex items-center px-3 justify-between bg-zinc-50 shrink-0">
                    <h2 className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">Output</h2>
                    <button className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 p-1 rounded-sm transition-colors"><Plus size={12} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {outputCards.map((project) => {
                        // 计算进度（如果有链接的卡片）
                        const linkedCount = project.links?.length || 0;
                        const progress = linkedCount > 0 ? Math.min(100, (linkedCount / 5) * 100) : 0;

                        return (
                            <div key={project.id} className="border border-zinc-200 rounded-sm bg-white shadow-sm">
                                <div className="flex justify-between items-center p-2 bg-zinc-50 border-b border-zinc-200">
                                    <div className="flex items-center gap-2">
                                        <FileText size={12} className="text-blue-600" />
                                        <span className="text-xs font-bold text-zinc-800">{project.title || 'Untitled Project'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-mono text-zinc-400">{Math.round(progress)}%</span>
                                    </div>
                                </div>

                                <div className="py-1">
                                    {/* 显示链接的卡片作为sections */}
                                    {project.links && project.links.length > 0 ? (
                                        project.links.slice(0, 5).map((linkedId, idx) => {
                                            const linkedCard = cards.find(c => c.id === linkedId);
                                            return linkedCard ? (
                                                <div key={linkedId} className="flex items-center justify-between px-2 py-1.5 hover:bg-blue-50 group cursor-pointer border-l-2 border-transparent hover:border-blue-500 transition-all">
                                                    <span className="text-[11px] text-zinc-600 truncate flex-1 font-medium">
                                                        {idx + 1}. {linkedCard.title || 'Untitled'}
                                                    </span>
                                                    <span className="font-mono text-[9px] text-zinc-500 bg-zinc-100 px-1 rounded-sm border border-zinc-200">
                                                        {linkedCard.id.slice(0, 4)}
                                                    </span>
                                                </div>
                                            ) : null;
                                        })
                                    ) : (
                                        <div className="px-2 py-1.5 text-[11px] text-zinc-400 text-center">
                                            No sections yet
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        if (onOpenProject) {
                                            onOpenProject(project.id);
                                        }
                                    }}
                                    className="w-full text-center py-1.5 bg-zinc-900 text-white text-[10px] font-bold uppercase rounded-sm hover:bg-zinc-800 transition-colors mt-2 mx-2 mb-2"
                                >
                                    Open Editor
                                </button>
                                <div className="w-full h-1 bg-zinc-100">
                                    <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>


            {/* Fleeting Note Modal */}
            {editingFleetingId && (
                <FleetingNoteModal
                    cardId={editingFleetingId}
                    onClose={() => setEditingFleetingId(null)}
                    onDelete={() => setEditingFleetingId(null)}
                    onConvertToPermanent={(id) => {
                        setEditingFleetingId(null);
                        onOpenCard(id);
                    }}
                    onOpenPermanentNote={(id) => {
                        setEditingFleetingId(null);
                        onOpenCard(id);
                    }}
                />
            )}
        </div>
    );
}

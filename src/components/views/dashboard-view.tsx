import { useState } from "react";
import { Filter, Plus, ArrowRight, CornerDownRight, FileText, Cpu, Book, Quote } from "lucide-react";
import { useAppStore } from "@/store";
import { Card as CardData } from "@/types";
import { StatusStrip } from "@/components/ui/status-strip";
import { FleetingNoteModal } from "./fleeting-note-modal";
import { hasCardContent } from "@/lib/content-preview";
import { cn } from "@/lib/utils";

interface DashboardViewProps {
    onOpenCard: (id: string) => void;
    onOpenProject?: (id: string) => void;
}

type LibraryFilterType = 'all' | 'permanent' | 'literature';

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
    if (!content) return '';
    
    // 递归提取文本的辅助函数
    const extractText = (node: any): string => {
        if (!node) return '';
        if (node.text) return node.text;
        if (node.type === 'wikiLink' && node.attrs?.title) {
            return `[[${node.attrs.title}]]`;
        }
        if (node.content && Array.isArray(node.content)) {
            return node.content.map(extractText).join('');
        }
        return '';
    };
    
    // 尝试从TipTap JSON中提取文本
    if (typeof content === 'object' && 'content' in content && Array.isArray(content.content)) {
        const text = content.content
            .map(extractText)
            .join(' ')
            .replace(/\s+/g, ' ')  // 合并多个空格
            .trim()
            .slice(0, 120);
        return text;
    }
    
    return '';
}

export function DashboardView({ onOpenCard, onOpenProject }: DashboardViewProps) {
    const { cards, createCard, convertCard } = useAppStore();
    const [quickInput, setQuickInput] = useState('');
    const [libraryFilter, setLibraryFilter] = useState<LibraryFilterType>('all');
    const [editingFleetingId, setEditingFleetingId] = useState<string | null>(null);


    // 过滤 fleeting 卡片，已归档的卡片仍然显示在 inbox 中（但可以有不同的视觉标识）
    const fleetingCards = cards.filter(c => c.type === 'fleeting');
    const permanentCards = cards.filter(c => c.type === 'permanent');
    const literatureCards = cards.filter(c => c.type === 'literature');
    const outputCards = cards.filter(c => c.type === 'project');

    // 根据过滤条件筛选卡片
    const filteredLibraryCards = (() => {
        if (libraryFilter === 'all') {
            return [...permanentCards, ...literatureCards];
        } else if (libraryFilter === 'permanent') {
            return permanentCards;
        } else {
            return literatureCards;
        }
    })();

    const handleQuickInput = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && quickInput.trim()) {
            e.preventDefault();
            const content = quickInput.trim();
            // 闪念笔记不需要标题，使用空字符串，内容作为初始内容
            // 创建空的 JSON 文档结构，包含一个段落
            const jsonContent = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: content
                            }
                        ]
                    }
                ]
            };
            const newCard = await createCard('fleeting', '', undefined);
            // 立即更新内容和标签（快速输入默认为想法）
            if (newCard) {
                const { updateCard } = useAppStore.getState();
                await updateCard(newCard.id, { 
                    content: jsonContent as any,
                    tags: ['idea']
                });
            }
            setQuickInput('');
        }
    };

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
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-sm p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:bg-white transition-all resize-none font-sans placeholder-zinc-400 text-zinc-700 leading-relaxed"
                            rows={1}
                            placeholder="快速记录想法... (Enter 发送)"
                            value={quickInput}
                            onChange={(e) => setQuickInput(e.target.value)}
                            onKeyDown={handleQuickInput}
                        />
                        {quickInput && (
                            <div className="absolute right-2 bottom-2 text-[9px] text-blue-500 font-mono border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded-sm">
                                Enter ↵
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {fleetingCards.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400 text-xs">
                            <p className="mb-1">暂无闪念</p>
                            <p className="text-[10px]">按 Cmd+I 快速记录</p>
                        </div>
                    ) : (
                        fleetingCards.map((item) => {
                            // 闪念笔记优先显示内容预览，如果没有内容则显示标题
                            const preview = getContentPreview(item.content);
                            const displayText = preview || item.title || '';
                            const isEmpty = !displayText;
                            const isArchived = item.tags.includes('archived');
                            
                            return (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "group relative p-3 rounded-sm border transition-all cursor-pointer",
                                        isArchived
                                            ? "bg-zinc-50 border-zinc-300 hover:border-zinc-400 opacity-75"
                                            : "bg-white border-zinc-200 hover:border-blue-400 hover:shadow-sm"
                                    )}
                                    onClick={() => setEditingFleetingId(item.id)}
                                >
                                    {isArchived && (
                                        <div className="absolute top-2 right-2">
                                            <span className="text-[8px] text-zinc-500 bg-zinc-200 px-1 rounded border border-zinc-300 font-mono">ARCHIVED</span>
                                        </div>
                                    )}
                                    <p className={cn(
                                        "text-xs leading-relaxed mb-2 font-medium line-clamp-3",
                                        isEmpty ? 'text-zinc-400 italic' : isArchived ? 'text-zinc-600' : 'text-zinc-800'
                                    )}>
                                        {isEmpty ? '空白笔记，点击编辑...' : displayText}
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-1 flex-wrap">
                                            {item.tags.filter(t => t !== 'archived').slice(0, 2).map(tag => (
                                                <span key={tag} className="text-[9px] text-blue-600 font-mono bg-blue-50 px-1 rounded-sm border border-blue-100">#{tag}</span>
                                            ))}
                                        </div>
                                        <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                                            {new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Column 2: Library (The Archive) */}
            <div className="flex-1 flex flex-col bg-white min-w-[400px]">
                <div className="h-10 border-b border-zinc-200 flex items-center px-4 justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">Zettelkasten</h2>
                        <div className="h-3 w-[1px] bg-zinc-300"></div>
                        <div className="flex bg-zinc-100 rounded-sm p-0.5 border border-zinc-200">
                            <button
                                onClick={() => setLibraryFilter('all')}
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-medium border transition-colors ${libraryFilter === 'all'
                                    ? 'bg-white text-zinc-800 border-zinc-200 shadow-sm'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setLibraryFilter('permanent')}
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-medium border flex items-center gap-1 transition-colors ${libraryFilter === 'permanent'
                                    ? 'bg-white text-blue-700 border-zinc-200 shadow-sm'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                                    }`}
                            >
                                <Cpu size={10} /> Perm
                            </button>
                            <button
                                onClick={() => setLibraryFilter('literature')}
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-medium border flex items-center gap-1 transition-colors ${libraryFilter === 'literature'
                                    ? 'bg-white text-orange-700 border-zinc-200 shadow-sm'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                                    }`}
                            >
                                <Book size={10} /> Lit
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 text-[10px] text-zinc-400 font-mono">
                        <span>{filteredLibraryCards.length} / {permanentCards.length + literatureCards.length} NODES</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f4f4f5]">
                    {filteredLibraryCards.map((card) => {
                        const { linksIn, linksOut } = getCardLinkStats(card, cards);
                        const status = getCardStatus(card, cards);
                        const preview = getContentPreview(card.content);

                        return (
                            <div
                                key={card.id}
                                onClick={() => onOpenCard(card.id)}
                                className={`relative pl-3 pr-3 py-2 bg-white rounded-sm border transition-all cursor-pointer group flex gap-3 items-start shadow-sm ${card.type === 'literature'
                                    ? 'border-orange-200 hover:border-orange-400'
                                    : 'border-zinc-300 hover:border-blue-500'
                                    }`}
                            >
                                <StatusStrip status={status} />

                                {/* Left: ID & Meta */}
                                <div className="w-24 shrink-0 flex flex-col gap-2 pt-0.5 border-r border-dashed border-zinc-200 pr-2">
                                    <span className="font-mono text-[10px] text-zinc-500 tracking-tight font-semibold">{card.id.slice(0, 12)}</span>
                                    <div className="flex items-center gap-1">
                                        {card.type === 'permanent' ? (
                                            <div className="flex items-center gap-1 text-[9px] text-blue-600 bg-blue-50 px-1 rounded-sm border border-blue-100 font-bold uppercase w-fit">
                                                <Cpu size={8} /> Perm
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-[9px] text-orange-600 bg-orange-50 px-1 rounded-sm border border-orange-100 font-bold uppercase w-fit">
                                                <Quote size={8} /> Lit
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-zinc-800 text-sm truncate pr-2">{card.title || 'Untitled'}</h3>
                                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {status === 'orphan' && <span className="text-[9px] text-rose-500 font-mono bg-rose-50 px-1 border border-rose-100 rounded-sm">ORPHAN</span>}
                                        </div>
                                    </div>
                                    {card.type === 'literature' && card.sourceId && (
                                        <div className="flex items-center gap-1 mb-1.5 text-[10px] text-zinc-500 font-mono bg-zinc-50 px-1.5 py-0.5 rounded-sm w-fit border border-zinc-100">
                                            <Book size={10} /> Ref: {card.sourceId.slice(0, 8)}
                                        </div>
                                    )}
                                    <p className={`text-[11px] line-clamp-1 leading-relaxed mb-1.5 font-normal ${preview ? 'text-zinc-600' : 'text-zinc-400 italic'}`}>
                                        {preview || '暂无内容...'}
                                    </p>

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
                                <div className="m-2">
                                <button
                                    onClick={() => {
                                        if (onOpenProject) {
                                            onOpenProject(project.id);
                                        }
                                    }}
                                    className="w-full cursor-pointer text-center py-1.5 bg-zinc-900 text-white text-[10px] font-bold uppercase rounded-sm hover:bg-zinc-800 transition-colors"
                                >
                                    Open Editor
                                </button>
                                </div>
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
                    onDelete={async (id) => {
                        await useAppStore.getState().deleteCard(id);
                        setEditingFleetingId(null);
                    }}
                    onConvertToPermanent={async (id) => {
                        // 这个回调现在不会被直接调用，因为转换逻辑在 modal 内部处理
                        // 但保留它以防其他地方需要
                        setEditingFleetingId(null);
                    }}
                    onOpenPermanentNote={(id) => {
                        // 打开新创建的永久笔记
                        setEditingFleetingId(null);
                        onOpenCard(id);
                    }}
                />
            )}
        </div>
    );
}

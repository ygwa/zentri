import { useAppStore } from "@/store";
import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZentriEditor } from "@/components/editor";
import { BacklinksInline } from "@/components/backlinks-panel";

interface NoteDetailProps {
    noteId: string;
    onClose?: () => void;
    onNavigateToNote?: (id: string) => void;
}

export function NoteDetail({ noteId, onClose, onNavigateToNote }: NoteDetailProps) {
    const { cards, updateCard } = useAppStore();
    const card = cards.find((c) => c.id === noteId);

    if (!card) return null;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
            {/* 1. Header with Breadcrumbs/Actions */}
            <div className="h-10 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400 font-bold font-mono">{card.id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[9px] border border-zinc-200 dark:border-zinc-700 uppercase tracking-wider font-bold">
                        {card.type}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col relative">
                <ScrollArea className="flex-1">
                    <div className="max-w-2xl mx-auto py-8 px-8">
                        {/* YAML Frontmatter Visualized - Code Block Style */}
                        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 rounded-sm font-mono text-xs shadow-sm">
                            <div className="flex gap-2 mb-1">
                                <span className="text-purple-600 dark:text-purple-400 font-bold w-16">type:</span>
                                <span className="text-orange-600 dark:text-orange-400">{card.type}</span>
                            </div>
                            <div className="flex gap-2 mb-1">
                                <span className="text-purple-600 dark:text-purple-400 font-bold w-16">tags:</span>
                                <span className="text-zinc-600 dark:text-zinc-400">[{card.tags?.join(", ")}]</span>
                            </div>
                            <div className="flex gap-2 mb-1">
                                <span className="text-purple-600 dark:text-purple-400 font-bold w-16">links:</span>
                                <span className="text-zinc-600 dark:text-zinc-400">{card.links?.length || 0}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-purple-600 dark:text-purple-400 font-bold w-16">updated:</span>
                                <span className="text-zinc-400 dark:text-zinc-500">{new Date(card.updatedAt).toISOString().split('T')[0]}</span>
                            </div>
                        </div>

                        <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800" />

                        {/* Title Input */}
                        <input
                            className="w-full text-2xl font-bold text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-200 dark:placeholder:text-zinc-700 border-none outline-none bg-transparent mb-4 tracking-tight"
                            value={card.title}
                            onChange={(e) => updateCard(card.id, { title: e.target.value })}
                            placeholder="Untitled Note"
                        />

                        {/* Editor Content */}
                        <div className="min-h-[400px]">
                            <ZentriEditor
                                content={card.content}
                                onChange={(content) => updateCard(card.id, { content: content as any })}
                            />
                        </div>

                        {/* Backlinks Section - 使用真实数据 */}
                        <BacklinksInline 
                            cardId={noteId} 
                            onLinkClick={onNavigateToNote}
                        />
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

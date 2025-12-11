import { useAppStore } from "@/store";
import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZentriEditor } from "@/components/editor";

interface NoteDetailProps {
    noteId: string;
    onClose?: () => void;
}

export function NoteDetail({ noteId, onClose }: NoteDetailProps) {
    const { cards, updateCard } = useAppStore();
    const card = cards.find((c) => c.id === noteId);

    if (!card) return null;

    return (
        <div className="h-full flex flex-col bg-white">
            {/* 1. Header with Breadcrumbs/Actions */}
            <div className="h-10 px-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-600 font-bold font-mono">{card.id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 text-[9px] border border-zinc-200 uppercase tracking-wider font-bold">
                        MARKDOWN
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-sm transition-colors"
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
                        <div className="mb-6 p-4 bg-[#fafafa] border border-zinc-100 rounded-sm font-mono text-xs shadow-sm">
                            <div className="flex gap-2 mb-1">
                                <span className="text-purple-600 font-bold w-16">type:</span>
                                <span className="text-orange-600">{card.type}</span>
                            </div>
                            <div className="flex gap-2 mb-1">
                                <span className="text-purple-600 font-bold w-16">tags:</span>
                                <span className="text-zinc-600">[{card.tags?.join(", ")}]</span>
                            </div>
                            <div className="flex gap-2 mb-1">
                                <span className="text-purple-600 font-bold w-16">status:</span>
                                <span className="text-emerald-600">healthy</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-purple-600 font-bold w-16">updated:</span>
                                <span className="text-zinc-400">{new Date(card.updatedAt).toISOString().split('T')[0]}</span>
                            </div>
                        </div>

                        <div className="mb-6 border-b border-zinc-100" />

                        {/* Title Input */}
                        <input
                            className="w-full text-2xl font-bold text-zinc-800 placeholder:text-zinc-200 border-none outline-none bg-transparent mb-4 tracking-tight"
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

                        {/* References Section (Bottom of note style) */}
                        <div className="mt-12 pt-6 border-t border-zinc-100">
                            <h3 className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mb-3">
                                References & Backlinks
                            </h3>
                            <div className="space-y-1.5 font-mono text-xs">
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <span className="text-zinc-300">[1]</span>
                                    <span>Rust Official Documentation - Ownership</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <span className="text-zinc-300">[2]</span>
                                    <span className="text-blue-600 hover:underline cursor-pointer">[[20231024-B2]] RAII Patterns</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

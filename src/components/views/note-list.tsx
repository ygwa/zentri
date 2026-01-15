
import { useAppStore } from "@/store";
import { Search, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardType } from "@/types";

interface NoteListProps {
    viewMode: string;
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export function NoteList({ viewMode, selectedId, onSelect }: NoteListProps) {
    const { cards } = useAppStore();

    // Filter logic based on viewMode
    const filteredCards = cards.filter(card => {
        if (viewMode === 'inbox') return card.type === 'fleeting';
        if (viewMode === 'all') return true;
        return true;
    });

    const getCardTypeColor = (type: CardType) => {
        switch (type) {
            case 'fleeting': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'literature': return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'permanent': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'project': return 'bg-violet-100 text-violet-700 border-violet-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#fafafa]">
            {/* Header */}
            <div className="h-10 px-4 border-b border-[#e5e5e5] flex items-center justify-between shrink-0 bg-[#fafafa]">
                <h2 className="font-semibold text-xs tracking-wide text-[#71717a] uppercase">
                    {viewMode === 'inbox' ? 'Inbox' : 'Notes'}
                </h2>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#a1a1aa] bg-[#f4f4f5] px-1.5 py-0.5 rounded-md border border-[#e4e4e7]">
                        {filteredCards.length}
                    </span>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-3 py-2 shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#a1a1aa]" />
                    <input
                        className="w-full bg-white border border-[#e5e5e5] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-1 focus:ring-[#e5e5e5] shadow-sm transition-all"
                        placeholder="Search notes..."
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
                {filteredCards.map((card) => (
                    <div
                        key={card.id}
                        onClick={() => onSelect(card.id)}
                        draggable="true"
                        onDragStart={(e) => {
                            // Custom types
                            e.dataTransfer.setData('application/reactflow/type', 'card');
                            e.dataTransfer.setData('application/zentri/card-id', card.id);
                            e.dataTransfer.setData('application/zentri/card-title', card.title || 'Untitled');

                            // JSON Fallback (more reliable)
                            const dragData = {
                                type: 'card',
                                cardId: card.id,
                                cardTitle: card.title || 'Untitled'
                            };
                            e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className={cn(
                            "group flex gap-2 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing shadow-sm items-start relative",
                            selectedId === card.id
                                ? "bg-white border-blue-400/50 shadow-md ring-1 ring-blue-400/20"
                                : "bg-white border-transparent hover:border-[#e4e4e7] hover:shadow-md"
                        )}
                    >
                        {/* Grip Handle */}
                        <div className="mt-0.5 text-zinc-300 group-hover:text-zinc-400">
                            <GripVertical size={12} />
                        </div>

                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className={cn(
                                    "font-medium text-xs leading-snug line-clamp-2",
                                    selectedId === card.id ? "text-[#18181b]" : "text-[#3f3f46]"
                                )}>
                                    {card.title || "Untitled Card"}
                                </h3>
                                <span className="text-[9px] text-[#a1a1aa] font-mono shrink-0 pt-0.5">
                                    {new Date(card.updatedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn("text-[9px] px-1 py-0.5 rounded-[3px] border font-medium", getCardTypeColor(card.type))}>
                                    #{card.type}
                                </span>
                                {card.tags?.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-[9px] text-[#71717a] bg-[#f4f4f5] px-1 py-0.5 rounded-[3px] border border-[#e4e4e7]">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredCards.length === 0 && (
                    <div className="text-center py-10 text-[#a1a1aa] text-xs">
                        No notes found.
                    </div>
                )}
            </div>
        </div>
    );
}

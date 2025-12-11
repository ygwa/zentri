
import { useAppStore } from "@/store";
import { Search, Plus, Filter, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        if (viewMode === 'inbox') return card.type === 'fleeting'; // Assuming 'fleeting' is inbox for now
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
            <div className="h-14 px-4 border-b border-[#e5e5e5] flex items-center justify-between shrink-0 bg-[#fafafa]">
                <h2 className="font-semibold text-sm tracking-wide text-[#71717a] uppercase">
                    {viewMode === 'inbox' ? 'Inbox' : 'Zettelkasten'}
                </h2>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-[#a1a1aa] bg-[#f4f4f5] px-2 py-0.5 rounded-md border border-[#e4e4e7]">
                        {filteredCards.length}
                    </span>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-3 py-3 shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#a1a1aa]" />
                    <input
                        className="w-full bg-white border border-[#e5e5e5] rounded-lg pl-9 pr-3 py-2 text-sm text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-1 focus:ring-[#e5e5e5] shadow-sm transition-all"
                        placeholder="Cmd+I to capture..."
                    />
                    <div className="absolute right-2 top-2.5">
                        <span className="text-[10px] text-[#d4d4d8] border border-[#e4e4e7] rounded px-1">↵</span>
                    </div>
                </div>
            </div>

            {/* Filter / Sort Row (Optional) */}
            <div className="px-3 pb-2 flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="h-6 text-xs text-[#71717a] gap-1 px-2 hover:bg-[#f4f4f5]">
                    <Filter className="w-3 h-3" /> Filter
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-[#71717a] gap-1 px-2 hover:bg-[#f4f4f5]">
                    <SortAsc className="w-3 h-3" /> Recent
                </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
                {filteredCards.map((card) => (
                    <div
                        key={card.id}
                        onClick={() => onSelect(card.id)}
                        className={cn(
                            "group flex flex-col gap-1.5 p-3 rounded-xl border transition-all cursor-pointer shadow-sm",
                            selectedId === card.id
                                ? "bg-white border-blue-400/50 shadow-md ring-1 ring-blue-400/20"
                                : "bg-white border-transparent hover:border-[#e4e4e7] hover:shadow-md"
                        )}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h3 className={cn(
                                "font-medium text-sm leading-snug line-clamp-2",
                                selectedId === card.id ? "text-[#18181b]" : "text-[#3f3f46]"
                            )}>
                                {card.title || "Untitled Card"}
                            </h3>
                            <span className="text-[10px] text-[#a1a1aa] font-mono shrink-0 pt-0.5">
                                {new Date(card.updatedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", getCardTypeColor(card.type))}>
                                #{card.type}
                            </span>
                            {card.tags?.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[10px] text-[#71717a] bg-[#f4f4f5] px-1.5 py-0.5 rounded border border-[#e4e4e7]">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {filteredCards.length === 0 && (
                    <div className="text-center py-10 text-[#a1a1aa] text-sm">
                        No notes found.
                    </div>
                )}
            </div>

            {/* FAB for New Note */}
            <div className="p-4 border-t border-[#e5e5e5] shrink-0 bg-[#fafafa]">
                <Button className="w-full bg-[#18181b] hover:bg-[#27272a] text-white shadow-lg">
                    <Plus className="w-4 h-4 mr-2" /> New Note
                </Button>
            </div>
        </div>
    );
}

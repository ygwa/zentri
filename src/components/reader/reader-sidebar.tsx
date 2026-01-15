import { useState, useMemo } from "react";
import { MessageSquarePlus, Trash2, Edit2, ChevronDown, ChevronRight, Bookmark } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types";
import { format } from "date-fns";

interface ReaderSidebarProps {
    highlights: Highlight[];
    currentPage: number;
    totalPages: number;
    onNavigateToPage: (page: number) => void;
    onAddNote: (content: string, page: number) => void;
    onDeleteHighlight: (id: string) => void;
    onUpdateHighlight: (id: string, note: string) => void;
    className?: string;
}

export function ReaderSidebar({
    highlights,
    currentPage,
    onNavigateToPage,
    onAddNote,
    onDeleteHighlight,
    onUpdateHighlight,
    className,
}: ReaderSidebarProps) {
    const [activeTab, setActiveTab] = useState<'highlights' | 'notes'>('highlights');
    const [noteInput, setNoteInput] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNoteContent, setEditNoteContent] = useState("");
    const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());

    // Group highlights by page
    const highlightsByPage = useMemo(() => {
        const grouped = new Map<number, Highlight[]>();

        // Sort highlights by page then position
        const sorted = [...highlights].sort((a, b) => {
            const pageA = a.position?.page || 0;
            const pageB = b.position?.page || 0;
            if (pageA !== pageB) return pageA - pageB;

            // If on same page, sort by vertical position if available
            const yA = a.position?.rects?.[0]?.y || 0;
            const yB = b.position?.rects?.[0]?.y || 0;
            return yA - yB;
        });

        sorted.forEach(h => {
            const page = h.position?.page || 0;
            const list = grouped.get(page) || [];
            list.push(h);
            grouped.set(page, list);
        });

        return grouped;
    }, [highlights]);

    // Toggle page expansion
    const togglePage = (page: number) => {
        const newExpanded = new Set(expandedPages);
        if (newExpanded.has(page)) {
            newExpanded.delete(page);
        } else {
            newExpanded.add(page);
        }
        setExpandedPages(newExpanded);
    };

    // Initialize expanded pages (expand current page by default)
    useMemo(() => {
        setExpandedPages(prev => {
            const newSet = new Set(prev);
            if (currentPage > 0) newSet.add(currentPage);
            return newSet;
        });
    }, [currentPage]);

    const handleAddNote = () => {
        if (!noteInput.trim()) return;
        onAddNote(noteInput, currentPage);
        setNoteInput("");
    };

    const startEditing = (h: Highlight) => {
        setEditingId(h.id);
        setEditNoteContent(h.note || "");
    };

    const saveEditing = () => {
        if (editingId) {
            onUpdateHighlight(editingId, editNoteContent);
            setEditingId(null);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-50 border-l border-zinc-200", className)}>
            {/* Header Tabs */}
            <div className="flex items-center border-b border-zinc-200 bg-white">
                <button
                    onClick={() => setActiveTab('highlights')}
                    className={cn(
                        "flex-1 py-3 text-xs font-medium transition-colors relative",
                        activeTab === 'highlights' ? "text-primary" : "text-muted-foreground hover:bg-zinc-50"
                    )}
                >
                    Highlights & Note
                    {activeTab === 'highlights' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                </button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Quick Note Input */}
                    <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm space-y-2">
                        <h4 className="text-xs font-medium text-zinc-500 flex items-center gap-1">
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            Add logic note for Page {currentPage}
                        </h4>
                        <Textarea
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="Record your thoughts..."
                            className="resize-none min-h-[80px] text-xs bg-zinc-50 border-zinc-200 focus-visible:ring-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    handleAddNote();
                                }
                            }}
                        />
                        <div className="flex justify-end">
                            <Button size="sm" className="h-7 text-xs" onClick={handleAddNote} disabled={!noteInput.trim()}>
                                Add Note
                            </Button>
                        </div>
                    </div>

                    {/* Highlights List */}
                    <div className="space-y-4">
                        {Array.from(highlightsByPage.entries()).map(([page, pageHighlights]) => (
                            <div key={page} className="space-y-2">
                                <div
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 rounded cursor-pointer select-none group"
                                    onClick={() => togglePage(page)}
                                >
                                    {expandedPages.has(page) ? (
                                        <ChevronDown className="w-3 h-3 text-zinc-400" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3 text-zinc-400" />
                                    )}
                                    <span className="text-xs font-semibold text-zinc-600">Page {page}</span>
                                    <div className="flex-1 h-[1px] bg-zinc-100 group-hover:bg-zinc-200 transition-colors" />
                                    <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                                        {pageHighlights.length}
                                    </span>
                                </div>

                                {expandedPages.has(page) && (
                                    <div className="space-y-3 pl-3 border-l-2 border-zinc-100 ml-2.5">
                                        {pageHighlights.map((highlight) => (
                                            <div
                                                key={highlight.id}
                                                className={cn(
                                                    "group relative bg-white border border-zinc-200 rounded-lg p-3 shadow-sm hover:border-zinc-300 transition-all",
                                                    highlight.position?.page === currentPage && "ring-1 ring-primary/20 border-primary/30"
                                                )}
                                                onClick={() => onNavigateToPage(highlight.position?.page || 1)}
                                            >
                                                {/* Highlight Content or "Page Note" label */}
                                                {highlight.content ? (
                                                    <div className="mb-2 relative">
                                                        <div
                                                            className="absolute left-[-16px] top-1 w-1 h-4 rounded-r-md"
                                                            style={{ backgroundColor: highlight.color || '#fde047' }}
                                                        />
                                                        <p className="text-xs leading-relaxed text-zinc-800 font-serif border-l-2 border-transparent pl-0.5">
                                                            {highlight.content}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-blue-600">
                                                        <Bookmark className="w-3 h-3" />
                                                        Page Note
                                                    </div>
                                                )}

                                                {/* Note/Annotation */}
                                                {editingId === highlight.id ? (
                                                    <div className="mt-2 space-y-2">
                                                        <Textarea
                                                            value={editNoteContent}
                                                            onChange={(e) => setEditNoteContent(e.target.value)}
                                                            className="text-xs min-h-[60px]"
                                                            autoFocus
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                                                            <Button size="sm" className="h-6 text-xs" onClick={saveEditing}>Save</Button>
                                                        </div>
                                                    </div>
                                                ) : highlight.note ? (
                                                    <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 p-2 rounded border border-zinc-100">
                                                        {highlight.note}
                                                    </div>
                                                ) : null}

                                                {/* Actions */}
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[10px] text-zinc-300">
                                                        {format(highlight.createdAt, 'MMM d, HH:mm')}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-zinc-400 hover:text-zinc-700"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                startEditing(highlight);
                                                            }}
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-zinc-400 hover:text-red-600"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteHighlight(highlight.id);
                                                            }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {highlights.length === 0 && (
                            <div className="text-center py-10 text-zinc-400">
                                <p className="text-xs">No highlights or notes yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

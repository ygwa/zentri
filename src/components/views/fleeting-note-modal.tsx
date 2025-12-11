import { useState, useEffect, useRef, useCallback } from "react";
import { X, Trash2, StickyNote, Plus, MoveRight } from "lucide-react";
import { useAppStore } from "@/store";
import { Badge } from "@/components/ui/badge-new";
import { ZentriEditor } from "@/components/editor";
import type { JSONContent, Editor } from "@tiptap/core";
import { getContentPreview } from "@/lib/content-preview";

interface FleetingNoteModalProps {
    cardId: string;
    onClose: () => void;
    onDelete: (id: string) => void;
    onConvertToPermanent: (id: string) => void;
}

// Helper: Normalize content to JSONContent
function normalizeContent(content: any): JSONContent | null {
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

export function FleetingNoteModal({ cardId, onClose, onDelete, onConvertToPermanent }: FleetingNoteModalProps) {
    const { getCardById, updateCard, deleteCard, cards } = useAppStore();
    const card = getCardById(cardId);

    // Editor State
    const [editorContent, setEditorContent] = useState<JSONContent | null>(null);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

    // Tag State
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const tagInputRef = useRef<HTMLInputElement>(null);

    // Initialize content
    useEffect(() => {
        if (card) {
            setEditorContent(normalizeContent(card.content));
            setTags(card.tags || []);
        }
    }, [card]);

    // Focus editor on load (handled by ZentriEditor autofocus if possible, but we can also do it via instance)
    useEffect(() => {
        if (editorInstance) {
            editorInstance.commands.focus('end');
        }
    }, [editorInstance]);

    const handleSave = async () => {
        if (!card) return;

        try {
            // If we have an editor instance, get current JSON, otherwise use state
            // Default to empty doc if content is null to prevent overwriting with null
            const contentToSave = (editorInstance ? editorInstance.getJSON() : editorContent) || { type: 'doc', content: [{ type: 'paragraph' }] };

            console.log("Saving Fleeting Note:", { id: card.id, content: contentToSave, tags });

            await updateCard(card.id, {
                content: contentToSave as any,
                tags: tags,
            });
            onClose();
        } catch (err) {
            console.error("Failed to save:", err);
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this note?")) {
            await deleteCard(cardId);
            onDelete(cardId);
            onClose();
        }
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleSave();
        }
    };

    // Prepare autocomplete cards
    const cardsForAutocomplete = cards
        .filter(c => c.type === 'permanent' || c.type === 'literature')
        .map(c => ({
            id: c.id,
            title: c.title || 'Untitled',
            preview: getContentPreview(c.content, 50),
        }));

    // Handle create card from autocomplete
    const handleCreateCard = useCallback(async (title: string) => {
        // This functionality might be limited in modal, but we can support it
        try {
            const newCard = await useAppStore.getState().createCard('permanent', title);
            return { id: newCard.id, title: newCard.title };
        } catch (err) {
            console.error("Failed to create card via modal:", err);
            return null;
        }
    }, []);

    if (!card) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={handleSave}>
            <div
                className="bg-[#fcfcfc] w-full max-w-lg rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col transition-all transform scale-100 max-h-[80vh]"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="h-10 bg-[#f4f4f5] border-b border-zinc-200 flex items-center justify-between px-4 shrink-0 drag-handle">
                    <div className="flex items-center gap-2">
                        <StickyNote size={14} className="text-zinc-500" />
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Fleeting Note</span>
                        <div className="h-3 w-[1px] bg-zinc-300 mx-1"></div>
                        <span className="text-[10px] font-mono text-zinc-400">{card.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge color="gray">FLEETING</Badge>
                        <button
                            onClick={handleSave}
                            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-200 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-0 flex-1 flex flex-col relative bg-white min-h-[200px] overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 cursor-text" onClick={() => editorInstance?.commands.focus()}>
                        <ZentriEditor
                            key={cardId} // Re-mount if cardId changes
                            content={editorContent}
                            onChange={setEditorContent}
                            cards={cardsForAutocomplete}
                            onCreateCard={handleCreateCard}
                            placeholder="What's on your mind?..."
                            className="font-serif text-[15px] leading-relaxed text-zinc-700 min-h-[150px] outline-none"
                            onEditorReady={setEditorInstance}
                        />
                    </div>

                    {/* Tags Bar */}
                    <div className="px-4 py-3 bg-white border-t border-zinc-100 flex items-center gap-2 flex-wrap shrink-0">
                        {tags.map(t => (
                            <span key={t} className="flex items-center text-[10px] bg-zinc-50 border border-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded-sm group">
                                #{t}
                                <button onClick={() => handleRemoveTag(t)} className="ml-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={8} />
                                </button>
                            </span>
                        ))}
                        <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-sm px-1.5 py-0.5 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 transition-all">
                            <Plus size={8} className="text-zinc-400" />
                            <input
                                ref={tagInputRef}
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddTag();
                                    if (e.key === 'Backspace' && !tagInput) {
                                        setTags(prev => prev.slice(0, -1));
                                    }
                                }}
                                className="bg-transparent border-none outline-none text-[10px] w-20 text-zinc-600 placeholder-zinc-400"
                                placeholder="Add tag..."
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-[#f8f9fa] border-t border-zinc-200 p-2 flex justify-between items-center shrink-0">
                    <button
                        onClick={handleDelete}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                        title="Delete Note"
                    >
                        <Trash2 size={14} />
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-400 font-mono hidden sm:inline-block">Cmd+Enter to save</span>
                        <button
                            onClick={() => onConvertToPermanent(cardId)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-sm shadow-sm transition-all active:translate-y-px"
                        >
                            <span>Convert</span>
                            <MoveRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Trash2, StickyNote, Plus, MoveRight, AlertCircle, Edit2, Archive } from "lucide-react";
import { useAppStore } from "@/store";
import { Badge } from "@/components/ui/badge-new";
import { ZentriEditor } from "@/components/editor";
import { cn } from "@/lib/utils";
import type { JSONContent, Editor } from "@tiptap/core";
import { getContentPreview, hasCardContent } from "@/lib/content-preview";

interface FleetingNoteModalProps {
    cardId: string;
    onClose: () => void;
    onDelete: (id: string) => void;
    onConvertToPermanent: (id: string) => void;
    onOpenPermanentNote?: (id: string) => void;
}

import { preprocessContent } from "@/lib/content-transformer";

// Helper: Normalize content to JSONContent
function normalizeContent(content: any): JSONContent | null {
    if (!content) return null;
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            return preprocessContent(parsed) as JSONContent;
        } catch {
            return preprocessContent({
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
            }) as JSONContent;
        }
    }
    return preprocessContent(content as JSONContent) as JSONContent;
}

export function FleetingNoteModal({ cardId, onClose, onDelete, onConvertToPermanent, onOpenPermanentNote }: FleetingNoteModalProps) {
    const { getCardById, updateCard, deleteCard, createCard, loadCardContent, cards } = useAppStore();
    const card = getCardById(cardId);

    // Editor State
    const [editorContent, setEditorContent] = useState<JSONContent | null>(null);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const [hasContent, setHasContent] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // 默认只读模式

    // Tag State
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const tagInputRef = useRef<HTMLInputElement>(null);
    
    // 检查是否已归档
    const isArchived = tags.includes('archived');

    // Initialize content
    useEffect(() => {
        if (card) {
            setEditorContent(normalizeContent(card.content));
            setTags(card.tags || []);
            setHasContent(hasCardContent(card.content));
        }
    }, [card]);

    // 监听内容变化，更新 hasContent 状态
    useEffect(() => {
        if (editorInstance) {
            const handleUpdate = () => {
                const currentContent = editorInstance.getJSON();
                setHasContent(hasCardContent(currentContent as any));
            };
            
            editorInstance.on('update', handleUpdate);
            return () => {
                editorInstance.off('update', handleUpdate);
            };
        }
    }, [editorInstance]);

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

            // 更新 hasContent 状态
            setHasContent(hasCardContent(contentToSave as any));

            await updateCard(card.id, {
                content: contentToSave as any,
                tags: tags,
            });
            
            // 保存后退出编辑模式
            setIsEditing(false);
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
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isEditing) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (isEditing) {
                handleSave();
            } else {
                onClose();
            }
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

    // 处理转换到永久笔记
    const handleConvert = async () => {
        if (!hasContent) {
            alert("请先添加内容描述，然后才能转换为永久笔记。");
            return;
        }
        if (!card) return;

        try {
            // 1. 创建新的永久笔记，标题使用原卡片的标题
            const permanentCard = await createCard('permanent', card.title || 'Untitled');
            
            // 2. 在永久笔记中添加对原卡片的引用（wiki link）
            // 使用文本格式 [[title]]，preprocessContent 会自动转换为 wiki link 节点
            // 编辑器会根据 cards 选项来解析正确的 href
            const linkText = `[[${card.title || 'Untitled'}]]`;
            const wikiLinkContent = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: linkText
                            }
                        ]
                    },
                    {
                        type: 'paragraph'
                    }
                ]
            };
            
            await updateCard(permanentCard.id, {
                content: wikiLinkContent as any,
                links: [card.id] // 添加链接关系
            });
            
            // 等待内容加载完成，确保编辑器能正确显示
            await loadCardContent(permanentCard.id);
            
            // 3. 标记原卡片为已归档
            const updatedTags = tags.includes('archived') ? tags : [...tags, 'archived'];
            await updateCard(card.id, {
                tags: updatedTags
            });
            
            // 4. 关闭当前模态框
            onClose();
            
            // 5. 打开新创建的永久笔记编辑器（使用 setTimeout 确保状态已更新）
            setTimeout(() => {
                if (onOpenPermanentNote) {
                    onOpenPermanentNote(permanentCard.id);
                } else {
                    // 如果没有提供回调，调用原来的转换函数
                    onConvertToPermanent(permanentCard.id);
                }
            }, 100);
        } catch (err) {
            console.error("Failed to convert to permanent note:", err);
            alert("转换失败，请重试");
        }
    };

    if (!card) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" 
            onClick={isEditing ? handleSave : onClose}
        >
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
                        {isArchived && (
                            <Badge color="blue">ARCHIVED</Badge>
                        )}
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-sm hover:bg-zinc-200 transition-colors"
                                title="编辑"
                            >
                                <Edit2 size={14} />
                            </button>
                        )}
                        <button
                            onClick={isEditing ? handleSave : onClose}
                            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-200 transition-colors"
                            title={isEditing ? "保存并关闭" : "关闭"}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-0 flex-1 flex flex-col relative bg-white min-h-[200px] overflow-hidden">
                    {/* 提示信息：如果没有内容 */}
                    {!hasContent && (
                        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-2">
                            <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-medium text-amber-800 mb-1">添加描述</p>
                                <p className="text-[11px] text-amber-700">
                                    {card?.tags?.includes('question') 
                                        ? '请添加问题的调研结果和思考...'
                                        : card?.tags?.includes('highlight')
                                        ? '请添加书摘的总结和思考...'
                                        : '请添加你的想法和思考...'}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-4" onClick={() => isEditing && editorInstance?.commands.focus()}>
                        <ZentriEditor
                            key={cardId} // Re-mount if cardId changes
                            content={editorContent}
                            editable={isEditing}
                            onChange={(content) => {
                                if (isEditing) {
                                    setEditorContent(content);
                                    // 实时更新 hasContent 状态
                                    setHasContent(hasCardContent(content as any));
                                }
                            }}
                            cards={cardsForAutocomplete}
                            onCreateCard={handleCreateCard}
                            placeholder={
                                card?.tags?.includes('question')
                                    ? "记录问题的调研结果和思考..."
                                    : card?.tags?.includes('highlight')
                                    ? "记录书摘的总结和思考..."
                                    : "记录你的想法和思考..."
                            }
                            className={cn(
                                "font-serif text-[15px] leading-relaxed text-zinc-700 min-h-[150px] outline-none",
                                !isEditing && "cursor-default"
                            )}
                            onEditorReady={setEditorInstance}
                        />
                    </div>

                    {/* Tags Bar - 只在编辑模式下显示 */}
                    {isEditing && (
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
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-[#f8f9fa] border-t border-zinc-200 p-2 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        {isEditing && (
                            <button
                                onClick={handleDelete}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                                title="Delete Note"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        {isEditing && (
                            <span className="text-[9px] text-zinc-400 font-mono hidden sm:inline-block">Cmd+Enter to save</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-700 text-white text-xs font-bold rounded-sm shadow-sm transition-all"
                            >
                                <Edit2 size={12} />
                                <span>编辑</span>
                            </button>
                        )}
                        {isEditing && (
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-700 text-white text-xs font-bold rounded-sm shadow-sm transition-all"
                            >
                                <span>保存</span>
                            </button>
                        )}
                        <button
                            onClick={handleConvert}
                            disabled={!hasContent}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 text-white text-xs font-bold rounded-sm shadow-sm transition-all active:translate-y-px",
                                hasContent
                                    ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                    : "bg-zinc-300 cursor-not-allowed opacity-50"
                            )}
                            title={!hasContent ? "请先添加内容描述才能转换" : "创建永久笔记并引用此卡片"}
                        >
                            <Archive size={12} />
                            <span>归档并创建永久笔记</span>
                            <MoveRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

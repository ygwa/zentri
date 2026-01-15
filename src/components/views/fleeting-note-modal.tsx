import { useState, useEffect, useRef, useCallback } from "react";
import { X, Trash2, Plus, MoveRight, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store";
import { ZentriEditor } from "@/components/editor";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import type { JSONContent, Editor } from "@tiptap/core";
import { getContentPreview, hasCardContent } from "@/lib/content-preview";
import { preprocessContent } from "@/lib/content-transformer";

interface FleetingNoteModalProps {
    cardId: string;
    onClose: () => void;
    onDelete: (id: string) => void;
    onConvertToPermanent: (id: string) => void;
    onOpenPermanentNote?: (id: string) => void;
}

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
    const { getCardById, updateCard, deleteCard, createCard, cards } = useAppStore();
    const card = getCardById(cardId);

    // Editor State
    const [editorContent, setEditorContent] = useState<JSONContent | null>(null);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const [hasContent, setHasContent] = useState(false);

    // Title State with debounce
    const [localTitle, setLocalTitle] = useState(card?.title || 'Untitled');
    const debouncedTitle = useDebounce(localTitle, 800);
    const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingTitleRef = useRef(false);
    const lastSavedTitleRef = useRef<string>(card?.title || '');

    // Content auto-save
    const contentSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');

    // Tag State
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const tagInputRef = useRef<HTMLInputElement>(null);

    // Initialize content and title
    // 内容已经在 store 中加载完成，直接使用
    useEffect(() => {
        if (card) {
            setEditorContent(normalizeContent(card.content));
            setTags(card.tags || []);
            setHasContent(hasCardContent(card.content));
            setLocalTitle(card.title || 'Untitled');
            lastSavedTitleRef.current = card.title || '';
        }
    }, [cardId, card]); // 当 cardId 或 card 变化时更新

    // 防抖保存标题
    useEffect(() => {
        if (!card) return;

        // 如果标题没有变化，不保存
        if (debouncedTitle === lastSavedTitleRef.current) {
            return;
        }

        if (titleSaveTimeoutRef.current) {
            clearTimeout(titleSaveTimeoutRef.current);
        }

        isSavingTitleRef.current = true;
        titleSaveTimeoutRef.current = setTimeout(() => {
            const titleToSave = debouncedTitle || 'Untitled';
            updateCard(card.id, { title: titleToSave }).then(() => {
                lastSavedTitleRef.current = titleToSave;
                isSavingTitleRef.current = false;
            }).catch(() => {
                isSavingTitleRef.current = false;
            });
        }, 300);

        return () => {
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
        };
    }, [debouncedTitle, card?.id, updateCard]);

    // 监听内容变化，更新 hasContent 状态并自动保存
    useEffect(() => {
        if (editorInstance) {
            const handleUpdate = () => {
                // 安全检查编辑器是否仍然可用
                if (!editorInstance || editorInstance.isDestroyed) return;

                try {
                    const currentContent = editorInstance.getJSON();
                    const contentHasValue = hasCardContent(currentContent as any);
                    setHasContent(contentHasValue);

                    // 只有当内容非空时才自动保存内容（防抖）
                    if (!card) return;

                    // 如果内容为空，不保存
                    if (!contentHasValue) {
                        return;
                    }

                    const contentStr = JSON.stringify(currentContent);

                    if (contentStr === lastSavedContentRef.current) {
                        return;
                    }

                    if (contentSaveTimeoutRef.current) {
                        clearTimeout(contentSaveTimeoutRef.current);
                    }

                    contentSaveTimeoutRef.current = setTimeout(() => {
                        updateCard(card.id, { content: currentContent as any });
                        lastSavedContentRef.current = contentStr;
                    }, 500);
                } catch (err) {
                    // 静默失败，编辑器可能已销毁
                }
            };

            editorInstance.on('update', handleUpdate);
            return () => {
                editorInstance.off('update', handleUpdate);
                if (contentSaveTimeoutRef.current) {
                    clearTimeout(contentSaveTimeoutRef.current);
                }
            };
        }
    }, [editorInstance, card, updateCard]);

    // Focus editor on load - with safe retry
    useEffect(() => {
        if (!editorInstance) return;

        let mounted = true;
        let retryCount = 0;
        const maxRetries = 10;

        const tryFocus = () => {
            if (!mounted || retryCount >= maxRetries) return;

            try {
                // 安全检查：编辑器是否已销毁
                if (!editorInstance || editorInstance.isDestroyed) return;

                // 安全检查：view 是否存在
                if (!editorInstance.view?.dom) {
                    retryCount++;
                    requestAnimationFrame(tryFocus);
                    return;
                }

                editorInstance.commands.focus('end');
            } catch (err) {
                // 如果出错，重试
                retryCount++;
                if (retryCount < maxRetries) {
                    requestAnimationFrame(tryFocus);
                }
            }
        };

        // 延迟启动，给编辑器时间初始化
        const timer = setTimeout(() => {
            tryFocus();
        }, 100);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [editorInstance]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
            if (contentSaveTimeoutRef.current) {
                clearTimeout(contentSaveTimeoutRef.current);
            }
        };
    }, []);

    // 处理标题变更 - 立即更新本地状态，防抖保存
    const handleTitleChange = useCallback((newTitle: string) => {
        setLocalTitle(newTitle);
    }, []);

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this note?")) {
            await deleteCard(cardId);
            onDelete(cardId);
            onClose();
        }
    };

    const handleAddTag = async () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            const newTags = [...tags, tagInput.trim()];
            setTags(newTags);
            setTagInput('');
            // 立即保存标签
            if (card) {
                await updateCard(card.id, { tags: newTags });
            }
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        const newTags = tags.filter(t => t !== tagToRemove);
        setTags(newTags);
        // 立即保存标签
        if (card) {
            await updateCard(card.id, { tags: newTags });
        }
    };

    // 确保保存所有未保存的内容
    const ensureSave = useCallback(async () => {
        if (!card) return;

        try {
            // 清除所有防抖定时器，立即保存
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
                titleSaveTimeoutRef.current = null;
            }
            if (contentSaveTimeoutRef.current) {
                clearTimeout(contentSaveTimeoutRef.current);
                contentSaveTimeoutRef.current = null;
            }

            // 保存标题（如果还未保存）
            const currentTitle = localTitle || card.title || 'Untitled';
            if (currentTitle !== lastSavedTitleRef.current) {
                await updateCard(card.id, { title: currentTitle });
                lastSavedTitleRef.current = currentTitle;
            }

            // 保存内容（如果还未保存）
            const currentContent = editorInstance ? editorInstance.getJSON() : editorContent;
            if (currentContent) {
                const contentStr = JSON.stringify(currentContent);
                if (contentStr !== lastSavedContentRef.current) {
                    await updateCard(card.id, { content: currentContent as any });
                    lastSavedContentRef.current = contentStr;
                }
            }

            // 保存标签（如果还未保存）
            const currentTags = tags;
            const cardTags = card.tags || [];
            if (JSON.stringify(currentTags.sort()) !== JSON.stringify(cardTags.sort())) {
                await updateCard(card.id, { tags: currentTags });
            }
        } catch (err) {
            console.error("Failed to save on close:", err);
        }
    }, [card, localTitle, editorInstance, editorContent, tags, updateCard]);

    // 处理保存并关闭
    const handleSaveAndClose = useCallback(async () => {
        await ensureSave();
        onClose();
    }, [ensureSave, onClose]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Cmd/Ctrl + Enter: 保存并关闭
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSaveAndClose();
            return;
        }
        
        // Escape: 关闭（会自动保存）
        if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
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
            // 1. 确保保存当前标题和内容
            const currentContent = editorInstance ? editorInstance.getJSON() : editorContent;
            const currentTitle = localTitle || card.title || 'Untitled';

            // 立即保存标题（如果还未保存）
            if (currentTitle !== lastSavedTitleRef.current) {
                await updateCard(card.id, { title: currentTitle });
            }

            // 立即保存内容（如果还未保存）
            const contentStr = JSON.stringify(currentContent);
            if (contentStr !== lastSavedContentRef.current) {
                await updateCard(card.id, { content: currentContent as any, tags: tags });
            }

            // 2. 创建新的永久笔记，标题使用当前标题
            const permanentCard = await createCard('permanent', currentTitle);

            // 3. 将原卡片的内容复制到永久笔记中
            await updateCard(permanentCard.id, {
                content: currentContent as any,
                tags: tags.filter(t => t !== 'idea' && t !== 'question' && t !== 'highlight'), // 保留其他标签，移除 inbox 类型标签
                links: [] // 初始为空，用户可以在编辑时添加链接
            });

            // 内容已经通过 updateCard 保存，store 会自动更新

            // 4. 删除原 fleeting 卡片
            await deleteCard(card.id);

            // 5. 关闭当前模态框
            onClose();

            // 6. 打开新创建的永久笔记编辑器（使用 setTimeout 确保状态已更新）
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

    // 处理关闭：如果卡片没有标题且没有内容，则删除该卡片；否则保存
    const handleClose = useCallback(async () => {
        if (!card) {
            onClose();
            return;
        }

        // 检查卡片是否为空：无标题（或默认标题）且无内容
        const titleIsEmpty = !localTitle || localTitle === 'Untitled' || localTitle.trim() === '';
        const contentIsEmpty = !hasContent;

        if (titleIsEmpty && contentIsEmpty) {
            // 卡片为空，删除它
            try {
                await deleteCard(card.id);
                console.log("Deleted empty card:", card.id);
            } catch (err) {
                console.warn("Failed to delete empty card:", err);
            }
        } else {
            // 卡片有内容，确保保存
            await ensureSave();
        }

        onClose();
    }, [card, localTitle, hasContent, deleteCard, onClose, ensureSave]);

    // 全局键盘快捷键监听（支持编辑器聚焦时）
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + Enter: 保存并关闭
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSaveAndClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleSaveAndClose]);

    // 如果卡片还没有加载，显示加载状态
    if (!card) {
        return (
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose();
                    }
                }}
            >
                <div className="bg-[#fcfcfc] w-full max-w-lg rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col p-8">
                    <div className="text-zinc-400 text-sm text-center">加载中...</div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => {
                // 只在点击背景时关闭
                if (e.target === e.currentTarget) {
                    handleClose();
                }
            }}
        >
            <div
                className="bg-white w-full max-w-2xl rounded-lg shadow-xl border border-zinc-200/50 overflow-hidden flex flex-col transition-all transform scale-100"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Spotlight-style Header - 扁平化 */}
                <div className="px-4 py-2 border-b border-zinc-100 flex items-center justify-between shrink-0">
                    <span className="text-xs font-medium text-zinc-500">快速笔记</span>
                    <button
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-zinc-600 p-1 rounded-sm hover:bg-zinc-100 transition-colors"
                        title="关闭 (Esc)"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Content - Spotlight风格，扁平化 */}
                <div className="p-0 flex-1 flex flex-col relative bg-white overflow-hidden">
                    {/* 标题编辑 - 扁平化 */}
                    <div className="px-4 pt-3 pb-2 shrink-0">
                        <input
                            value={localTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="w-full text-lg font-medium text-zinc-900 placeholder-zinc-400 border-none focus:ring-0 p-0 bg-transparent"
                            placeholder="输入标题..."
                        />
                    </div>

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
                    <div className="flex-1 overflow-y-auto px-4 pb-3" onClick={() => editorInstance?.commands.focus()}>
                        <ZentriEditor
                            key={cardId} // Re-mount if cardId changes
                            content={editorContent}
                            editable={true}
                            onChange={(content) => {
                                setEditorContent(content);
                                // 实时更新 hasContent 状态
                                setHasContent(hasCardContent(content as any));
                            }}
                            cards={cardsForAutocomplete}
                            onCreateCard={handleCreateCard}
                            placeholder={
                                card?.tags?.includes('question')
                                    ? "记录问题的调研结果和思考... (⌘Enter 保存)"
                                    : card?.tags?.includes('highlight')
                                        ? "记录书摘的总结和思考... (⌘Enter 保存)"
                                        : "记录你的想法和思考... (⌘Enter 保存)"
                            }
                            className="text-[15px] leading-relaxed text-zinc-700 min-h-[200px] outline-none"
                            onEditorReady={setEditorInstance}
                        />
                    </div>

                    {/* Tags Bar - 扁平化 */}
                    <div className="px-4 py-2 border-t border-zinc-100 flex items-center gap-2 flex-wrap shrink-0">
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

                {/* Footer Actions - Spotlight风格，去掉保存按钮 */}
                <div className="px-4 py-2 border-t border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDelete}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                            title="删除笔记"
                        >
                            <Trash2 size={14} />
                        </button>
                        <span className="text-[10px] text-zinc-500">⌘Enter 保存并关闭</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 转换为永久笔记按钮 */}
                        <button
                            onClick={handleConvert}
                            disabled={!hasContent}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                                hasContent
                                    ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                                    : "text-zinc-400 cursor-not-allowed opacity-50"
                            )}
                            title={!hasContent ? "请先添加内容描述才能转换" : "转换为永久笔记"}
                        >
                            <MoveRight size={12} />
                            <span className="hidden sm:inline">转换</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

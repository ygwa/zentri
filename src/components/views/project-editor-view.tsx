import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, Activity, Printer, Database, Search, Filter, Link as LinkIcon, Copy } from "lucide-react";
import { useAppStore } from "@/store";
import { TiptapToolbar } from "@/components/ui/tiptap-toolbar";
import { ZentriEditor } from "@/components/editor";
import { getContentPreview } from "@/lib/content-preview";
import { useDebounce } from "@/hooks/use-debounce";
import { FleetingNoteModal } from "@/components/views/fleeting-note-modal";
import { RenameCardDialog } from "@/components/rename-card-dialog";
import { FindDialog } from "@/components/find-dialog";
import type { Card } from "@/types";
import type { JSONContent, Editor } from "@tiptap/core";

interface ProjectEditorViewProps {
    projectId: string;
    onClose: () => void;
}

export function ProjectEditorView({ projectId, onClose }: ProjectEditorViewProps) {
    const { getCardById, cards, updateCard, createCard } = useAppStore();
    const project = getCardById(projectId);
    const [searchQuery, setSearchQuery] = useState('');
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const [fleetingNoteId, setFleetingNoteId] = useState<string | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [findDialogOpen, setFindDialogOpen] = useState(false);
    const [findReplaceMode, setFindReplaceMode] = useState(false);
    
    // 本地标题状态，用于立即更新 UI
    const [localTitle, setLocalTitle] = useState(project?.title || 'Untitled Project');
    const debouncedTitle = useDebounce(localTitle, 800);
    const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);
    const lastSavedTitleRef = useRef<string>(project?.title || '');

    if (!project || project.type !== 'project') return null;
    
    // 监听菜单事件：打开重命名对话框和查找对话框
    useEffect(() => {
        const handleOpenRenameCardDialog = (e: Event) => {
            const customEvent = e as CustomEvent;
            const eventCardId = customEvent.detail?.cardId;
            // 如果事件中的 cardId 与当前 projectId 匹配，或者没有指定 cardId，则打开对话框
            if (!eventCardId || eventCardId === projectId) {
                setRenameDialogOpen(true);
            }
        };

        const handleOpenFindDialog = () => {
            setFindReplaceMode(false);
            setFindDialogOpen(true);
        };

        const handleOpenFindReplaceDialog = () => {
            setFindReplaceMode(true);
            setFindDialogOpen(true);
        };

        window.addEventListener('openRenameCardDialog', handleOpenRenameCardDialog);
        window.addEventListener('openFindDialog', handleOpenFindDialog);
        window.addEventListener('openFindReplaceDialog', handleOpenFindReplaceDialog);

        return () => {
            window.removeEventListener('openRenameCardDialog', handleOpenRenameCardDialog);
            window.removeEventListener('openFindDialog', handleOpenFindDialog);
            window.removeEventListener('openFindReplaceDialog', handleOpenFindReplaceDialog);
        };
    }, [projectId]);
    
    // 只在组件挂载或 projectId 改变时同步外部标题
    useEffect(() => {
        if (project.title !== lastSavedTitleRef.current && !isSavingRef.current) {
            setLocalTitle(project.title || 'Untitled Project');
            lastSavedTitleRef.current = project.title || '';
        }
    }, [projectId]); // 只依赖 projectId，避免循环更新
    
    // 防抖保存标题
    useEffect(() => {
        // 如果标题没有变化，不保存
        if (debouncedTitle === lastSavedTitleRef.current) {
            return;
        }
        
        if (titleSaveTimeoutRef.current) {
            clearTimeout(titleSaveTimeoutRef.current);
        }
        
        isSavingRef.current = true;
        titleSaveTimeoutRef.current = setTimeout(() => {
            const titleToSave = debouncedTitle || 'Untitled Project';
            updateCard(project.id, { title: titleToSave }).then(() => {
                lastSavedTitleRef.current = titleToSave;
                isSavingRef.current = false;
            }).catch(() => {
                isSavingRef.current = false;
            });
        }, 300);
        
        return () => {
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
        };
    }, [debouncedTitle, project.id, updateCard]);

    // 将 EditorContent 转换为 JSONContent
    const normalizeContent = useCallback((content: any): JSONContent | null => {
        if (!content) return null;
        if (typeof content === 'string') {
            try {
                const parsed = JSON.parse(content);
                return parsed as JSONContent;
            } catch {
                // 如果不是 JSON，创建简单的段落节点
                return {
                    type: "doc",
                    content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
                };
            }
        }
        return content as JSONContent;
    }, []);

    // 计算字符数（从项目卡片的内容中提取）
    const charCount = useMemo(() => {
        if (!project.content) return 0;
        const preview = getContentPreview(project.content, 10000);
        return preview.length;
    }, [project.content]);

    // 防抖保存内容
    const handleContentChange = useCallback((jsonContent: JSONContent) => {
        const contentStr = JSON.stringify(jsonContent);

        if (contentStr === lastSavedContentRef.current) {
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            updateCard(project.id, { content: jsonContent as any });
            lastSavedContentRef.current = contentStr;
        }, 500);
    }, [project.id, updateCard]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
        };
    }, []);

    // 过滤知识库卡片
    const filteredLibrary = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return cards
            .filter(c => c.type === 'permanent' || c.type === 'literature')
            .filter(c => {
                const title = c.title?.toLowerCase() || '';
                const preview = getContentPreview(c.content, 200).toLowerCase();
                const id = c.id.toLowerCase();
                return title.includes(q) || preview.includes(q) || id.includes(q);
            });
    }, [cards, searchQuery]);

    // 插入引用链接（在编辑器中插入 wiki link）
    const handleInsertRef = useCallback((card: Card) => {
        if (!editorInstance) return;

        const text = `[[${card.title || card.id}]]`;
        editorInstance.chain().focus().insertContent(text).run();
        // 应用 wikiLink mark
        setTimeout(() => {
            const pos = editorInstance.state.selection.$from.pos;
            const from = pos - text.length;
            const to = pos;
            editorInstance
                .chain()
                .setTextSelection({ from, to })
                .setWikiLink({ href: card.id, title: card.title || card.id })
                .setTextSelection(to)
                .run();
        }, 0);
    }, [editorInstance]);

    // 嵌入内容（在编辑器中插入引用块）
    const handleInsertContent = useCallback((card: Card) => {
        if (!editorInstance) return;

        const preview = getContentPreview(card.content, 200);
        const blockquoteContent = {
            type: "blockquote",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: preview }]
                }
            ]
        };
        editorInstance.chain().focus().insertContent(blockquoteContent).insertContent({ type: "paragraph" }).run();
    }, [editorInstance]);

    // 准备卡片列表用于自动补全
    const cardsForAutocomplete = useMemo(() => {
        return cards
            .filter(c => c.type === 'permanent' || c.type === 'literature')
            .map(c => ({
                id: c.id,
                title: c.title || 'Untitled',
                preview: getContentPreview(c.content, 50),
            }));
    }, [cards]);

    // 处理创建新卡片（创建为闪念笔记）
    const handleCreateCard = useCallback(async (title: string) => {
        try {
            // Link this new card back to the project
            const newCard = await createCard('fleeting', title, project.id);
            return { id: newCard.id, title: newCard.title };
        } catch (err) {
            console.error("Failed to create card:", err);
            return null;
        }
    }, [createCard, project?.id]);

    // 处理闪念笔记创建后的回调
    const handleFleetingNoteCreated = useCallback((cardId: string) => {
        setFleetingNoteId(cardId);
    }, []);

    // 从选中文字创建闪念笔记
    const handleCreateFleetingNote = useCallback(async (content: JSONContent) => {
        try {
            // 从内容中提取文本作为标题（取前50个字符）
            const textContent = getContentPreview(content as any);
            const title = textContent.slice(0, 50).trim() || 'Quick Note';
            
            // 创建闪念笔记卡片，关联到当前项目
            const newCard = await createCard('fleeting', title, project.id);
            
            // 将选中的内容包装在 blockquote（引用）中
            // 确保 content 有内容，如果没有则创建一个空段落
            const selectedContent = content.content && content.content.length > 0 
                ? content.content 
                : [{ type: "paragraph" }];
            
            const quotedContent: JSONContent = {
                type: "doc",
                content: [
                    {
                        type: "blockquote",
                        content: selectedContent,
                    },
                    {
                        type: "paragraph", // 添加空行，方便用户继续编辑
                    },
                ],
            };
            
            // 设置卡片内容
            await updateCard(newCard.id, { content: quotedContent as any });
            
            // 在项目卡片中添加链接到新创建的闪念笔记
            const currentLinks = project.links || [];
            if (!currentLinks.includes(newCard.id)) {
                await updateCard(project.id, { 
                    links: [...currentLinks, newCard.id] 
                });
            }
            
            // 在新创建的闪念笔记中添加反向链接到项目卡片
            const newCardLinks = newCard.links || [];
            if (!newCardLinks.includes(project.id)) {
                await updateCard(newCard.id, { 
                    links: [...newCardLinks, project.id] 
                });
            }
            
            // 打开闪念笔记弹窗
            setFleetingNoteId(newCard.id);
        } catch (err) {
            console.error("Failed to create fleeting note from selection:", err);
        }
    }, [createCard, updateCard, project]);

    // 处理标题变更 - 立即更新本地状态，防抖保存
    const handleTitleChange = useCallback((newTitle: string) => {
        setLocalTitle(newTitle);
    }, []);

    // 处理链接点击
    const handleLinkClick = useCallback((id: string) => {
        useAppStore.getState().selectCard(id);
        onClose();
    }, [onClose]);

    return (
        <div className="absolute inset-0 bg-[#f4f4f5] z-30 flex flex-col animate-in slide-in-from-bottom-2 duration-150">
            {/* Toolbar */}
            <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4 bg-white shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="hover:bg-zinc-100 p-1.5 rounded-sm text-zinc-500 flex items-center gap-1 transition-colors"
                    >
                        <ChevronLeft size={16} /> <span className="text-xs font-bold uppercase">Back</span>
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-300"></div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">{localTitle || 'Untitled Project'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-2">
                            <span>Drafting</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                            <span>Auto-saved</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-sm">
                        <Activity size={12} className="text-zinc-400" />
                        <span className="text-[10px] font-mono text-zinc-600">{charCount.toLocaleString()} chars</span>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium">
                        <Printer size={12} /> <span className="font-mono text-[9px] uppercase">Export</span>
                    </button>
                </div>
            </div>

            {/* Main Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Writing Area */}
                <div className="flex-1 flex flex-col bg-[#f0f0f2] border-r border-zinc-200 overflow-hidden relative min-w-0">
                    <div className="flex-1 overflow-y-auto scroll-smooth flex flex-col relative">
                        {/* 背景网格纹理 - 确保背景能够扩展到整个可滚动区域 */}
                        <div className="absolute top-0 left-0 right-0 bottom-0 min-h-full pointer-events-none opacity-[0.10]" 
                            style={{ 
                                backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, 
                                backgroundSize: '20px 20px' 
                            }}
                        />
                        {/* Floating Toolbar Container */}
                        <div className="relative z-20 sticky top-4 pointer-events-none flex justify-center h-10 mb-[-40px] min-w-0">
                            <div className="pointer-events-auto">
                                <TiptapToolbar editor={editorInstance} />
                            </div>
                        </div>

                        {/* Document Surface - A4 纸大小，居中显示，固定高度，内容在内部滚动 */}
                        <div className="relative z-10 max-w-[850px] min-w-[500px] w-full mx-auto my-8 bg-white shadow-sm border border-zinc-200 px-16 py-16 transition-all flex flex-col h-[calc(100vh-120px)]" style={{ marginLeft: 'max(16px, calc((100% - 850px) / 2))', marginRight: 'max(16px, calc((100% - 850px) / 2))' }}>
                            {/* Project Title */}
                            <div className="mb-8 border-b border-zinc-100 pb-4 shrink-0">
                                <input
                                    value={localTitle}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="text-3xl font-bold text-zinc-900 font-serif w-full outline-none placeholder-zinc-300 bg-transparent border-none p-0 focus:ring-0"
                                    placeholder="Untitled Project"
                                />
                            </div>

                            {/* Editor Area - 可滚动区域 */}
                            <div className="flex-1 relative min-h-0 overflow-y-auto">
                                <div className="h-full">
                                    <ZentriEditor
                                        key={projectId}
                                        content={normalizeContent(project.content)}
                                        onChange={handleContentChange}
                                        cards={cardsForAutocomplete}
                                        onCreateCard={handleCreateCard}
                                        onFleetingNoteCreated={handleFleetingNoteCreated}
                                        onCreateFleetingNote={handleCreateFleetingNote}
                                        onLinkClick={handleLinkClick}
                                        placeholder="Start writing your project..."
                                        className="font-serif text-lg leading-relaxed h-full"
                                        onEditorReady={(editor) => {
                                            setEditorInstance(editor);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Slipbox Toolkit (Right Sidebar) */}
                <div className="w-80 bg-zinc-50 flex flex-col shrink-0 border-l border-zinc-200">
                    <div className="h-10 border-b border-zinc-200 flex items-center justify-between px-3 bg-white">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <Database size={12} /> Knowledge Base
                        </h3>
                        <div className="flex gap-1">
                            <button className="p-1 hover:bg-zinc-100 rounded-sm">
                                <Filter size={12} className="text-zinc-400" />
                            </button>
                        </div>
                    </div>

                    {/* Search Box */}
                    <div className="p-2 border-b border-zinc-200 bg-white">
                        <div className="relative group">
                            <Search size={12} className="absolute left-2 top-2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Find cards to insert..."
                                className="w-full bg-zinc-50 border border-zinc-200 pl-7 pr-2 py-1.5 text-xs rounded-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-all placeholder-zinc-400"
                            />
                        </div>
                    </div>

                    {/* Cards List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-zinc-50/50">
                        {filteredLibrary.map(card => (
                            <div
                                key={card.id}
                                className="bg-white border border-zinc-200 rounded-sm p-3 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group relative"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[9px] font-mono text-zinc-400 font-bold bg-zinc-50 px-1 rounded-sm">{card.id.slice(0, 8)}</span>
                                    {/* Contextual Actions */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleInsertRef(card)}
                                            className="text-[9px] font-bold text-zinc-600 hover:text-blue-600 bg-zinc-100 hover:bg-blue-50 px-1.5 py-0.5 rounded-sm transition-colors flex items-center gap-1"
                                            title="Insert Link [[ID]]"
                                        >
                                            <LinkIcon size={8} /> Ref
                                        </button>
                                        <button
                                            onClick={() => handleInsertContent(card)}
                                            className="text-[9px] font-bold text-zinc-600 hover:text-blue-600 bg-zinc-100 hover:bg-blue-50 px-1.5 py-0.5 rounded-sm transition-colors flex items-center gap-1"
                                            title="Embed Content"
                                        >
                                            <Copy size={8} /> Embed
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="text-xs font-bold text-zinc-800 mb-1 leading-snug">{card.title || 'Untitled'}</div>
                                <div className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mb-2">
                                    {getContentPreview(card.content, 150)}
                                </div>

                                {/* Footer */}
                                <div className="flex gap-1 flex-wrap">
                                    {card.tags.slice(0, 3).map(t => (
                                        <span key={t} className="text-[8px] text-zinc-500 bg-zinc-100 border border-zinc-200 px-1 rounded-sm">#{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {filteredLibrary.length === 0 && (
                            <div className="text-center py-8 text-zinc-400 text-xs">
                                No cards found.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fleeting Note Modal */}
            {fleetingNoteId && (
                <FleetingNoteModal
                    cardId={fleetingNoteId}
                    onClose={() => setFleetingNoteId(null)}
                    onDelete={() => setFleetingNoteId(null)}
                    onConvertToPermanent={() => {
                        setFleetingNoteId(null);
                        // 可以在这里导航到永久笔记页面
                    }}
                    onOpenPermanentNote={() => {
                        setFleetingNoteId(null);
                        // 可以在这里导航到永久笔记页面
                    }}
                />
            )}

            {/* Rename Card Dialog */}
            <RenameCardDialog
                open={renameDialogOpen}
                onOpenChange={setRenameDialogOpen}
                cardId={projectId}
                onRenamed={() => {
                    // 标题已经通过 updateCard 更新，store 会自动更新
                    // 无需重新加载内容
                }}
            />

            {/* Find Dialog */}
            <FindDialog
                open={findDialogOpen}
                onOpenChange={setFindDialogOpen}
                editor={editorInstance}
                replaceMode={findReplaceMode}
            />
        </div>
    );
}

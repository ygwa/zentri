/**
 * 项目笔记编辑器 - A4纸模式编辑器
 * 
 * 特点：
 * - A4纸大小的编辑区域
 * - 引导用户多思考，撰写长文
 * - 适合项目笔记、深度思考
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, Activity, Printer, Database, Search, Filter, Link as LinkIcon, Copy } from "lucide-react";
import { useAppStore } from "@/store";
import { TiptapToolbar } from "@/components/ui/tiptap-toolbar";
import { ZentriEditor } from "@/components/editor";
import { getContentPreview } from "@/lib/content-preview";
import { preprocessContent } from "@/lib/content-transformer";
import type { Card } from "@/types";
import type { JSONContent, Editor } from "@tiptap/core";

export interface ProjectNoteEditorProps {
  /** 项目卡片 ID */
  projectId: string;
  /** 关闭回调 */
  onClose: () => void;
}

// 将 EditorContent 转换为 JSONContent
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

// A4 纸尺寸配置（像素，96 DPI）
const A4_CONFIG = {
  width: 794, // A4 宽度 (210mm)
  height: 1123, // A4 高度 (297mm)
  padding: 64, // 内边距
};

export function ProjectNoteEditor({ projectId, onClose }: ProjectNoteEditorProps) {
  const { getCardById, cards, updateCard } = useAppStore();
  const project = getCardById(projectId);
  const [searchQuery, setSearchQuery] = useState('');
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  if (!project || project.type !== 'project') return null;

  // 计算字符数
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

  // 插入引用链接
  const handleInsertRef = useCallback((card: Card) => {
    if (!editorInstance) return;

    const text = `[[${card.title || card.id}]]`;
    editorInstance.chain().focus().insertContent(text).run();
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

  // 嵌入内容
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

  // 处理创建新卡片
  const handleCreateCard = useCallback(async (title: string) => {
    try {
      const { createCard } = useAppStore.getState();
      const newCard = await createCard('permanent', title, project.id);
      return { id: newCard.id, title: newCard.title };
    } catch (err) {
      console.error("Failed to create card:", err);
      return null;
    }
  }, [project.id]);

  // 处理标题变更
  const handleTitleChange = useCallback((newTitle: string) => {
    if (newTitle !== project.title) {
      updateCard(project.id, { title: newTitle });
    }
  }, [project.id, project.title, updateCard]);

  // 处理链接点击
  const handleLinkClick = useCallback((id: string) => {
    useAppStore.getState().selectCard(id);
    onClose();
  }, [onClose]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[#f4f4f5] z-30 flex flex-col animate-in slide-in-from-bottom-2 duration-150">
      {/* 工具栏 */}
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
            <span className="text-xs font-bold text-zinc-800">{project.title || 'Untitled Project'}</span>
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

      {/* 主编辑区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 写作区域 */}
        <div className="flex-1 flex flex-col bg-[#F9F9FB] border-r border-zinc-200 overflow-hidden relative min-w-0">
          <div className="flex-1 overflow-y-auto scroll-smooth flex flex-col">
            {/* 浮动工具栏 */}
            <div className="sticky top-4 z-10 pointer-events-none flex justify-center h-10 mb-[-40px] min-w-0">
              <div className="pointer-events-auto">
                <TiptapToolbar editor={editorInstance} />
              </div>
            </div>

            {/* A4 纸大小的文档表面 */}
            <div 
              className="mx-auto my-8 bg-white shadow-lg border border-zinc-200 transition-all flex flex-col"
              style={{
                width: `${A4_CONFIG.width}px`,
                minHeight: `${A4_CONFIG.height}px`,
                padding: `${A4_CONFIG.padding}px`,
              }}
            >
              {/* 项目标题 */}
              <div className="mb-8 border-b border-zinc-100 pb-4 shrink-0">
                <input
                  value={project.title || 'Untitled Project'}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-3xl font-bold text-zinc-900 font-serif w-full outline-none placeholder-zinc-300 bg-transparent border-none p-0 focus:ring-0"
                  placeholder="Untitled Project"
                />
              </div>

              {/* 编辑器区域 */}
              <div className="flex-1 relative min-h-0">
                <ZentriEditor
                  key={projectId}
                  content={normalizeContent(project.content)}
                  onChange={handleContentChange}
                  cards={cardsForAutocomplete}
                  onCreateCard={handleCreateCard}
                  onLinkClick={handleLinkClick}
                  placeholder="开始撰写你的项目... 深入思考，充分展开。"
                  className="font-serif text-lg leading-relaxed h-full"
                  onEditorReady={(editor) => {
                    setEditorInstance(editor);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 知识库侧边栏 */}
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

          {/* 搜索框 */}
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

          {/* 卡片列表 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-zinc-50/50">
            {filteredLibrary.map(card => (
              <div
                key={card.id}
                className="bg-white border border-zinc-200 rounded-sm p-3 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group relative"
              >
                {/* 头部 */}
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[9px] font-mono text-zinc-400 font-bold bg-zinc-50 px-1 rounded-sm">{card.id.slice(0, 8)}</span>
                  {/* 操作按钮 */}
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

                {/* 内容 */}
                <div className="text-xs font-bold text-zinc-800 mb-1 leading-snug">{card.title || 'Untitled'}</div>
                <div className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mb-2">
                  {getContentPreview(card.content, 150)}
                </div>

                {/* 标签 */}
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
    </div>
  );
}





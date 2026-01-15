/**
 * 卡片笔记编辑器 - 固定大小的卡片编辑器
 * 
 * 特点：
 * - 固定卡片大小，引导用户控制内容量
 * - 适合永久笔记、原子化知识点
 * - 视觉上限制内容长度，鼓励精炼
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, Save, Activity, Calendar, ArrowRight } from "lucide-react";
import { useAppStore } from "@/store";
import { ZentriEditor } from "@/components/editor";
import { TiptapToolbar } from "@/components/ui/tiptap-toolbar";
import { getContentPreview } from "@/lib/content-preview";
import { preprocessContent } from "@/lib/content-transformer";
import { useDebounce } from "@/hooks/use-debounce";
import type { EditorContent, CardType } from "@/types";
import type { JSONContent, Editor } from "@tiptap/core";

export interface CardNoteEditorProps {
  /** 卡片 ID */
  cardId: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 链接点击回调 */
  onLinkClick?: (id: string) => void;
}

// 将 EditorContent 转换为 JSONContent
function normalizeContent(content: EditorContent | string | undefined): JSONContent | null {
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

// 卡片固定尺寸配置
const CARD_CONFIG = {
  width: 600, // 固定宽度
  minHeight: 400, // 最小高度
  maxHeight: 'calc(100vh - 200px)', // 动态最大高度，适应屏幕
  padding: 48, // 内边距
};

// 状态流转配置
const STATUS_FLOW = [
  { type: 'fleeting' as CardType, label: 'Captured', color: 'amber' },
  { type: 'literature' as CardType, label: 'Refined', color: 'blue' },
  { type: 'permanent' as CardType, label: 'Permanent', color: 'emerald' },
] as const;

export function CardNoteEditor({ cardId, onClose, onLinkClick }: CardNoteEditorProps) {
  const { getCardById, updateCard, cards } = useAppStore();
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');
  
  const card = getCardById(cardId);
  
  // 本地标题状态，用于立即更新 UI
  const [localTitle, setLocalTitle] = useState(card?.title || 'Untitled');
  const debouncedTitle = useDebounce(localTitle, 800);
  const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedTitleRef = useRef<string>(card?.title || '');

  // 内容已经在 store 中加载完成，无需再次加载
  
  // 只在组件挂载或 cardId 改变时同步外部标题
  useEffect(() => {
    if (card && card.title !== lastSavedTitleRef.current && !isSavingRef.current) {
      setLocalTitle(card.title || 'Untitled');
      lastSavedTitleRef.current = card.title || '';
    }
  }, [cardId]); // 只依赖 cardId，避免循环更新
  
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
    
    isSavingRef.current = true;
    titleSaveTimeoutRef.current = setTimeout(() => {
      const titleToSave = debouncedTitle || 'Untitled';
      updateCard(card.id, { title: titleToSave }).then(() => {
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
  }, [debouncedTitle, card?.id, updateCard]);

  if (!card) return null;

  // 计算字符数
  const charCount = useMemo(() => {
    if (!card.content) return 0;
    const preview = getContentPreview(card.content);
    return preview.length;
  }, [card.content]);

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
      updateCard(card.id, { content: jsonContent as any });
      lastSavedContentRef.current = contentStr;
    }, 500);
  }, [card.id, updateCard]);

  // 处理标题变更 - 立即更新本地状态，防抖保存
  const handleTitleChange = useCallback((newTitle: string) => {
    setLocalTitle(newTitle);
  }, []);

  // 处理链接变更
  const handleLinksChange = useCallback((links: string[]) => {
    updateCard(card.id, { links });
  }, [card.id, updateCard]);

  // 处理状态切换
  const handleStatusChange = useCallback(async (targetType: CardType) => {
    // 如果目标类型与当前类型相同，不需要更新
    if (targetType === card.type) {
      return;
    }
    
    // 只能向前流转，不能倒退
    const currentIndex = STATUS_FLOW.findIndex(s => s.type === card.type);
    const targetIndex = STATUS_FLOW.findIndex(s => s.type === targetType);
    
    // 如果当前类型不在流转列表中（如 project），允许切换
    // 如果目标类型不在流转列表中，不允许切换
    if (targetIndex === -1) {
      return;
    }
    
    // 如果当前类型在流转列表中，且目标索引小于当前索引，不允许倒退
    if (currentIndex !== -1 && targetIndex < currentIndex) {
      return;
    }
    
    try {
      await updateCard(card.id, { type: targetType });
    } catch (err) {
      console.error("Failed to update card type:", err);
    }
  }, [card.id, card.type, updateCard]);

  // 创建新卡片
  const handleCreateCard = useCallback(async (title: string) => {
    try {
      const { createCard } = useAppStore.getState();
      const newCard = await createCard('permanent', title);
      return { id: newCard.id, title: newCard.title };
    } catch (err) {
      console.error("Failed to create card:", err);
      return null;
    }
  }, []);

  // 卡片列表用于自动补全
  const cardsForAutocomplete = useMemo(() => {
    return cards.filter(c => c.id !== card.id);
  }, [cards, card.id]);

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

  return (
    <div className="absolute inset-0 bg-[#f0f0f2] z-30 flex flex-col animate-in slide-in-from-bottom-2 duration-150">
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-sm border border-zinc-200">
              {card.id}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 状态流转指示器 */}
          <div className="flex items-center gap-1 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-sm">
            {STATUS_FLOW.map((status, index) => {
              const currentIndex = STATUS_FLOW.findIndex(s => s.type === card.type);
              const isActive = status.type === card.type;
              // 如果当前类型不在流转列表中（如 project），允许切换到任何状态
              const isPast = currentIndex !== -1 && index < currentIndex;
              const isClickable = currentIndex === -1 || index >= currentIndex; // 可以跳转到任何未来状态，但不能倒退
              
              // 根据状态和颜色生成类名
              const getButtonClasses = () => {
                const base = "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-all duration-200";
                
                if (isActive) {
                  if (status.color === 'amber') {
                    return `${base} bg-amber-500 text-white shadow-sm`;
                  } else if (status.color === 'blue') {
                    return `${base} bg-blue-500 text-white shadow-sm`;
                  } else {
                    return `${base} bg-emerald-500 text-white shadow-sm`;
                  }
                } else if (isPast) {
                  if (status.color === 'amber') {
                    return `${base} bg-amber-100 text-amber-700 border border-amber-200`;
                  } else if (status.color === 'blue') {
                    return `${base} bg-blue-100 text-blue-700 border border-blue-200`;
                  } else {
                    return `${base} bg-emerald-100 text-emerald-700 border border-emerald-200`;
                  }
                } else if (isClickable) {
                  if (status.color === 'amber') {
                    return `${base} bg-white text-zinc-600 border border-zinc-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 cursor-pointer`;
                  } else if (status.color === 'blue') {
                    return `${base} bg-white text-zinc-600 border border-zinc-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 cursor-pointer`;
                  } else {
                    return `${base} bg-white text-zinc-600 border border-zinc-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 cursor-pointer`;
                  }
                } else {
                  return `${base} bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed opacity-50`;
                }
              };
              
              const getArrowClasses = () => {
                if (isPast || isActive) {
                  if (status.color === 'amber') {
                    return "mx-1 text-amber-400";
                  } else if (status.color === 'blue') {
                    return "mx-1 text-blue-400";
                  } else {
                    return "mx-1 text-emerald-400";
                  }
                }
                return "mx-1 text-zinc-300";
              };
              
              return (
                <div key={status.type} className="flex items-center">
                  <button
                    onClick={() => isClickable && handleStatusChange(status.type)}
                    disabled={!isClickable}
                    className={getButtonClasses()}
                    title={isClickable ? `切换到 ${status.label}` : isActive ? `当前状态：${status.label}` : '无法倒退'}
                  >
                    {status.label}
                  </button>
                  {index < STATUS_FLOW.length - 1 && (
                    <ArrowRight 
                      size={12} 
                      className={getArrowClasses()}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-sm">
            <Activity size={12} className="text-zinc-400" />
            <span className="text-[10px] font-mono text-zinc-600">{charCount} chars</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium">
            <Save size={12} /> <span className="font-mono text-[9px] uppercase">Save</span>
          </button>
        </div>
      </div>

        {/* 主编辑区域 */}
        <div className="flex-1 flex items-center justify-center overflow-y-auto p-8">
          {/* 背景网格纹理 */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.10]" 
            style={{ 
              backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, 
              backgroundSize: '20px 20px' 
            }}
          />

          {/* 固定大小的卡片 */}
          <div 
            className="relative bg-white shadow-2xl border border-zinc-300 rounded-sm flex flex-col transition-all min-h-0"
            style={{
              width: `${CARD_CONFIG.width}px`,
              minHeight: `${CARD_CONFIG.minHeight}px`,
              maxHeight: `${CARD_CONFIG.maxHeight}px`,
            }}
          >
            {/* 卡片装饰条 */}
            <div className={`h-1 w-full shrink-0 ${card.type === 'permanent' ? 'bg-emerald-500' : card.type === 'literature' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>

            <div 
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
              style={{ padding: `${CARD_CONFIG.padding}px` }}
            >
            {/* 标题 */}
            <div className="mb-6 shrink-0">
              <input
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full text-2xl font-extrabold text-zinc-900 placeholder-zinc-300 border-none focus:ring-0 p-0 mb-3 bg-transparent leading-tight tracking-tight"
                placeholder="Untitled Note"
              />

              {/* 元信息 */}
              <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono tracking-wide">
                <span className="flex items-center gap-1">
                  <Calendar size={10} /> {new Date(card.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </span>
                <span className="flex items-center gap-1">
                  <Activity size={10} /> {charCount} chars
                </span>
              </div>
            </div>

            {/* 浮动工具栏 */}
            <div className="sticky top-0 z-10 pointer-events-none flex justify-center mb-2 shrink-0">
              <div className="pointer-events-auto">
                <TiptapToolbar editor={editorInstance} />
              </div>
            </div>

            {/* 编辑器内容区域 */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ZentriEditor
                key={cardId}
                content={normalizeContent(card.content)}
                onChange={handleContentChange}
                onLinksChange={handleLinksChange}
                cards={cardsForAutocomplete}
                onCreateCard={handleCreateCard}
                onLinkClick={onLinkClick}
                placeholder="记录你的想法... 保持简洁，一个卡片一个主题。"
                className="prose prose-sm max-w-none font-serif text-base leading-relaxed text-zinc-800 min-h-full"
                onEditorReady={(editor) => {
                  setEditorInstance(editor);
                }}
              />
            </div>

            {/* 内容量提示 */}
            {charCount > 500 && (
              <div className="mt-4 pt-4 border-t border-zinc-100 shrink-0">
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Activity size={12} />
                  <span>内容较长，考虑拆分为多个卡片</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


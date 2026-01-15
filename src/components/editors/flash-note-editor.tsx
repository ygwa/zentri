/**
 * 弹框编辑器 - 用于快速记录闪念笔记
 * 
 * 特点：
 * - 简洁的文本框界面
 * - 快速输入，最小化干扰
 * - 适合记录临时想法、快速笔记
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { X, Save } from "lucide-react";
import { ZentriEditor } from "@/components/editor";
import type { JSONContent, Editor } from "@tiptap/core";

export interface FlashNoteEditorProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave?: (content: JSONContent) => void;
  /** 初始内容 */
  initialContent?: JSONContent | null;
  /** 标题 */
  title?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否自动聚焦 */
  autoFocus?: boolean;
}

export function FlashNoteEditor({
  open,
  onClose,
  onSave,
  initialContent,
  title = "快速笔记",
  placeholder = "记录你的想法...",
  autoFocus = true,
}: FlashNoteEditorProps) {
  const [content, setContent] = useState<JSONContent | null>(initialContent || null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当打开时重置内容
  useEffect(() => {
    if (open) {
      setContent(initialContent || null);
    }
  }, [open, initialContent]);

  // 处理内容变化
  const handleContentChange = useCallback((jsonContent: JSONContent) => {
    setContent(jsonContent);
  }, []);

  // 处理保存
  const handleSave = useCallback(() => {
    if (content && onSave) {
      onSave(content);
    }
    onClose();
  }, [content, onSave, onClose]);

  // 处理键盘快捷键
  useEffect(() => {
    if (!open || !editorInstance) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter 保存并关闭
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      // Escape 关闭
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, editorInstance, handleSave, onClose]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 编辑器容器 */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl border border-zinc-200 flex flex-col max-h-[80vh]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-sm transition-colors"
            >
              <Save size={12} />
              保存
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-100 rounded-sm text-zinc-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 编辑器区域 */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
          <ZentriEditor
            content={content}
            onChange={handleContentChange}
            placeholder={placeholder}
            className="prose prose-sm max-w-none focus:outline-none"
            onEditorReady={(editor) => {
              setEditorInstance(editor);
              if (autoFocus && editor) {
                // 延迟聚焦，确保编辑器已渲染
                setTimeout(() => {
                  editor.commands.focus();
                }, 100);
              }
            }}
          />
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-50 shrink-0">
          <p className="text-xs text-zinc-500 text-center">
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-300 rounded text-[10px] font-mono">
              ⌘
            </kbd>
            {" + "}
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-300 rounded text-[10px] font-mono">
              Enter
            </kbd>
            {" 保存 · "}
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-300 rounded text-[10px] font-mono">
              Esc
            </kbd>
            {" 关闭"}
          </p>
        </div>
      </div>
    </div>
  );
}





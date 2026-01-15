import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Unlink,
  Check,
  X,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BubbleToolbarProps {
  editor: Editor;
  onCreateFleetingNote?: (content: JSONContent) => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

function ToolbarButton({ onClick, isActive, children, title, disabled }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded-md transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-muted text-foreground/80 hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border/50 mx-0.5" />;
}

export function BubbleToolbar({ editor, onCreateFleetingNote }: BubbleToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  // 处理创建闪念笔记
  const handleCreateFleetingNote = useCallback(() => {
    if (!onCreateFleetingNote) return;
    
    const { selection } = editor.state;
    const { from, to } = selection;
    
    // 如果没有选中内容，不执行
    if (from === to) return;
    
    // 获取选中内容的 JSON
    const selectedContent = editor.state.doc.slice(from, to);
    const jsonContent: JSONContent = {
      type: "doc",
      content: selectedContent.content.toJSON(),
    };
    
    // 调用回调
    onCreateFleetingNote(jsonContent);
    
    // 保持编辑器焦点
    editor.commands.focus();
  }, [editor, onCreateFleetingNote]);

  const setLink = useCallback(() => {
    if (linkUrl.trim()) {
      // 确保 URL 有协议
      let href = linkUrl.trim();
      if (!/^https?:\/\//.test(href) && !href.startsWith("mailto:") && !href.startsWith("#")) {
        href = `https://${href}`;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
    // 保持焦点在编辑器
    editor.commands.focus();
  }, [editor, linkUrl]);

  const unsetLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setLink();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowLinkInput(false);
      setLinkUrl("");
      // 恢复编辑器焦点
      editor.commands.focus();
    }
  };

  // 链接输入状态
  if (showLinkInput) {
    return (
      <div className="flex items-center gap-1 bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl px-2 py-1.5 animate-in fade-in-0 zoom-in-95 duration-150">
        <Link className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-1" />
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={handleLinkKeyDown}
          placeholder="输入链接地址..."
          className="w-52 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
          autoFocus
        />
        <button
          onClick={setLink}
          disabled={!linkUrl}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            linkUrl 
              ? "text-primary hover:bg-primary/10" 
              : "text-muted-foreground/50"
          )}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setShowLinkInput(false);
            setLinkUrl("");
          }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl px-1.5 py-1 animate-in fade-in-0 zoom-in-95 duration-150">
      {/* 文字格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="加粗 (⌘B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="斜体 (⌘I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="删除线 (⌘⇧X)"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="行内代码 (⌘E)"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="高亮"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 链接 */}
      {editor.isActive("link") ? (
        <ToolbarButton
          onClick={unsetLink}
          isActive={false}
          title="移除链接"
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
      ) : (
        <ToolbarButton
          onClick={() => setShowLinkInput(true)}
          isActive={false}
          title="添加链接 (⌘K)"
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
      )}

      <Divider />

      {/* 标题格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="标题 1 (# 空格)"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="标题 2 (## 空格)"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="标题 3 (### 空格)"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 块格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="引用 (> 空格)"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="无序列表 (- 空格)"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="有序列表 (1. 空格)"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 创建闪念笔记 */}
      {onCreateFleetingNote && (
        <ToolbarButton
          onClick={handleCreateFleetingNote}
          isActive={false}
          title="创建闪念笔记"
        >
          <StickyNote className="h-4 w-4" />
        </ToolbarButton>
      )}
    </div>
  );
}

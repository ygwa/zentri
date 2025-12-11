import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BubbleToolbarProps {
  editor: Editor;
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

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const setLink = useCallback(() => {
    if (linkUrl) {
      // 确保 URL 有协议
      let href = linkUrl;
      if (!/^https?:\/\//.test(href)) {
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
  }, [editor, linkUrl]);

  const unsetLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setLink();
    } else if (e.key === "Escape") {
      setShowLinkInput(false);
      setLinkUrl("");
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
        title="标题 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="标题 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="标题 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 块格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="引用"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="无序列表"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="有序列表"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

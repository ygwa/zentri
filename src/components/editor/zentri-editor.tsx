import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, Editor, JSONContent } from "@tiptap/react";
import { DOMParser } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { common, createLowlight } from "lowlight";

import { cn } from "@/lib/utils";
import { looksLikeMarkdown, markdownToHtml } from "@/lib/markdown-parser";
import { SlashCommandMenu } from "./slash-command";
import { BubbleToolbar } from "./bubble-toolbar";
import { WikiLink, extractWikiLinkTitles, resolveWikiLinksToIds } from "./extensions/wiki-link";
import { ReferenceBlock } from "./extensions/reference-block";
import { LinkAutocomplete, CardSuggestion } from "./link-autocomplete";

import "./editor.css";

// 创建 lowlight 实例用于代码高亮
const lowlight = createLowlight(common);

export interface ZentriEditorProps {
  /** 编辑器内容，使用 TipTap JSON 格式 */
  content?: JSONContent | null;
  placeholder?: string;
  /** 内容变化时回调，返回 TipTap JSON 格式 */
  onChange?: (content: JSONContent) => void;
  /** 内容中的 [[双链]] 变化时回调，返回链接的卡片 ID 列表 */
  onLinksChange?: (linkIds: string[]) => void;
  onSave?: () => void;
  editable?: boolean;
  className?: string;
  /** 用于 [[双链]] 自动补全的卡片列表 */
  cards?: Array<{ id: string; title: string; preview?: string }>;
  onLinkClick?: (id: string) => void;
  /** 创建新卡片 */
  onCreateCard?: (title: string) => Promise<{ id: string; title: string } | null>;
  /** 编辑器实例就绪时回调，用于外部访问 editor 实例 */
  onEditorReady?: (editor: Editor | null) => void;
}

/** 空文档的默认 JSON 结构 */
const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * Zentri 编辑器 - 基于 TipTap 的富文本编辑器
 * 
 * 特性：
 * - 使用 TipTap JSON 格式存储，无损保存所有格式
 * - / 斜杠命令菜单
 * - [[ 双链自动补全
 * - Bubble 工具栏（选中文字时显示）
 * - 丰富的块类型支持（标题、列表、代码块、表格等）
 * - 代码语法高亮
 * - 任务列表
 * - 自定义节点（WikiLink, ReferenceBlock）
 * - 粘贴 Markdown 自动转换为富文本（按住 Shift 粘贴可保留纯文本）
 */
export function ZentriEditor({
  content,
  placeholder = "输入 '/' 唤出命令菜单，输入 '[[' 链接卡片...",
  onChange,
  onLinksChange,
  onSave,
  editable = true,
  className,
  cards = [],
  onLinkClick,
  onCreateCard,
  onEditorReady,
}: ZentriEditorProps) {
  // Slash 命令状态
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);

  // Bubble 工具栏状态
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });

  // [[ 链接自动补全状态
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [linkMenuPosition, setLinkMenuPosition] = useState({ x: 0, y: 0 });
  const [linkQuery, setLinkQuery] = useState("");
  const linkRangeRef = useRef<{ from: number; to: number } | null>(null);
  
  // 用于防抖链接提取的 ref
  const linksExtractTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLinksRef = useRef<string[]>([]);
  
  // 用于防抖 onChange 的 ref
  const onChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // 使用 CodeBlockLowlight 替代
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            const level = node.attrs.level;
            return level === 1 ? "一级标题" : level === 2 ? "二级标题" : "三级标题";
          }
          return placeholder;
        },
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-empty",
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: "code-block",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "editor-table",
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      // 自定义 [[WikiLink]] 扩展
      WikiLink.configure({
        cards,
        onLinkClick,
      }),
      ReferenceBlock.configure({
        onLocate: (sourceId, location) => {
          console.log("Locate request:", sourceId, location);
          // TODO: Implement navigation to source
        },
      }),
    ],
    content: content || EMPTY_DOC,
    editable,
    editorProps: {
      attributes: {
        class: "zentri-editor-content outline-none",
        spellcheck: "false",
      },
      handleKeyDown: (_view, event) => {
        // Cmd/Ctrl + S 保存
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          onSave?.();
          return true;
        }
        // 如果链接菜单打开，不处理其他快捷键
        if (isLinkMenuOpen) {
          return false;
        }
        return false;
      },
      // 粘贴 Markdown 自动转换
      handlePaste: (view, event, _slice) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return false;
        }
        
        const text = clipboardData.getData("text/plain");
        const html = clipboardData.getData("text/html");
        
        // 如果没有纯文本，或者已经有 HTML 内容（从富文本编辑器复制），使用默认处理
        if (!text || (html && html.length > 50)) {
          return false;
        }
        
        // 检测是否像 Markdown
        if (looksLikeMarkdown(text)) {
          event.preventDefault();
          
          // 转换 Markdown 为 HTML
          const convertedHtml = markdownToHtml(text);
          
          // 使用 ProseMirror 的 DOM 解析器插入 HTML
          const { state, dispatch } = view;
          const { schema } = state;
          
          // 创建一个临时 DOM 元素来解析 HTML
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = convertedHtml;
          
          // 使用 ProseMirror 的 DOMParser 解析
          const parser = DOMParser.fromSchema(schema);
          const doc = parser.parse(tempDiv);
          
          // 获取内容片段
          const fragment = doc.content;
          
          // 插入内容
          const tr = state.tr.replaceSelection(new Slice(fragment, 0, 0));
          dispatch(tr);
          
          return true;
        }
        
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.types.includes("application/x-zentri-reference")) {
          event.preventDefault();
          const data = event.dataTransfer.getData("application/x-zentri-reference");
          if (data) {
            try {
              const refData = JSON.parse(data);
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coordinates) {
                const node = view.state.schema.nodes.referenceBlock.create({
                  sourceId: refData.sourceId,
                  sourceTitle: refData.sourceTitle,
                  sourceType: refData.type || "pdf",
                  quoteContent: refData.text,
                  page: refData.page,
                  cfi: refData.cfi,
                });
                view.dispatch(view.state.tr.insert(coordinates.pos, node));
                return true;
              }
            } catch (e) {
              console.error("Failed to parse drop data", e);
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // 检测各种命令触发
      detectCommands(editor);
      
      // 防抖 onChange，避免每次按键都触发更新（300ms 防抖）
      if (onChange) {
        if (onChangeTimeoutRef.current) {
          clearTimeout(onChangeTimeoutRef.current);
        }
        onChangeTimeoutRef.current = setTimeout(() => {
          const jsonContent = editor.getJSON();
          const contentStr = JSON.stringify(jsonContent);
          
          // 只在内容实际变化时才调用 onChange
          if (contentStr !== lastContentRef.current) {
            lastContentRef.current = contentStr;
            onChange(jsonContent);
          }
        }, 300); // 300ms 防抖，平衡响应性和性能
      }
      
      // 防抖提取 [[双链]]，避免每次按键都执行
      if (onLinksChange) {
        if (linksExtractTimeoutRef.current) {
          clearTimeout(linksExtractTimeoutRef.current);
        }
        linksExtractTimeoutRef.current = setTimeout(() => {
          const text = editor.getText();
          const linkTitles = extractWikiLinkTitles(text);
          const linkIds = resolveWikiLinksToIds(linkTitles, cards);
          
          // 只在链接实际变化时才通知
          const lastLinks = lastLinksRef.current;
          const changed = linkIds.length !== lastLinks.length || 
            !linkIds.every((id, i) => lastLinks[i] === id);
          
          if (changed) {
            lastLinksRef.current = linkIds;
            onLinksChange(linkIds);
          }
        }, 500); // 500ms 防抖
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { selection } = editor.state;
      const { empty } = selection;

      // 选中文字且不是代码块时显示 bubble
      if (!empty && !editor.isActive("codeBlock")) {
        const { from, to } = selection;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);

        setBubblePosition({
          x: (start.left + end.left) / 2,
          y: start.top - 10,
        });
        setShowBubble(true);
      } else {
        setShowBubble(false);
      }
    },
  });

  // 检测命令触发（/ 和 [[）
  const detectCommands = useCallback(
    (editor: Editor) => {
      const { selection } = editor.state;
      const { $anchor } = selection;
      const textBefore = $anchor.parent.textContent.slice(0, $anchor.parentOffset);

      // 检查是否输入了 [[
      const linkMatch = textBefore.match(/\[\[([^\]]*)?$/);

      if (linkMatch && !isSlashMenuOpen) {
        const query = linkMatch[1] || "";
        setLinkQuery(query);
        linkRangeRef.current = {
          from: $anchor.pos - linkMatch[0].length,
          to: $anchor.pos,
        };

        // 获取光标位置
        const coords = editor.view.coordsAtPos($anchor.pos);
        setLinkMenuPosition({
          x: coords.left,
          y: coords.bottom + 8,
        });
        setIsLinkMenuOpen(true);
        setIsSlashMenuOpen(false);
        return;
      }

      // 如果不是 [[ 则关闭链接菜单
      if (!linkMatch) {
        setIsLinkMenuOpen(false);
        linkRangeRef.current = null;
      }

      // 检查是否输入了 /
      const slashMatch = textBefore.match(/\/([a-zA-Z0-9\u4e00-\u9fa5]*)$/);

      if (slashMatch && !isLinkMenuOpen) {
        setSlashQuery(slashMatch[1]);
        slashRangeRef.current = {
          from: $anchor.pos - slashMatch[0].length,
          to: $anchor.pos,
        };

        // 获取光标位置
        const coords = editor.view.coordsAtPos($anchor.pos);
        setSlashMenuPosition({
          x: coords.left,
          y: coords.bottom + 8,
        });
        setIsSlashMenuOpen(true);
      } else if (!slashMatch) {
        setIsSlashMenuOpen(false);
        slashRangeRef.current = null;
      }
    },
    [isSlashMenuOpen, isLinkMenuOpen]
  );

  // 当编辑器就绪时，通知外部组件
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
    return () => {
      if (onEditorReady) {
        onEditorReady(null);
      }
    };
  }, [editor, onEditorReady]);

  // 同步外部 content 变化
  useEffect(() => {
    // 只有当编辑器没有焦点时，才允许外部更新覆盖
    // 这样可以避免输入时的光标跳动和冲突
    if (editor && content && !editor.isFocused) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (linksExtractTimeoutRef.current) {
        clearTimeout(linksExtractTimeoutRef.current);
      }
      if (onChangeTimeoutRef.current) {
        clearTimeout(onChangeTimeoutRef.current);
      }
    };
  }, []);

  // 处理链接选择
  const handleLinkSelect = useCallback(
    async (card: CardSuggestion | null, createNew?: boolean) => {
      if (!editor || !linkRangeRef.current) return;

      const { from, to } = linkRangeRef.current;

      let selectedCard = card;

      // 如果是新建卡片
      if (createNew && card && onCreateCard) {
        const newCard = await onCreateCard(card.title);
        if (newCard) {
          selectedCard = newCard;
        } else {
          setIsLinkMenuOpen(false);
          linkRangeRef.current = null;
          return;
        }
      }

      if (selectedCard) {
        // 删除 [[query 并插入链接
        // 先删除 [[query
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .run();
        
        // 插入 [[title]] 文本
        const text = `[[${selectedCard.title}]]`;
        const insertPos = editor.state.selection.$from.pos;
        editor.chain().insertContent(text).run();
        
        // 应用 wikiLink mark（如果卡片存在）
        if (selectedCard.id) {
          const endPos = insertPos + text.length;
          editor
            .chain()
            .setTextSelection({ from: insertPos, to: endPos })
            .setWikiLink({ href: selectedCard.id, title: selectedCard.title })
            .setTextSelection(endPos)
            .run();
        }
      }

      setIsLinkMenuOpen(false);
      linkRangeRef.current = null;
    },
    [editor, onCreateCard]
  );

  // 处理 slash 命令选择
  const handleSlashCommand = useCallback(
    (command: string) => {
      if (!editor || !slashRangeRef.current) return;

      const { from, to } = slashRangeRef.current;

      // 删除 /query
      editor.chain().focus().deleteRange({ from, to }).run();

      // 执行命令
      switch (command) {
        case "text":
          editor.chain().focus().setParagraph().run();
          break;
        case "heading1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "heading2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "heading3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "bullet":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "numbered":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "todo":
          editor.chain().focus().toggleTaskList().run();
          break;
        case "quote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "code":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "divider":
          editor.chain().focus().setHorizontalRule().run();
          break;
        case "table":
          editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
          break;
        case "image":
          // TODO: 更好的图片上传
          const url = prompt("输入图片 URL:");
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
          break;
        case "link":
          // 触发 [[ 链接
          editor.chain().focus().insertContent("[[").run();
          break;
      }

      setIsSlashMenuOpen(false);
      slashRangeRef.current = null;
    },
    [editor]
  );

  // 关闭菜单
  const handleCloseSlashMenu = useCallback(() => {
    setIsSlashMenuOpen(false);
    slashRangeRef.current = null;
  }, []);

  const handleCloseLinkMenu = useCallback(() => {
    setIsLinkMenuOpen(false);
    linkRangeRef.current = null;
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("zentri-editor relative", className)}>
      {/* 编辑器内容 */}
      <EditorContent editor={editor} />

      {/* Bubble 工具栏 - 选中文字时显示 */}
      {showBubble && !isSlashMenuOpen && !isLinkMenuOpen && (
        <div
          className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            left: bubblePosition.x,
            top: bubblePosition.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <BubbleToolbar editor={editor} />
        </div>
      )}

      {/* Slash 命令菜单 */}
      {isSlashMenuOpen && (
        <SlashCommandMenu
          query={slashQuery}
          position={slashMenuPosition}
          onSelect={handleSlashCommand}
          onClose={handleCloseSlashMenu}
        />
      )}

      {/* [[ 链接自动补全菜单 */}
      {isLinkMenuOpen && (
        <LinkAutocomplete
          query={linkQuery}
          position={linkMenuPosition}
          cards={cards}
          onSelect={handleLinkSelect}
          onClose={handleCloseLinkMenu}
        />
      )}
    </div>
  );
}


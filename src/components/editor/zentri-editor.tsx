import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, Editor, JSONContent } from "@tiptap/react";
import { DOMParser } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
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
import { selectAndSaveImage, saveImageFromFile, getImageUrl } from "@/lib/image-handler";
import { assets } from "@/services/api";
import { SlashCommandMenu } from "./slash-command";
import { BubbleToolbar } from "./bubble-toolbar";
import { ImageToolbar } from "./image-toolbar";
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
  /** 创建新卡片后打开闪念笔记弹框的回调 */
  onFleetingNoteCreated?: (cardId: string) => void;
  /** 编辑器实例就绪时回调，用于外部访问 editor 实例 */
  onEditorReady?: (editor: Editor | null) => void;
  /** 从选中文字创建闪念笔记的回调 */
  onCreateFleetingNote?: (content: JSONContent) => void;
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
  onFleetingNoteCreated,
  onEditorReady,
  onCreateFleetingNote,
}: ZentriEditorProps) {
  // Slash 命令状态
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);

  // Bubble 工具栏状态
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0, showAbove: true });
  const bubbleUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBubblePositionRef = useRef({ x: 0, y: 0, showAbove: true });
  const isSelectingRef = useRef(false);

  // 图片工具栏状态
  const [showImageToolbar, setShowImageToolbar] = useState(false);
  const [imageToolbarPosition, setImageToolbarPosition] = useState({ x: 0, y: 0, showAbove: true });
  const imageToolbarUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastImageToolbarPositionRef = useRef({ x: 0, y: 0, showAbove: true });

  // [[ 链接自动补全状态
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [linkMenuPosition, setLinkMenuPosition] = useState({ x: 0, y: 0 });
  const [linkQuery, setLinkQuery] = useState("");
  const linkRangeRef = useRef<{ from: number; to: number } | null>(null);
  const isLinkMenuOpenRef = useRef(false);
  const isSlashMenuOpenRef = useRef(false);
  
  // 同步 ref 和 state
  useEffect(() => {
    isLinkMenuOpenRef.current = isLinkMenuOpen;
  }, [isLinkMenuOpen]);
  
  useEffect(() => {
    isSlashMenuOpenRef.current = isSlashMenuOpen;
  }, [isSlashMenuOpen]);

  // 用于防抖链接提取的 ref
  const linksExtractTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLinksRef = useRef<string[]>([]);

  // 用于防抖 onChange 的 ref
  const onChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>('');

  // 用于防抖 detectCommands 的 ref
  const detectCommandsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 用于防抖 trackImageUsage 的 ref
  const trackImageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用于防抖内容同步的 ref
  const contentSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedContentRef = useRef<string>('');
  const isContentSyncingRef = useRef(false);

  // 图片使用情况跟踪
  const imageUsageRef = useRef<Set<string>>(new Set()); // 当前文档中使用的图片路径
  const initialImagesRef = useRef<Set<string>>(new Set()); // 初始加载时的图片路径（用于在关闭时清理）

  const onLinkClickRef = useRef(onLinkClick);
  useEffect(() => {
    onLinkClickRef.current = onLinkClick;
  }, [onLinkClick]);

  // 保存 cards 的 ref，供 WikiLink 扩展访问最新值
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // 保存 editor 实例的 ref，供 handlePaste 使用
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // 使用 CodeBlockLowlight 替代
        // 确保 Markdown 输入规则已启用（默认已启用）
        // 支持的快捷输入：
        // - # 空格 -> H1
        // - ## 空格 -> H2
        // - ### 空格 -> H3
        // - - 空格 -> 无序列表
        // - 1. 空格 -> 有序列表
        // - > 空格 -> 引用块
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
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-relative-path': {
              default: null,
              parseHTML: element => element.getAttribute('data-relative-path'),
              renderHTML: attributes => {
                if (!attributes['data-relative-path']) {
                  return {};
                }
                return {
                  'data-relative-path': attributes['data-relative-path'],
                };
              },
            },
            width: {
              default: null,
              parseHTML: element => {
                const width = element.getAttribute('width');
                return width ? parseInt(width, 10) : null;
              },
              renderHTML: attributes => {
                if (!attributes.width) {
                  return {};
                }
                return {
                  width: attributes.width,
                };
              },
            },
            rotation: {
              default: 0,
              parseHTML: element => {
                const rotation = element.getAttribute('data-rotation');
                return rotation ? parseInt(rotation, 10) : 0;
              },
              renderHTML: attributes => {
                if (!attributes.rotation || attributes.rotation === 0) {
                  return {};
                }
                return {
                  'data-rotation': attributes.rotation,
                  style: `transform: rotate(${attributes.rotation}deg);`,
                };
              },
            },
          };
        },
      }).configure({
        inline: false,
        allowBase64: true,
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
      // 使用函数返回 cards，确保始终访问最新值
      WikiLink.configure({
        cards: () => cardsRef.current,
        onLinkClick: (id) => onLinkClickRef.current?.(id),
      }),
      ReferenceBlock.configure({
        onLocate: (sourceId, location) => {
          console.log("Locate request:", sourceId, location);
          onLinkClickRef.current?.(sourceId);
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
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;
        const editor = editorRef.current;
        
        if (!editor) return false;

        // Cmd/Ctrl + S 保存
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          onSave?.();
          return true;
        }

        // 如果链接菜单或斜杠菜单打开，不处理其他快捷键（除了关闭菜单的快捷键）
        // 使用 ref 获取最新状态，避免闭包问题
        if (isLinkMenuOpenRef.current || isSlashMenuOpenRef.current) {
          if (event.key === "Escape") {
            // Escape 键关闭菜单
            if (isLinkMenuOpenRef.current) {
              setIsLinkMenuOpen(false);
              linkRangeRef.current = null;
            }
            if (isSlashMenuOpenRef.current) {
              setIsSlashMenuOpen(false);
              slashRangeRef.current = null;
            }
            return true;
          }
          return false;
        }

        // 格式化快捷键（仅在编辑器聚焦时）
        if (event.metaKey || event.ctrlKey) {
          switch (event.key.toLowerCase()) {
            case "b":
              event.preventDefault();
              editor.chain().focus().toggleBold().run();
              return true;
            case "i":
              event.preventDefault();
              editor.chain().focus().toggleItalic().run();
              return true;
            case "k":
              event.preventDefault();
              // 如果有选中文字，打开链接输入；否则插入 [[
              if (!selection.empty) {
                // 检查编辑器是否已挂载
                if (!editor.view?.dom) return true;
                // 触发链接输入（通过 bubble toolbar）
                const { from, to } = selection;
                try {
                  const start = editor.view.coordsAtPos(from);
                  const end = editor.view.coordsAtPos(to);
                  // 检查上方空间，决定显示位置
                  const viewportTop = window.scrollY;
                  const spaceAbove = start.top + window.scrollY - viewportTop;
                  const showAbove = spaceAbove >= 80; // 需要足够的空间
                  setBubblePosition({
                    x: (start.left + end.left) / 2,
                    y: showAbove ? start.top - 12 : end.bottom + 12,
                    showAbove,
                  });
                  setShowBubble(true);
                } catch (err) {
                  // 编辑器可能还未完全挂载，静默失败
                  console.warn("Editor not ready for coordsAtPos:", err);
                }
                // 延迟触发链接输入，让 bubble toolbar 先显示
                setTimeout(() => {
                  const linkButton = document.querySelector('[title="添加链接 (⌘K)"]') as HTMLElement;
                  if (linkButton) {
                    linkButton.click();
                  } else {
                    // 如果找不到按钮，直接插入 [[
                    editor.chain().focus().insertContent("[[").run();
                  }
                }, 50);
              } else {
                // 插入 [[ 触发链接菜单
                editor.chain().focus().insertContent("[[").run();
              }
              return true;
            case "e":
              event.preventDefault();
              editor.chain().focus().toggleCode().run();
              return true;
            case "z":
              if (event.shiftKey) {
                event.preventDefault();
                editor.chain().focus().redo().run();
                return true;
              } else {
                event.preventDefault();
                editor.chain().focus().undo().run();
                return true;
              }
          }
          
          // Cmd+Shift+X: 删除线
          if (event.shiftKey && event.key.toLowerCase() === "x") {
            event.preventDefault();
            editor.chain().focus().toggleStrike().run();
            return true;
          }
        }

        // Shift + Enter: 软换行（在列表项中创建新行而不退出列表）
        if (event.shiftKey && event.key === "Enter") {
          event.preventDefault();
          editor.chain().focus().insertContent("\n").run();
          return true;
        }

        // Enter 键：智能列表继续
        if (event.key === "Enter" && !event.shiftKey) {
          const { $anchor } = selection;
          const node = $anchor.parent;
          
          // 检查是否在列表项中
          if (node.type.name === "listItem" || node.type.name === "taskItem") {
            const listItemContent = node.textContent.trim();
            
            // 如果列表项为空，退出列表
            if (listItemContent === "" || listItemContent === "[]") {
              event.preventDefault();
              editor.chain().focus().liftListItem(node.type.name).run();
              return true;
            }
            
            // 否则继续列表（默认行为，TipTap 会自动处理）
            return false;
          }
        }

        // TipTap StarterKit 已经包含了 Markdown 输入规则（# , ## , ### , - , 1. , > 等）
        // 所以不需要在这里手动处理

        // 智能输入增强：自动配对括号和引号（仅在代码块中）
        if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
          const { $anchor } = selection;
          const textAfter = $anchor.parent.textContent.slice($anchor.parentOffset);
          
          // 只在代码块中启用自动配对（行内代码不启用，避免干扰正常输入）
          const isInCodeBlock = editor.isActive("codeBlock");
          
          if (isInCodeBlock) {
            const pairs: Record<string, string> = {
              '(': ')',
              '[': ']',
              '{': '}',
              '"': '"',
              "'": "'",
              '`': '`',
            };
            
            if (pairs[event.key]) {
              const closing = pairs[event.key];
              // 如果光标后没有对应的闭合符号，自动插入
              // 但不要覆盖用户已经输入的字符
              if (!textAfter.startsWith(closing) && !textAfter.startsWith(event.key)) {
                event.preventDefault();
                editor.chain().focus().insertContent(event.key + closing).run();
                // 将光标移动到中间
                setTimeout(() => {
                  editor.commands.setTextSelection(selection.from + 1);
                }, 0);
                return true;
              }
            }
          }
        }

        return false;
      },
      // 粘贴处理：支持 Markdown 转换和图片粘贴
      handlePaste: (view, event, _slice) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return false;
        }

        // 检查是否有图片文件
        const items = Array.from(clipboardData.items);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        
        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) {
            console.log("[Image] Pasting image file:", file.name, file.type, file.size);
            // 异步保存图片并插入
            saveImageFromFile(file)
              .then(async (relativePath) => {
                if (!relativePath) {
                  console.warn("[Image] No relative path returned from saveImageFromFile");
                  return;
                }
                console.log("[Image] Saved image, relative path:", relativePath);
                const imageUrl = await getImageUrl(relativePath);
                if (!imageUrl) {
                  console.error("[Image] No image URL returned");
                  return;
                }
                console.log("[Image] Image URL:", imageUrl);
                console.log("[Image] Image URL type:", typeof imageUrl);
                console.log("[Image] Image URL length:", imageUrl?.length);
                console.log("[Image] Image URL starts with:", {
                  'http': imageUrl?.startsWith('http'),
                  'asset': imageUrl?.startsWith('asset://'),
                  'tauri': imageUrl?.startsWith('tauri://'),
                  'data': imageUrl?.startsWith('data:'),
                });
                
                // 验证 URL 格式
                if (!imageUrl || imageUrl.trim() === '') {
                  console.error("[Image] Invalid image URL:", imageUrl);
                  return;
                }
                
                // 使用保存的 editor ref 插入图片
                const currentEditor = editorRef.current;
                if (currentEditor && !currentEditor.isDestroyed) {
                  try {
                    currentEditor.chain().focus().setImage({ 
                      src: imageUrl, 
                      alt: file.name,
                      'data-relative-path': relativePath 
                    } as any).run();
                    console.log("[Image] Image inserted via editor command");
                    
                    // 验证图片节点是否已插入
                    setTimeout(() => {
                      const json = currentEditor.getJSON();
                      const images = JSON.stringify(json).match(/"type":"image"/g);
                      console.log("[Image] Images in editor:", images?.length || 0);
                      console.log("[Image] Editor JSON:", JSON.stringify(json, null, 2));
                    }, 100);
                  } catch (err) {
                    console.error("[Image] Error inserting image:", err);
                    // 降级方案：直接操作 transaction
                    const { state, dispatch } = view;
                    const { schema } = state;
                    const node = schema.nodes.image.create({ src: imageUrl, alt: file.name });
                    const tr = state.tr.replaceSelectionWith(node);
                    dispatch(tr);
                    console.log("[Image] Image node inserted via transaction (fallback)");
                  }
                } else {
                  console.warn("[Image] Editor not available, using transaction fallback");
                  // 降级方案：直接操作 transaction
                  const { state, dispatch } = view;
                  const { schema } = state;
                  const node = schema.nodes.image.create({ src: imageUrl, alt: file.name });
                  const tr = state.tr.replaceSelectionWith(node);
                  dispatch(tr);
                  console.log("[Image] Image node inserted via transaction (fallback - no editor)");
                }
              })
              .catch((error) => {
                console.error("[Image] Error in image paste flow:", error);
              });
            return true;
          }
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
        if (moved) {
          return false;
        }

        const dataTransfer = event.dataTransfer;
        if (!dataTransfer) {
          return false;
        }

        // 处理 Zentri 引用块拖拽
        if (dataTransfer.types.includes("application/x-zentri-reference")) {
          event.preventDefault();
          const data = dataTransfer.getData("application/x-zentri-reference");
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
          return false;
        }

        // 处理图片文件拖拽
        const files = Array.from(dataTransfer.files);
        const imageFile = files.find((file) => file.type.startsWith("image/"));
        
        if (imageFile) {
          event.preventDefault();
          const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
          
          // 异步保存图片并插入
          saveImageFromFile(imageFile).then((relativePath) => {
            if (relativePath && coordinates) {
              getImageUrl(relativePath).then((imageUrl) => {
                const { state, dispatch } = view;
                const { schema } = state;
                const node = schema.nodes.image.create({ src: imageUrl, alt: imageFile.name });
                const tr = state.tr.insert(coordinates.pos, node);
                dispatch(tr);
              }).catch((error) => {
                console.error("Failed to get image URL:", error);
              });
            }
          }).catch((error) => {
            console.error("Failed to save dropped image:", error);
          });
          
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      // 更新 editorRef
      editorRef.current = updatedEditor;
      
      // 检查编辑器是否已挂载
      if (!updatedEditor || !updatedEditor.view || !updatedEditor.view.dom || updatedEditor.isDestroyed) {
        return;
      }

      // 使用 requestAnimationFrame 延迟非关键操作，确保输入响应优先
      requestAnimationFrame(() => {
        // 检测各种命令触发（防抖，避免频繁调用）
        if (!detectCommandsTimeoutRef.current) {
          detectCommandsTimeoutRef.current = setTimeout(() => {
            detectCommands(updatedEditor);
            detectCommandsTimeoutRef.current = null;
          }, 50); // 50ms 防抖，确保输入流畅
        }

        // 跟踪图片使用情况（防抖，避免频繁解析 JSON）
        if (!trackImageTimeoutRef.current) {
          trackImageTimeoutRef.current = setTimeout(() => {
            trackImageUsage(updatedEditor);
            trackImageTimeoutRef.current = null;
          }, 200); // 200ms 防抖，图片跟踪不需要实时
        }
      });

      // 防抖 onChange，避免每次按键都触发更新（300ms 防抖）
      if (onChange) {
        if (onChangeTimeoutRef.current) {
          clearTimeout(onChangeTimeoutRef.current);
        }
        onChangeTimeoutRef.current = setTimeout(() => {
          // 再次检查编辑器是否仍然可用
          if (!updatedEditor || !updatedEditor.view || !updatedEditor.view.dom) {
            return;
          }
          const jsonContent = updatedEditor.getJSON();
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
          // 再次检查编辑器是否仍然可用
          if (!updatedEditor || !updatedEditor.view || !updatedEditor.view.dom) {
            return;
          }
          const text = updatedEditor.getText();
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
      // 检查编辑器是否已挂载
      if (!editor || !editor.view || !editor.view.dom || editor.isDestroyed) {
        setShowBubble(false);
        setShowImageToolbar(false);
        return;
      }

      // 清除之前的防抖定时器
      if (bubbleUpdateTimeoutRef.current) {
        clearTimeout(bubbleUpdateTimeoutRef.current);
      }
      if (imageToolbarUpdateTimeoutRef.current) {
        clearTimeout(imageToolbarUpdateTimeoutRef.current);
      }

      // 如果正在选中过程中，不立即更新，但也不完全跳过
      // 这样当选择完成时，onSelectionUpdate 会再次触发并正确显示工具栏
      if (isSelectingRef.current) {
        // 不显示工具栏，等待选择完成
        setShowBubble(false);
        setShowImageToolbar(false);
        return;
      }

      // 防抖更新，避免频繁更新导致闪动
      bubbleUpdateTimeoutRef.current = setTimeout(() => {
        // 再次检查编辑器是否仍然可用
        if (editor && editor.view && editor.view.dom) {
          updateBubbleToolbar(editor);
        }
      }, 50); // 50ms 防抖，平衡响应性和性能

      // 图片工具栏也使用防抖更新
      imageToolbarUpdateTimeoutRef.current = setTimeout(() => {
        if (editor && editor.view && editor.view.dom) {
          updateImageToolbar(editor);
        }
      }, 50);
    },
  });

  // 检测命令触发（/ 和 [[）
  const detectCommands = useCallback(
    (editor: Editor) => {
      // 检查编辑器是否已挂载且可用
      if (!editor || !editor.view || !editor.view.dom) {
        return;
      }

      try {
        const { selection } = editor.state;
        const { $anchor } = selection;
        const textBefore = $anchor.parent.textContent.slice(0, $anchor.parentOffset);

        // 检查是否输入了 [[
        const linkMatch = textBefore.match(/\[\[([^\]]*)?$/);

        if (linkMatch && !isSlashMenuOpenRef.current) {
          const query = linkMatch[1] || "";
          // 使用函数式更新，避免依赖状态
          setLinkQuery(prev => prev !== query ? query : prev);
          linkRangeRef.current = {
            from: $anchor.pos - linkMatch[0].length,
            to: $anchor.pos,
          };

          // 获取光标位置
          try {
            const coords = editor.view.coordsAtPos($anchor.pos);
            const newPos = { x: coords.left, y: coords.bottom + 8 };
            setLinkMenuPosition(prev => 
              prev.x !== newPos.x || prev.y !== newPos.y ? newPos : prev
            );
            if (!isLinkMenuOpenRef.current) {
              setIsLinkMenuOpen(true);
            }
            if (isSlashMenuOpenRef.current) {
              setIsSlashMenuOpen(false);
            }
          } catch (err) {
            console.warn("Failed to get link menu position:", err);
          }
          return;
        }

        // 如果不是 [[ 则关闭链接菜单
        if (!linkMatch && isLinkMenuOpenRef.current) {
          setIsLinkMenuOpen(false);
          linkRangeRef.current = null;
        }

        // 检查是否输入了 /
        const slashMatch = textBefore.match(/\/([a-zA-Z0-9\u4e00-\u9fa5]*)$/);

        if (slashMatch && !isLinkMenuOpenRef.current) {
          const query = slashMatch[1];
          setSlashQuery(prev => prev !== query ? query : prev);
          slashRangeRef.current = {
            from: $anchor.pos - slashMatch[0].length,
            to: $anchor.pos,
          };

          // 获取光标位置
          try {
            const coords = editor.view.coordsAtPos($anchor.pos);
            const newPos = { x: coords.left, y: coords.bottom + 8 };
            setSlashMenuPosition(prev => 
              prev.x !== newPos.x || prev.y !== newPos.y ? newPos : prev
            );
            if (!isSlashMenuOpenRef.current) {
              setIsSlashMenuOpen(true);
            }
          } catch (err) {
            console.warn("Failed to get slash menu position:", err);
          }
        } else if (!slashMatch && isSlashMenuOpenRef.current) {
          setIsSlashMenuOpen(false);
          slashRangeRef.current = null;
        }
      } catch (err) {
        // 如果编辑器在操作过程中被销毁，静默失败
        if (editor && editor.view && editor.view.dom) {
          console.warn("Error in detectCommands:", err);
        }
      }
    },
    [] // 移除所有依赖，使用函数式更新避免重新创建
  );

  // 提取图片路径的辅助函数
  const extractImagePathsFromJson = useCallback((json: any): Set<string> => {
    const images = new Set<string>();
    
    const extractImagePaths = (node: any): void => {
      if (node.type === 'image' && node.attrs?.src) {
        // 优先使用 data-relative-path 属性（如果存在）
        let relativePath: string | null = node.attrs['data-relative-path'] || null;
        
        // 如果没有 data-relative-path，尝试从 URL 中提取
        if (!relativePath) {
          const src = node.attrs.src;
          
          if (src.startsWith('http://asset.localhost/')) {
            const pathMatch = src.match(/http:\/\/asset\.localhost\/(.+)/);
            if (pathMatch) {
              relativePath = pathMatch[1];
            }
          } else if (src.startsWith('asset://')) {
            const pathMatch = src.match(/asset:\/\/(.+)/);
            if (pathMatch) {
              relativePath = pathMatch[1];
            }
          } else if (src.startsWith('data:')) {
            // Base64 图片，跳过
            return;
          } else if (src.includes('assets/')) {
            const pathMatch = src.match(/(assets\/[^"'\s]+)/);
            if (pathMatch) {
              relativePath = pathMatch[1];
            }
          }
        }
        
        if (relativePath) {
          // 规范化路径
          relativePath = relativePath.replace(/\\/g, '/');
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.slice(1);
          }
          images.add(relativePath);
        }
      }
      
      // 递归处理子节点
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(extractImagePaths);
      }
    };
    
    extractImagePaths(json);
    return images;
  }, []);

  // 跟踪图片使用情况
  const trackImageUsage = useCallback((editor: Editor) => {
    try {
      const json = editor.getJSON();
      const currentImages = extractImagePathsFromJson(json);
      imageUsageRef.current = currentImages;
    } catch (error) {
      console.error("[Image] Error tracking image usage:", error);
    }
  }, [extractImagePathsFromJson]);

  // 更新 bubble toolbar 位置的函数
  const updateBubbleToolbar = useCallback((editor: Editor) => {
    // 检查编辑器是否已挂载且可用
    if (!editor || !editor.view || !editor.view.dom || editor.isDestroyed) {
      setShowBubble(false);
      return;
    }

    try {
      const { selection } = editor.state;
      const { empty } = selection;

      // 检查选择范围内是否有特殊节点（wiki link、图片等）
      const { $from, $to } = selection;
      let hasImage = false;
      let hasWikiLink = false;
      let hasReferenceBlock = false;

      // 检查是否是节点选择（点击图片时）
      if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
        hasImage = true;
      } else {
        // 检查选择范围内是否有特殊节点
        editor.state.doc.nodesBetween($from.pos, $to.pos, (node) => {
          const nodeName = node.type.name;
          if (nodeName === 'image') {
            hasImage = true;
          } else if (nodeName === 'wikiLink') {
            hasWikiLink = true;
          } else if (nodeName === 'referenceBlock') {
            hasReferenceBlock = true;
          }
        });

        // 检查是否选中了图片节点（通过检查选区是否在图片节点内）
        if (!empty) {
          const { $anchor } = selection;
          const node = $anchor.node();
          if (node && node.type.name === 'image') {
            hasImage = true;
          }
          // 检查父节点是否是图片
          const parent = $anchor.parent;
          if (parent && parent.type.name === 'image') {
            hasImage = true;
          }
        }
      }

      // 如果选中了图片，显示图片工具栏
      if (hasImage) {
        setShowBubble(false);
        // 立即更新图片工具栏，不等待防抖
        updateImageToolbar(editor);
        return;
      } else {
        // 如果没有图片，确保隐藏图片工具栏
        setShowImageToolbar(false);
      }

      // 如果选中了其他特殊节点（wiki link、引用块等），不显示任何工具栏
      if (hasWikiLink || hasReferenceBlock) {
        setShowBubble(false);
        setShowImageToolbar(false);
        return;
      }

      // 选中文字且不是代码块时显示 bubble
      if (!empty && !editor.isActive("codeBlock")) {
        // 再次检查编辑器是否仍然可用（可能在异步操作中已被销毁）
        if (!editor.view || !editor.view.dom) {
          setShowBubble(false);
          return;
        }

        const { from, to } = selection;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);

        // 计算位置，考虑边界情况
        const editorElement = editor.view.dom.closest('.zentri-editor');
        const editorRect = editorElement?.getBoundingClientRect();
        const toolbarWidth = 450; // 估算工具栏宽度
        const toolbarHeight = 56; // 估算工具栏高度（稍微增加以确保安全）
        const verticalOffset = 12; // 工具栏与选中文字之间的间距
        const minSpaceAbove = toolbarHeight + verticalOffset + 20; // 上方需要的最小空间（增加安全边距）

        let x = (start.left + end.left) / 2;
        let y: number;
        let showAbove = true; // 默认显示在上方

        // 调整 X 位置，避免超出边界
        if (editorRect) {
          const minX = editorRect.left + toolbarWidth / 2 + 10;
          const maxX = editorRect.right - toolbarWidth / 2 - 10;
          x = Math.max(minX, Math.min(maxX, x));
        }

        // 计算可用空间（考虑视口和编辑器容器）
        const viewportTop = window.scrollY;
        const viewportBottom = window.scrollY + window.innerHeight;
        const spaceAboveViewport = start.top + window.scrollY - viewportTop;
        const spaceAboveEditor = editorRect ? start.top - editorRect.top : spaceAboveViewport;
        const spaceBelow = editorRect ? editorRect.bottom - end.bottom : viewportBottom - (end.bottom + window.scrollY);

        // 决定显示位置：优先考虑不遮挡内容
        if (spaceAboveViewport < minSpaceAbove) {
          // 视口上方空间不足，显示在下方
          showAbove = false;
          y = end.bottom + verticalOffset;
        } else if (spaceAboveEditor < minSpaceAbove) {
          // 编辑器容器上方空间不足，显示在下方
          showAbove = false;
          y = end.bottom + verticalOffset;
        } else if (spaceBelow < toolbarHeight + verticalOffset + 20 && spaceAboveViewport >= minSpaceAbove) {
          // 下方空间不足但上方足够，显示在上方
          showAbove = true;
          y = start.top - verticalOffset;
        } else {
          // 默认显示在上方（空间足够）
          showAbove = true;
          y = start.top - verticalOffset;
        }

        // 确保不会超出视口
        if (showAbove) {
          const toolbarTop = y - toolbarHeight;
          if (toolbarTop < viewportTop - window.scrollY + 10) {
            // 即使计算显示在上方，但如果会超出视口顶部，改为显示在下方
            y = end.bottom + verticalOffset;
            showAbove = false;
          }
        } else {
          const toolbarBottom = y + toolbarHeight;
          if (toolbarBottom > viewportBottom - window.scrollY - 10) {
            // 如果显示在下方会超出视口底部，尝试显示在上方
            if (spaceAboveViewport >= minSpaceAbove) {
              y = start.top - verticalOffset;
              showAbove = true;
            }
          }
        }

        // 只在位置真正变化时才更新，避免不必要的重渲染
        const newPosition = { x, y, showAbove };
        const positionChanged =
          Math.abs(newPosition.x - lastBubblePositionRef.current.x) > 5 ||
          Math.abs(newPosition.y - lastBubblePositionRef.current.y) > 5 ||
          newPosition.showAbove !== lastBubblePositionRef.current.showAbove;

        if (positionChanged || !showBubble) {
          lastBubblePositionRef.current = newPosition;
          setBubblePosition(newPosition);
        }

        setShowBubble(true);
      } else {
        setShowBubble(false);
      }
    } catch (err) {
      // 如果编辑器在操作过程中被销毁，静默失败
      if (editor && editor.view && editor.view.dom) {
        console.warn("Failed to update bubble toolbar position:", err);
      }
      setShowBubble(false);
    }
  }, [showBubble]);

  // 更新图片工具栏位置的函数
  const updateImageToolbar = useCallback((editor: Editor) => {
    // 检查编辑器是否已挂载且可用
    if (!editor || !editor.view || !editor.view.dom || editor.isDestroyed) {
      setShowImageToolbar(false);
      return;
    }

    try {
      const { selection } = editor.state;
      
      // 获取图片节点 - 多种方式检测
      let imageNode = null;
      let imagePos = 0;

      // 方式1: 检查是否是节点选择（点击图片时）
      if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
        imageNode = selection.node;
        imagePos = selection.from;
      } 
      // 方式2: 检查当前节点
      else {
        const { $anchor } = selection;
        const node = $anchor.node();
        if (node && node.type.name === 'image') {
          imageNode = node;
          imagePos = $anchor.pos;
        } 
        // 方式3: 检查父节点
        else {
          const parent = $anchor.parent;
          if (parent && parent.type.name === 'image') {
            imageNode = parent;
            imagePos = $anchor.before($anchor.depth);
          }
          // 方式4: 遍历选择范围内的节点
          else {
            const { $from, $to } = selection;
            editor.state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
              if (node.type.name === 'image') {
                imageNode = node;
                imagePos = pos;
                return false; // 停止遍历
              }
            });
          }
        }
      }

      if (!imageNode) {
        setShowImageToolbar(false);
        return;
      }

      // 获取图片在 DOM 中的位置
      const domNode = editor.view.nodeDOM(imagePos);
      if (!domNode || !(domNode instanceof HTMLElement)) {
        // 如果找不到 DOM 节点，尝试通过图片的 src 查找
        const imageSrc = imageNode.attrs.src;
        if (imageSrc) {
          const allImages = editor.view.dom.querySelectorAll('img.editor-image');
          let foundImage: HTMLElement | null = null;
          for (const img of Array.from(allImages)) {
            if ((img as HTMLImageElement).src === imageSrc || 
                (img as HTMLImageElement).getAttribute('src') === imageSrc) {
              foundImage = img as HTMLElement;
              break;
            }
          }
          if (foundImage) {
            const rect = foundImage.getBoundingClientRect();
            const toolbarHeight = 50;
            const verticalOffset = 12;
            const minSpaceAbove = toolbarHeight + verticalOffset + 20;
            const viewportTop = window.scrollY;
            const viewportBottom = window.scrollY + window.innerHeight;
            const spaceAboveViewport = rect.top + window.scrollY - viewportTop;
            const spaceBelow = viewportBottom - (rect.bottom + window.scrollY);
            
            let x = rect.left + rect.width / 2;
            let y: number;
            let showAbove = true;
            
            if (spaceAboveViewport < minSpaceAbove) {
              showAbove = false;
              y = rect.bottom + verticalOffset;
            } else if (spaceBelow < toolbarHeight + verticalOffset + 20 && spaceAboveViewport >= minSpaceAbove) {
              showAbove = true;
              y = rect.top - verticalOffset;
            } else {
              showAbove = true;
              y = rect.top - verticalOffset;
            }
            
            const newPosition = { x, y, showAbove };
            lastImageToolbarPositionRef.current = newPosition;
            setImageToolbarPosition(newPosition);
            setShowImageToolbar(true);
            return;
          }
        }
        setShowImageToolbar(false);
        return;
      }

      const rect = domNode.getBoundingClientRect();
      const toolbarHeight = 50;
      const verticalOffset = 12;
      const minSpaceAbove = toolbarHeight + verticalOffset + 20;

      let x = rect.left + rect.width / 2;
      let y: number;
      let showAbove = true;

      // 计算可用空间
      const viewportTop = window.scrollY;
      const viewportBottom = window.scrollY + window.innerHeight;
      const spaceAboveViewport = rect.top + window.scrollY - viewportTop;
      const spaceBelow = viewportBottom - (rect.bottom + window.scrollY);

      // 决定显示位置
      if (spaceAboveViewport < minSpaceAbove) {
        showAbove = false;
        y = rect.bottom + verticalOffset;
      } else if (spaceBelow < toolbarHeight + verticalOffset + 20 && spaceAboveViewport >= minSpaceAbove) {
        showAbove = true;
        y = rect.top - verticalOffset;
      } else {
        showAbove = true;
        y = rect.top - verticalOffset;
      }

      // 确保不会超出视口
      if (showAbove) {
        const toolbarTop = y - toolbarHeight;
        if (toolbarTop < viewportTop - window.scrollY + 10) {
          y = rect.bottom + verticalOffset;
          showAbove = false;
        }
      } else {
        const toolbarBottom = y + toolbarHeight;
        if (toolbarBottom > viewportBottom - window.scrollY - 10) {
          if (spaceAboveViewport >= minSpaceAbove) {
            y = rect.top - verticalOffset;
            showAbove = true;
          }
        }
      }

      // 只在位置真正变化时才更新
      const newPosition = { x, y, showAbove };
      const positionChanged =
        Math.abs(newPosition.x - lastImageToolbarPositionRef.current.x) > 5 ||
        Math.abs(newPosition.y - lastImageToolbarPositionRef.current.y) > 5 ||
        newPosition.showAbove !== lastImageToolbarPositionRef.current.showAbove;

      if (positionChanged || !showImageToolbar) {
        lastImageToolbarPositionRef.current = newPosition;
        setImageToolbarPosition(newPosition);
      }

      setShowImageToolbar(true);
    } catch (err) {
      if (editor && editor.view && editor.view.dom) {
        console.warn("Failed to update image toolbar position:", err);
      }
      setShowImageToolbar(false);
    }
  }, [showImageToolbar]);

  // 监听鼠标事件，只在松开时显示 toolbar
  useEffect(() => {
    if (!editor) return;

    // 使用 requestAnimationFrame 确保编辑器已完全渲染
    let mounted = true;
    let editorElement: HTMLElement | null = null;

    const setupListeners = () => {
      if (!mounted) return;

      // 再次检查编辑器是否已挂载
      if (!editor || editor.isDestroyed) return;

      // 安全地检查 view.dom
      try {
        if (!editor.view?.dom) {
          // 如果还没准备好，延迟再试
          requestAnimationFrame(setupListeners);
          return;
        }
        editorElement = editor.view.dom;
      } catch (err) {
        // 编辑器可能还未完全挂载，稍后重试
        requestAnimationFrame(setupListeners);
        return;
      }

      const handleMouseDown = () => {
        isSelectingRef.current = true;
        setShowBubble(false);
      };

      const handleMouseUp = () => {
        // 延迟设置 isSelectingRef 为 false，确保选择状态已稳定
        setTimeout(() => {
          isSelectingRef.current = false;
          // 鼠标松开后，检查是否有选中内容并显示 toolbar
          // 使用 requestAnimationFrame 确保 DOM 更新完成
          requestAnimationFrame(() => {
            if (editor && !editor.isDestroyed) {
              try {
                if (editor.view?.dom) {
                  // 再次延迟，确保选择状态已完全更新
                  setTimeout(() => {
                    if (editor && !editor.isDestroyed && editor.view?.dom) {
                      // 检查选择是否仍然存在
                      const { selection } = editor.state;
                      if (!selection.empty) {
                        updateBubbleToolbar(editor);
                      }
                    }
                  }, 100);
                }
              } catch {
                // 静默失败
              }
            }
          });
        }, 10);
      };

      editorElement.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);

      // 返回清理函数供组件卸载时使用
      return () => {
        if (editorElement && editorElement.parentNode) {
          editorElement.removeEventListener('mousedown', handleMouseDown);
        }
        document.removeEventListener('mouseup', handleMouseUp);
      };
    };

    // 延迟执行以确保编辑器已挂载
    const cleanup = requestAnimationFrame(() => {
      const cleanupFn = setupListeners();
      if (cleanupFn) {
        // 保存清理函数的引用
        (editor as any)._mouseCleanup = cleanupFn;
      }
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(cleanup);
      // 调用保存的清理函数
      const cleanupFn = (editor as any)?._mouseCleanup;
      if (typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, [editor, updateBubbleToolbar]);

  // 图片拖拽调整大小功能
  useEffect(() => {
    if (!editor) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let imageNode: any = null;
    let imagePos = 0;
    let imageElement: HTMLElement | null = null;

    // 创建或更新调整手柄
    const updateResizeHandles = () => {
      if (!editor || editor.isDestroyed) return;
      
      try {
        if (!editor.view?.dom) return;
      } catch (err) {
        // 编辑器可能还未完全挂载
        return;
      }

      const editorDom = editor.view.dom;
      const selectedImages = editorDom.querySelectorAll('.editor-image.ProseMirror-selectednode');
      
      // 移除所有现有的手柄和包装器
      editorDom.querySelectorAll('.image-resize-handle').forEach(handle => {
        handle.remove();
      });
      
      // 清理空的包装器
      editorDom.querySelectorAll('.editor-image-wrapper').forEach(wrapper => {
        const img = wrapper.querySelector('.editor-image');
        if (img && wrapper.parentNode) {
          wrapper.parentNode.insertBefore(img, wrapper);
          wrapper.remove();
        }
      });

      // 为每个选中的图片添加手柄
      selectedImages.forEach((image) => {
        const img = image as HTMLElement;
        
        // 检查是否已经有包装器
        let wrapper = img.parentElement;
        if (!wrapper || !wrapper.classList.contains('editor-image-wrapper')) {
          // 创建包装器
          wrapper = document.createElement('div');
          wrapper.className = 'editor-image-wrapper';
          img.parentNode?.insertBefore(wrapper, img);
          wrapper.appendChild(img);
        }

        // 检查是否已经有手柄
        if (!wrapper.querySelector('.image-resize-handle')) {
          // 创建调整手柄
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'image-resize-handle';
          wrapper.appendChild(resizeHandle);
        }
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // 检查是否点击了调整手柄
      if (target.classList.contains('image-resize-handle')) {
        e.preventDefault();
        e.stopPropagation();

        const wrapper = target.parentElement;
        const image = wrapper?.querySelector('.editor-image') as HTMLElement;
        if (!image || !wrapper) return;

        isResizing = true;
        startX = e.clientX;
        imageElement = image;

        // 获取图片节点信息
        const { selection } = editor.state;
        let naturalWidth = image.offsetWidth;
        
        // 尝试获取图片的自然宽度
        const imgElement = image as HTMLImageElement;
        if (imgElement.naturalWidth) {
          naturalWidth = imgElement.naturalWidth;
        }
        
        if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
          imageNode = selection.node;
          imagePos = selection.from;
          startWidth = imageNode.attrs.width || naturalWidth;
        } else {
          // 尝试通过 DOM 查找对应的节点
          const { $anchor } = selection;
          const node = $anchor.node();
          if (node && node.type.name === 'image') {
            imageNode = node;
            imagePos = $anchor.pos;
            startWidth = node.attrs.width || naturalWidth;
          } else {
            const parent = $anchor.parent;
            if (parent && parent.type.name === 'image') {
              imageNode = parent;
              imagePos = $anchor.before($anchor.depth);
              startWidth = parent.attrs.width || naturalWidth;
            }
          }
        }

        if (!imageNode) return;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
        return;
      }

      // 检查是否点击了图片的调整大小手柄区域（右下角）
      const image = target.closest('.editor-image.ProseMirror-selectednode') as HTMLElement;
      if (!image) return;

      const rect = image.getBoundingClientRect();
      const handleSize = 20; // 手柄区域大小
      const handleX = rect.right - handleSize;
      const handleY = rect.bottom - handleSize;

      // 检查是否点击在手柄区域内
      if (e.clientX >= handleX && e.clientX <= rect.right &&
          e.clientY >= handleY && e.clientY <= rect.bottom) {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        startX = e.clientX;
        imageElement = image;

        // 获取图片节点信息
        const { selection } = editor.state;
        let naturalWidth = image.offsetWidth;
        
        // 尝试获取图片的自然宽度
        const imgElement = image as HTMLImageElement;
        if (imgElement.naturalWidth) {
          naturalWidth = imgElement.naturalWidth;
        }
        
        if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
          imageNode = selection.node;
          imagePos = selection.from;
          startWidth = imageNode.attrs.width || naturalWidth;
        } else {
          // 尝试通过 DOM 查找对应的节点
          const { $anchor } = selection;
          const node = $anchor.node();
          if (node && node.type.name === 'image') {
            imageNode = node;
            imagePos = $anchor.pos;
            startWidth = node.attrs.width || naturalWidth;
          } else {
            const parent = $anchor.parent;
            if (parent && parent.type.name === 'image') {
              imageNode = parent;
              imagePos = $anchor.before($anchor.depth);
              startWidth = parent.attrs.width || naturalWidth;
            }
          }
        }

        if (!imageNode) return;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !imageElement || !imageNode) return;

      e.preventDefault();
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, Math.min(2000, startWidth + deltaX));

      // 实时更新图片宽度（视觉反馈）
      if (imageElement) {
        imageElement.style.width = `${newWidth}px`;
        imageElement.classList.add('resizing');
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isResizing || !imageNode) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        return;
      }

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, Math.min(2000, startWidth + deltaX));

      // 更新图片节点属性
      const { tr } = editor.state;
      const attrs = { ...imageNode.attrs };
      if (newWidth === imageElement?.offsetWidth) {
        // 如果宽度没有变化，移除宽度限制
        delete attrs.width;
      } else {
        attrs.width = newWidth;
      }

      tr.setNodeMarkup(imagePos, undefined, attrs);
      editor.view.dispatch(tr);

      // 恢复图片元素的样式
      if (imageElement) {
        imageElement.style.width = '';
        imageElement.classList.remove('resizing');
      }

      isResizing = false;
      imageNode = null;
      imagePos = 0;
      imageElement = null;

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // 使用 requestAnimationFrame 确保编辑器已完全挂载
    let cleanupFn: (() => void) | null = null;
    let mounted = true;
    
    const setupResizeHandles = () => {
      if (!mounted) return;
      if (!editor || editor.isDestroyed) return;
      
      try {
        if (!editor.view?.dom) {
          // 如果还没准备好，延迟再试
          requestAnimationFrame(setupResizeHandles);
          return;
        }
        
        const editorElement = editor.view.dom;
        editorElement.addEventListener('mousedown', handleMouseDown);
        
        // 监听选择变化，更新调整手柄
        const handleSelectionUpdate = () => {
          requestAnimationFrame(() => {
            if (mounted && editor && !editor.isDestroyed && editor.view?.dom) {
              updateResizeHandles();
            }
          });
        };
        
        editor.on('selectionUpdate', handleSelectionUpdate);
        editor.on('update', handleSelectionUpdate);
        
        // 初始更新
        requestAnimationFrame(() => {
          if (mounted && editor && !editor.isDestroyed && editor.view?.dom) {
            updateResizeHandles();
          }
        });
        
        cleanupFn = () => {
          editorElement.removeEventListener('mousedown', handleMouseDown);
          if (editor && !editor.isDestroyed) {
            editor.off('selectionUpdate', handleSelectionUpdate);
            editor.off('update', handleSelectionUpdate);
          }
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          
          // 清理所有手柄
          if (editorElement) {
            editorElement.querySelectorAll('.image-resize-handle').forEach(handle => {
              handle.remove();
            });
          }
        };
      } catch (err) {
        // 编辑器可能还未完全挂载，稍后重试
        requestAnimationFrame(setupResizeHandles);
      }
    };
    
    // 延迟启动，确保编辑器已挂载
    requestAnimationFrame(setupResizeHandles);

    return () => {
      mounted = false;
      if (cleanupFn) {
        cleanupFn();
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [editor]);

  // 图片插入函数
  const insertImage = useCallback(async () => {
    const currentEditor = editorRef.current;
    if (!currentEditor || currentEditor.isDestroyed) return;

    const relativePath = await selectAndSaveImage();
    if (relativePath) {
      try {
        const imageUrl = await getImageUrl(relativePath);
        currentEditor.chain().focus().setImage({ 
          src: imageUrl,
          'data-relative-path': relativePath 
        } as any).run();
      } catch (error) {
        console.error("Failed to insert image:", error);
      }
    }
  }, []);

  // 将图片插入函数暴露给编辑器实例（供工具栏使用）
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      (editor as any).insertImage = insertImage;
      editorRef.current = editor;
    }
  }, [editor, insertImage]);

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

  // 同步外部 content 变化（简化版：内容已经在 store 中加载完成）
  useEffect(() => {
    if (!editor || !content) return;

    // 清除之前的防抖定时器
    if (contentSyncTimeoutRef.current) {
      clearTimeout(contentSyncTimeoutRef.current);
    }

    // 防抖处理，避免频繁同步
    contentSyncTimeoutRef.current = setTimeout(() => {
      // 检查是否正在同步中，避免循环更新
      if (isContentSyncingRef.current) {
        return;
      }

      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);

      // 如果内容没有变化，跳过
      if (currentJson === newJson) {
        lastSyncedContentRef.current = newJson;
        return;
      }

      // 如果这是上次同步的内容，跳过（避免循环）
      if (newJson === lastSyncedContentRef.current) {
        return;
      }

      // 检查编辑器是否为空（仅有一个空段落）
      const isEmpty = editor.isEmpty;

      // 同步策略：
      // 1. 如果编辑器为空，总是同步
      // 2. 如果编辑器没有焦点，同步（用户可能从其他地方编辑了内容）
      const shouldSync = isEmpty || !editor.isFocused;

      if (shouldSync) {
        isContentSyncingRef.current = true;
        
        // 保存当前选区位置
        const { from } = editor.state.selection;

        editor.commands.setContent(content);

        // 如果之前是聚焦的且为空（初始加载场景），尝试恢复光标位置或移动到末尾
        if (editor.isFocused && isEmpty) {
          editor.commands.setTextSelection(Math.min(from, editor.state.doc.content.size));
        }

        // 更新最后同步的内容
        lastSyncedContentRef.current = newJson;
        
        // 重置同步标志
        setTimeout(() => {
          isContentSyncingRef.current = false;
        }, 100);
      }
    }, 300); // 300ms 防抖

    return () => {
      if (contentSyncTimeoutRef.current) {
        clearTimeout(contentSyncTimeoutRef.current);
      }
    };
  }, [content, editor]);

  // 当编辑器失去焦点时，强制同步一次（确保外部变化能够同步）
  useEffect(() => {
    if (!editor) return;

    const handleBlur = () => {
      // 延迟检查，确保内容已经更新
      setTimeout(() => {
        if (content && !isContentSyncingRef.current) {
          const currentJson = JSON.stringify(editor.getJSON());
          const newJson = JSON.stringify(content);
          
          if (currentJson !== newJson && newJson !== lastSyncedContentRef.current) {
            isContentSyncingRef.current = true;
            editor.commands.setContent(content);
            lastSyncedContentRef.current = newJson;
            setTimeout(() => {
              isContentSyncingRef.current = false;
            }, 100);
          }
        }
      }, 100);
    };

    // 监听编辑器失去焦点事件
    const editorElement = editor.view?.dom;
    if (editorElement) {
      editorElement.addEventListener('blur', handleBlur);
      return () => {
        editorElement.removeEventListener('blur', handleBlur);
      };
    }
  }, [editor, content]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (linksExtractTimeoutRef.current) {
        clearTimeout(linksExtractTimeoutRef.current);
      }
      if (onChangeTimeoutRef.current) {
        clearTimeout(onChangeTimeoutRef.current);
      }
      if (bubbleUpdateTimeoutRef.current) {
        clearTimeout(bubbleUpdateTimeoutRef.current);
      }
      if (imageToolbarUpdateTimeoutRef.current) {
        clearTimeout(imageToolbarUpdateTimeoutRef.current);
      }
      if (detectCommandsTimeoutRef.current) {
        clearTimeout(detectCommandsTimeoutRef.current);
      }
      if (trackImageTimeoutRef.current) {
        clearTimeout(trackImageTimeoutRef.current);
      }
      if (contentSyncTimeoutRef.current) {
        clearTimeout(contentSyncTimeoutRef.current);
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
        // 删除 [[query 并直接插入 wiki link 节点
        // 检查卡片是否存在（优先使用新创建的卡片信息）
        const existingCard = cards.find(c => c.id === selectedCard.id || c.title === selectedCard.title);
        const exists = !!existingCard || (createNew && !!selectedCard.id);

        const wikiLinkNode = editor.schema.nodes.wikiLink.create({
          title: selectedCard.title,
          href: selectedCard.id || selectedCard.title,
          exists: exists || !!selectedCard.id // 如果创建成功且有 ID，说明卡片存在
        });

        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent(wikiLinkNode)
          .run();
      }

      setIsLinkMenuOpen(false);
      linkRangeRef.current = null;

      // 如果是新建卡片，在编辑器操作完成后再触发回调
      // 使用 requestAnimationFrame 确保 DOM 更新完成
      if (createNew && selectedCard && onFleetingNoteCreated && selectedCard.id) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // 再次延迟，确保卡片已经保存到 store 中
            setTimeout(() => {
              onFleetingNoteCreated(selectedCard.id);
            }, 200);
          });
        });
      }
    },
    [editor, onCreateCard, cards, onFleetingNoteCreated]
  );

  // 初始化时记录初始图片集合
  useEffect(() => {
    if (content) {
      const initialImages = extractImagePathsFromJson(content);
      initialImagesRef.current = initialImages;
      imageUsageRef.current = initialImages;
      console.log(`[Image] Initial images loaded: ${initialImages.size}`);
    } else {
      initialImagesRef.current = new Set();
      imageUsageRef.current = new Set();
    }
  }, [content, extractImagePathsFromJson]);

  // 组件卸载时删除未使用的图片
  useEffect(() => {
    return () => {
      const initialImages = initialImagesRef.current;
      const currentImages = imageUsageRef.current;
      
      // 找出在初始集合中存在但在当前集合中不存在的图片（被删除的图片）
      const deletedImages: string[] = [];
      initialImages.forEach(path => {
        if (!currentImages.has(path)) {
          deletedImages.push(path);
        }
      });
      
      // 删除这些图片文件
      if (deletedImages.length > 0) {
        console.log(`[Image] Cleaning up ${deletedImages.length} unused image(s) on close`);
        deletedImages.forEach(async (path) => {
          try {
            await assets.deleteImage(path);
            console.log(`[Image] Deleted unused image: ${path}`);
          } catch (error) {
            console.error(`[Image] Failed to delete image ${path}:`, error);
          }
        });
      }
    };
  }, []);

  // 处理 slash 命令选择
  const handleSlashCommand = useCallback(
    async (command: string) => {
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
          // 使用图片选择器插入图片
          if ((editor as any).insertImage) {
            await (editor as any).insertImage();
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
      {showBubble && !isSlashMenuOpen && !isLinkMenuOpen && !showImageToolbar && (
        <div
          className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-auto"
          style={{
            left: `${bubblePosition.x}px`,
            top: `${bubblePosition.y}px`,
            transform: bubblePosition.showAbove 
              ? "translate(-50%, -100%)" 
              : "translate(-50%, 0)",
          }}
        >
          <BubbleToolbar editor={editor} onCreateFleetingNote={onCreateFleetingNote} />
        </div>
      )}

      {/* 图片工具栏 - 选中图片时显示 */}
      {showImageToolbar && !isSlashMenuOpen && !isLinkMenuOpen && (
        <div
          className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-auto"
          style={{
            left: `${imageToolbarPosition.x}px`,
            top: `${imageToolbarPosition.y}px`,
            transform: imageToolbarPosition.showAbove 
              ? "translate(-50%, -100%)" 
              : "translate(-50%, 0)",
          }}
        >
          <ImageToolbar editor={editor} />
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


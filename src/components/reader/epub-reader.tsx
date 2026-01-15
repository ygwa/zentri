import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  Plus,
  List,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileUrl } from "@/lib/file-url";
import type { Highlight, AnnotationType } from "@/types";
import { HighlightColorPicker, HIGHLIGHT_COLORS } from "./highlight-color-picker";
import { FontSelector, FONT_OPTIONS } from "./font-selector";
import { HighlightContextMenu } from "./highlight-context-menu";
import { BookmarkPanel } from "./bookmark-panel";
import { ShortcutsHelp } from "./shortcuts-help";
import * as api from "@/services/api";
import ePub, { Book, Rendition } from "epubjs";

interface EpubReaderProps {
  url: string;
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, position: string, type?: AnnotationType) => void;
  onAddToNote?: (text: string, position: string) => void;
  onProgress?: (progress: number) => void;
  onProgressCfi?: (progress: number, cfi: string) => void;
  onColorChange?: (color: string) => void;
  onPageChange?: (page: number, totalPages: number) => void;
  initialProgress?: number;
  initialCfi?: string;
  onHighlightUpdate?: (id: string, updates: { note?: string; color?: string }) => void;
  onHighlightDelete?: (id: string) => void;
  onBookmarkAdd?: (position: string) => void;
  className?: string;
}

export function EpubReader({
  url,
  sourceId,
  sourceTitle,
  highlights = [],
  onHighlight,
  onAddToNote,
  onProgress,
  onProgressCfi,
  onColorChange,
  initialProgress,
  initialCfi,
  onPageChange,
  onHighlightUpdate,
  onHighlightDelete,
  onBookmarkAdd,
  className,
}: EpubReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const initializingRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fontSize, setFontSize] = useState(100);
  const [fontFamily, setFontFamily] = useState<string>(FONT_OPTIONS[0].fontFamily);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    cfi: string;
    range?: Range;
    position?: { x: number; y: number };
  } | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(
    HIGHLIGHT_COLORS[0].color
  );
  const [selectedAnnotationType, setSelectedAnnotationType] = useState<AnnotationType>("highlight");
  const [selectedHighlight, setSelectedHighlight] = useState<{
    highlight: Highlight;
    position: { x: number; y: number };
  } | null>(null);

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const onProgressCfiRef = useRef(onProgressCfi);
  onProgressCfiRef.current = onProgressCfi;

  // 防抖的进度保存
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedProgressSave = useCallback((progressValue: number, cfi?: string) => {
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }
    progressTimeoutRef.current = setTimeout(() => {
      if (onProgressRef.current) {
        onProgressRef.current(progressValue);
      }
      if (cfi && onProgressCfiRef.current) {
        onProgressCfiRef.current(progressValue, cfi);
      }
    }, 500);
  }, []);

  // 监听 initialProgress 和 initialCfi 变化
  const prevInitialProgressRef = useRef(initialProgress);
  const prevInitialCfiRef = useRef(initialCfi);
  useEffect(() => {
    if (!renditionRef.current) return;

    const progressChanged = initialProgress !== undefined && initialProgress !== prevInitialProgressRef.current;
    const cfiChanged = initialCfi !== undefined && initialCfi !== prevInitialCfiRef.current;

    if (progressChanged || cfiChanged) {
      prevInitialProgressRef.current = initialProgress;
      prevInitialCfiRef.current = initialCfi;

      try {
        // 验证进度值范围
        if (initialProgress !== undefined && (initialProgress < 0 || initialProgress > 100)) {
          console.warn(`Invalid progress value: ${initialProgress}, must be 0-100`);
          return;
        }

        if (initialCfi && typeof initialCfi === 'string' && initialCfi.toLowerCase().startsWith('epubcfi')) {
          // 优先使用 CFI（更精确）
          renditionRef.current.display(initialCfi);
        } else if (initialProgress !== undefined && initialProgress >= 0 && initialProgress <= 100) {
          // 使用百分比进度
          const book = bookRef.current;
          if (book) {
            const spine = book.spine;
            const total = (spine as any).length || 0;
            if (total > 0) {
              const targetIndex = Math.floor((initialProgress / 100) * total);
              const targetItem = spine.get(targetIndex);
              if (targetItem) {
                renditionRef.current.display(targetItem.href);
              } else {
                console.warn(`Invalid target index ${targetIndex} for progress ${initialProgress}%`);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to jump to progress:", err);
        // 静默失败，不显示错误给用户（进度恢复失败不影响阅读）
      }
    }
  }, [initialProgress, initialCfi]);

  // 初始化阅读器
  useEffect(() => {
    if (!containerRef.current || !url) return;

    if (initializingRef.current || currentUrlRef.current === url) {
      return;
    }

    let isMounted = true;
    initializingRef.current = true;
    currentUrlRef.current = url;

    const initReader = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 清理旧实例
        if (renditionRef.current) {
          renditionRef.current.destroy();
          renditionRef.current = null;
        }
        if (bookRef.current) {
          bookRef.current.destroy();
          bookRef.current = null;
        }

        if (!containerRef.current || !isMounted) return;

        // 加载文件
        let fileOrUrl: File | string | ArrayBuffer;
        const isRelativePath = url &&
          !url.startsWith("http") &&
          !url.startsWith("asset://") &&
          !url.startsWith("file://") &&
          !url.startsWith("/") &&
          !url.startsWith("tauri://") &&
          !url.startsWith("blob:");

        if (isRelativePath) {
          // 相对路径，使用 Rust 后端读取文件
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            const fileData = await invoke<number[]>("read_book_file", { relativePath: url });
            const arrayBuffer = new Uint8Array(fileData).buffer;
            fileOrUrl = arrayBuffer;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("Failed to read file from Rust backend:", err);
            // 提供更友好的错误消息
            if (errorMessage.includes("not found") || errorMessage.includes("No such file")) {
              throw new Error(`文件未找到: ${url}`);
            } else if (errorMessage.includes("permission") || errorMessage.includes("Permission")) {
              throw new Error(`没有权限访问文件: ${url}`);
            } else {
              throw new Error(`无法加载 EPUB 文件: ${errorMessage}`);
            }
          }
        } else {
          // 绝对路径或 URL
          try {
            const fileUrl = await getFileUrl(url);
            fileOrUrl = fileUrl;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("Failed to get file URL:", err);
            throw new Error(`无法获取文件 URL: ${errorMessage}`);
          }
        }

        // 创建 Book 实例
        const book = ePub(fileOrUrl);
        bookRef.current = book;

        await book.ready;

        if (!isMounted || !containerRef.current) return;

        // 获取目录
        if (book.navigation) {
          const tocItems: { label: string; href: string }[] = [];
          const processToc = (items: any[]) => {
            for (const item of items) {
              tocItems.push({
                label: item.label || "",
                href: item.href || "",
              });
              if (item.subitems) {
                processToc(item.subitems);
              }
            }
          };
          processToc(book.navigation.toc);
          setToc(tocItems);
        }

        // 创建 Rendition
        const rendition = book.renderTo(containerRef.current, {
          width: "100%",
          height: "100%",
          spread: "none",
        });
        renditionRef.current = rendition;

        // 设置字体样式
        rendition.themes.default({
          "body": {
            "font-family": fontFamily,
            "font-size": `${fontSize}%`,
          },
        });

        // 监听位置变化
        rendition.on("relocated", (location: any) => {
          if (!isMounted) return;

          const cfi = location.start.cfi;
          setCurrentCfi(cfi);

          // 计算进度
          const book = bookRef.current;
          if (book) {
            const spine = book.spine;
            const total = (spine as any).length || 0;
            const current = location.start.index;
            const percent = Math.round((current / total) * 100);
            setProgress(percent);
            debouncedProgressSave(percent, cfi);

            if (onPageChange) {
              onPageChange(percent, 100);
            }
          }
        });

        // 监听渲染完成
        rendition.on("rendered", (_section: any) => {
          if (!isMounted) return;

          // 应用高亮（带验证和错误处理）
          let failedHighlights = 0;
          highlights.forEach((h) => {
            const cfi = h.position?.cfi;
            if (cfi && typeof cfi === "string" && cfi.toLowerCase().startsWith("epubcfi")) {
              try {
                const type = h.type === "underline" ? "underline" : "highlight";
                rendition.annotations.add(type, cfi, {}, () => {}, "hl", {
                  fill: h.color || selectedHighlightColor,
                  "fill-opacity": "0.4",
                });
              } catch (err) {
                failedHighlights++;
                console.warn(`Failed to restore highlight ${h.id}:`, err);
                // 记录失败的高亮，但不阻止其他高亮显示
              }
            } else if (cfi) {
              // CFI 格式无效
              failedHighlights++;
              console.warn(`Invalid CFI format for highlight ${h.id}: ${cfi}`);
            }
          });

          // 如果有高亮恢复失败，记录但不显示错误（避免干扰用户体验）
          if (failedHighlights > 0) {
            console.warn(`${failedHighlights} highlight(s) could not be restored`);
          }

          setIsLoading(false);
        });

        // 监听文本选择
        rendition.on("selected", (cfiRange: string, contents: any) => {
          if (!isMounted) return;

          const text = contents.window.getSelection().toString().trim();
          if (text) {
            const range = contents.window.getSelection().getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const containerRect = containerRef.current?.getBoundingClientRect();

            let position: { x: number; y: number } | undefined;
            if (containerRect) {
              position = {
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top,
              };
            }

            setSelectedText({
              text,
              cfi: cfiRange,
              range,
              position,
            });
          } else {
            setSelectedText(null);
          }
        });

        // 监听高亮点击
        rendition.on("annotations", (_type: string, cfi: string, _data: any, section: any) => {
          if (!isMounted) return;

          const highlight = highlights.find((h) => h.position?.cfi === cfi);
          if (highlight) {
            const rect = section.getBoundingClientRect();
            const containerRect = containerRef.current?.getBoundingClientRect();

            let position: { x: number; y: number } | undefined;
            if (containerRect) {
              position = {
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top,
              };
            }

            if (position) {
              setSelectedHighlight({ highlight, position });
            }
          }
        });

        // 开始渲染
        if (initialCfi) {
          rendition.display(initialCfi);
        } else if (initialProgress !== undefined) {
          const spine = book.spine;
          const total = (spine as any).length || 0;
          const targetIndex = Math.floor((initialProgress / 100) * total);
          const targetItem = spine.get(targetIndex);
          if (targetItem) {
            rendition.display(targetItem.href);
          } else {
            rendition.display();
          }
        } else {
          rendition.display();
        }

        initializingRef.current = false;
      } catch (err) {
        console.error("Failed to load EPUB:", err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // 确保错误消息对用户友好
          setError(errorMessage || "无法加载 EPUB 文件");
          setIsLoading(false);
        }
        initializingRef.current = false;
      }
    };

    initReader();

    return () => {
      isMounted = false;

      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
      currentUrlRef.current = null;
      initializingRef.current = false;

      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, [url, fontFamily, fontSize, highlights, selectedHighlightColor, initialProgress, initialCfi, debouncedProgressSave, onPageChange]);

  // 更新字体大小和字体
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.default({
        "body": {
          "font-family": fontFamily,
          "font-size": `${fontSize}%`,
        },
      });
      (renditionRef.current.themes as any).update({ 
  "font-size": `${fontSize}px`,
  "font-family": fontFamily 
});
    }
  }, [fontSize, fontFamily]);

  // 翻页
  const goNext = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const goPrev = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  // 跳转到目录项
  const goToToc = useCallback(
    async (href: string) => {
      if (!renditionRef.current) return;
      try {
        setShowToc(false);
        renditionRef.current.display(href);
      } catch (err) {
        console.error("Failed to navigate to TOC item:", err);
      }
    },
    []
  );

  // 高亮选中文本
  const highlightSelected = useCallback(
    async (color?: string, type?: AnnotationType) => {
      if (!selectedText || !renditionRef.current) return;

      const highlightColor = color || selectedHighlightColor;
      const annotationType = type || selectedAnnotationType;
      const cfi = selectedText.cfi;

      try {
        const finalType = annotationType === "underline" ? "underline" : "highlight";
        renditionRef.current.annotations.add(finalType, cfi, {}, () => {}, "hl", {
          fill: highlightColor,
          "fill-opacity": "0.4",
        });

        onHighlight?.(selectedText.text, cfi, annotationType);
        setSelectedText(null);
      } catch (err) {
        console.error("Failed to add highlight:", err);
      }
    },
    [selectedText, onHighlight, selectedHighlightColor, selectedAnnotationType]
  );

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" ||
          (e.target as HTMLElement)?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if ((e.key === "b" || e.key === "B") && !e.shiftKey) {
        if (sourceId && currentCfi && onBookmarkAdd) {
          e.preventDefault();
          (async () => {
            try {
              if (api.isTauriEnv()) {
                await api.bookmarks.create({
                  sourceId,
                  position: currentCfi,
                });
                onBookmarkAdd(currentCfi);
              }
            } catch (err) {
              console.error("Failed to create bookmark:", err);
            }
          })();
        }
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setShowToc(prev => !prev);
      } else if ((e.key === "b" || e.key === "B") && e.shiftKey) {
        e.preventDefault();
        setShowBookmarks(prev => !prev);
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsHelp(true);
      } else if (e.key === "Escape") {
        setShowToc(false);
        setShowBookmarks(false);
        setShowShortcutsHelp(false);
        setSelectedHighlight(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, sourceId, currentCfi, onBookmarkAdd]);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowToc(!showToc)}
          >
            <List className="h-4 w-4" />
          </Button>
          <FontSelector
            selectedFont={fontFamily}
            onFontSelect={(fontFamily) => {
              setFontFamily(fontFamily);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setFontSize((s) => Math.max(80, s - 10))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{fontSize}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setFontSize((s) => Math.min(150, s + 10))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">{progress}%</div>
      </div>

      {/* 目录面板 */}
      {showToc && (
        <div className="absolute top-10 left-0 bottom-0 w-64 bg-background border-r z-10 overflow-auto">
          <div className="p-3 border-b font-medium text-sm">目录</div>
          <div className="p-2">
            {toc.map((item, i) => (
              <button
                key={i}
                onClick={() => goToToc(item.href)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded truncate"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 书签面板 */}
      {showBookmarks && sourceId && (
        <div className="absolute top-10 right-0 bottom-0 w-64 bg-background border-l z-10">
          <BookmarkPanel
            sourceId={sourceId}
            onNavigate={(position) => {
              if (renditionRef.current) {
                renditionRef.current.display(position);
              }
            }}
          />
        </div>
      )}

      {/* 阅读区域 */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        )}
        <div ref={containerRef} className="h-full" />

        {/* 翻页按钮 */}
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-12 h-20 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg transition-all opacity-0 hover:opacity-100 group"
          aria-label="上一页"
        >
          <ChevronLeft className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-12 h-20 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg transition-all opacity-0 hover:opacity-100 group"
          aria-label="下一页"
        >
          <ChevronRight className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* 选中文本工具栏 */}
      {selectedText && (
        <div
          className="absolute bg-popover border rounded-lg shadow-xl p-2.5 flex items-center gap-2 z-50 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-200"
          style={
            selectedText.position
              ? (() => {
                  const containerWidth = containerRef.current?.offsetWidth || 400;
                  const popupHeight = 60;
                  const spaceAbove = selectedText.position.y;

                  if (spaceAbove > popupHeight + 20) {
                    return {
                      left: `${Math.max(150, Math.min(selectedText.position.x, containerWidth - 150))}px`,
                      top: `${Math.max(10, selectedText.position.y - popupHeight - 10)}px`,
                      transform: "translateX(-50%)",
                    };
                  } else {
                    return {
                      left: `${Math.max(150, Math.min(selectedText.position.x, containerWidth - 150))}px`,
                      top: `${Math.min(
                        (containerRef.current?.offsetHeight || 600) - popupHeight - 10,
                        selectedText.position.y + 40
                      )}px`,
                      transform: "translateX(-50%)",
                    };
                  }
                })()
              : {
                  bottom: "80px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }
          }
        >
          <div
            className="cursor-grab hover:bg-blue-50 hover:border-blue-200 border border-transparent p-1.5 rounded active:cursor-grabbing transition-all flex items-center gap-1.5 group/drag"
            draggable
            onDragStart={(e) => {
              if (sourceId) {
                e.dataTransfer.setData(
                  "application/x-zentri-reference",
                  JSON.stringify({
                    sourceId,
                    sourceTitle: sourceTitle || "EPUB",
                    text: selectedText.text,
                    cfi: selectedText.cfi,
                    type: "epub",
                  })
                );
                e.dataTransfer.effectAllowed = "copy";
              }
            }}
            title="拖拽到编辑器以创建引用"
          >
            <GripVertical className="h-4 w-4 text-blue-600 group-hover/drag:text-blue-700" />
            <span className="text-[10px] font-medium text-blue-600 group-hover/drag:text-blue-700 hidden sm:inline">拖拽</span>
          </div>

          <div className="px-1 border-l border-r border-border">
            <HighlightColorPicker
              selectedColor={selectedHighlightColor}
              selectedType={selectedAnnotationType}
              onColorSelect={(color) => {
                setSelectedHighlightColor(color);
                onColorChange?.(color);
              }}
              onTypeSelect={(type) => {
                setSelectedAnnotationType(type);
              }}
              showTypeSelector={true}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={() => highlightSelected()}
          >
            <Highlighter className="h-3.5 w-3.5" style={{ color: selectedHighlightColor }} />
            高亮
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={() => {
              highlightSelected();
              onAddToNote?.(selectedText.text, selectedText.cfi);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            笔记
          </Button>
        </div>
      )}

      {/* 高亮上下文菜单 */}
      {selectedHighlight && (
        <HighlightContextMenu
          highlight={selectedHighlight.highlight}
          position={selectedHighlight.position}
          onEdit={(id, note) => {
            onHighlightUpdate?.(id, { note });
            setSelectedHighlight(null);
          }}
          onDelete={(id) => {
            onHighlightDelete?.(id);
            if (renditionRef.current && selectedHighlight.highlight.position?.cfi) {
              renditionRef.current.annotations.remove(selectedHighlight.highlight.position.cfi, "highlight");
              renditionRef.current.annotations.remove(selectedHighlight.highlight.position.cfi, "underline");
            }
            setSelectedHighlight(null);
          }}
          onColorChange={(id, color) => {
            onHighlightUpdate?.(id, { color });
            if (renditionRef.current && selectedHighlight.highlight.position?.cfi) {
              const cfi = selectedHighlight.highlight.position.cfi;
              renditionRef.current.annotations.remove(cfi, "highlight");
              renditionRef.current.annotations.remove(cfi, "underline");
              const type = selectedHighlight.highlight.type === "underline" ? "underline" : "highlight";
              renditionRef.current.annotations.add(type, cfi, {}, () => {}, "hl", {
                fill: color,
                "fill-opacity": "0.4",
              });
            }
          }}
          onClose={() => setSelectedHighlight(null)}
        />
      )}

      {/* 快捷键帮助 */}
      {showShortcutsHelp && (
        <ShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />
      )}

      {/* 进度条 */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}


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
import type { Highlight, AnnotationType, PdfRect } from "@/types";
import { HighlightColorPicker, HIGHLIGHT_COLORS } from "./highlight-color-picker";
import { HighlightContextMenu } from "./highlight-context-menu";
import { BookmarkPanel } from "./bookmark-panel";
import { ShortcutsHelp } from "./shortcuts-help";

import * as pdfjsLib from "pdfjs-dist";

// 设置 PDF.js worker（延迟初始化，在组件挂载时设置）
let workerInitialized = false;

function initializePdfWorker() {
  if (workerInitialized || typeof window === "undefined") {
    return;
  }

  try {
    // 检查 GlobalWorkerOptions 是否存在
    if (pdfjsLib.GlobalWorkerOptions) {
      // 使用 public 目录中的 worker 文件
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      workerInitialized = true;
    }
  } catch (err) {
    console.error("Failed to initialize PDF.js worker:", err);
  }
}

interface PdfReaderProps {
  url: string;
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, position: number, type?: AnnotationType, rects?: Array<{ x: number; y: number; width: number; height: number }>) => void;
  onAddToNote?: (text: string, position: number) => void;
  onProgress?: (progress: number) => void;
  onPageChange?: (page: number, totalPages: number) => void;
  currentPage?: number;
  onHighlightUpdate?: (id: string, updates: { note?: string; color?: string }) => void;
  onHighlightDelete?: (id: string) => void;
  onBookmarkAdd?: (position: number) => void;
  className?: string;
}

export function PdfReader({
  url,
  sourceId,
  sourceTitle,
  highlights = [],
  onHighlight,
  onAddToNote,
  onProgress,
  onPageChange,
  currentPage,
  onHighlightUpdate,
  onHighlightDelete,
  onBookmarkAdd,
  className,
}: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pageNumRef = useRef(1);
  const scaleRef = useRef(1.5);
  const initializingRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    page: number;
    rects: PdfRect[];
    position?: { x: number; y: number };
  } | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [outline, setOutline] = useState<any[]>([]);
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

  // 防抖的进度保存
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedProgressSave = useCallback((progressValue: number) => {
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }
    progressTimeoutRef.current = setTimeout(() => {
      if (onProgressRef.current) {
        onProgressRef.current(progressValue);
      }
    }, 500);
  }, []);

  // 监听 currentPage 变化
  const prevCurrentPageRef = useRef(currentPage);
  useEffect(() => {
    if (currentPage !== undefined && currentPage !== prevCurrentPageRef.current && pdfDocRef.current) {
      // 验证进度值范围
      if (currentPage < 0 || currentPage > 100) {
        console.warn(`Invalid progress value: ${currentPage}, must be 0-100`);
        return;
      }

      prevCurrentPageRef.current = currentPage;
      if (numPages > 0) {
        const targetPage = Math.max(1, Math.min(numPages, Math.ceil((currentPage / 100) * numPages)));
        if (targetPage !== pageNum) {
          pageNumRef.current = targetPage;
          setPageNum(targetPage);
          renderPage(targetPage);
        }
      }
    }
  }, [currentPage, numPages, pageNum, renderPage]);

  // 渲染页面
  const renderPage = useCallback(async (pageNumber: number) => {
    if (!pdfDocRef.current || !canvasRef.current || !overlayRef.current) return;

    try {
      const pdfDoc = pdfDocRef.current;
      const page = await pdfDoc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const viewport = page.getViewport({ scale: scaleRef.current });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // 渲染 PDF 页面
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      await page.render(renderContext).promise;

      // 更新 overlay 尺寸
      overlayRef.current.setAttribute("width", viewport.width.toString());
      overlayRef.current.setAttribute("height", viewport.height.toString());

      // 渲染高亮
      renderHighlights(pageNumber, viewport);

      // 更新进度
      const progress = Math.round((pageNumber / numPages) * 100);
      debouncedProgressSave(progress);
      if (onPageChange) {
        onPageChange(progress, 100);
      }
    } catch (err) {
      console.error("Failed to render page:", err);
    }
  }, [numPages, debouncedProgressSave, onPageChange]);

  // 渲染高亮
  const renderHighlights = useCallback((pageNumber: number, viewport: any) => {
    if (!overlayRef.current) return;

    const svg = overlayRef.current;
    // 清空现有高亮
    svg.innerHTML = "";

    // 渲染该页面的高亮（带验证和错误处理）
    let failedHighlights = 0;
    highlights.forEach((h) => {
      if (h.position?.page === pageNumber) {
        if (h.position.rects && h.position.rects.length > 0) {
          // 有完整的 rects 数据，可以正确渲染
          h.position.rects.forEach((rect) => {
            // 验证 rect 数据有效性
            if (
              typeof rect.x !== 'number' || typeof rect.y !== 'number' ||
              typeof rect.width !== 'number' || typeof rect.height !== 'number' ||
              rect.x < 0 || rect.x > 1 || rect.y < 0 || rect.y > 1 ||
              rect.width <= 0 || rect.width > 1 || rect.height <= 0 || rect.height > 1
            ) {
              console.warn(`Invalid rect data for highlight ${h.id}:`, rect);
              failedHighlights++;
              return;
            }

            const rectElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rectElement.setAttribute("x", (rect.x * viewport.width).toString());
            rectElement.setAttribute("y", (rect.y * viewport.height).toString());
            rectElement.setAttribute("width", (rect.width * viewport.width).toString());
            rectElement.setAttribute("height", (rect.height * viewport.height).toString());
            
            if (h.type === "underline") {
              rectElement.setAttribute("fill", "none");
              rectElement.setAttribute("stroke", h.color || selectedHighlightColor);
              rectElement.setAttribute("stroke-width", "2");
              rectElement.setAttribute("stroke-dasharray", "none");
            } else {
              rectElement.setAttribute("fill", h.color || selectedHighlightColor);
              rectElement.setAttribute("fill-opacity", "0.4");
            }
            
            rectElement.setAttribute("data-highlight-id", h.id);
            rectElement.style.cursor = "pointer";
            rectElement.addEventListener("click", (e) => {
              e.stopPropagation();
              const rect = rectElement.getBoundingClientRect();
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (containerRect) {
                setSelectedHighlight({
                  highlight: h,
                  position: {
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top,
                  },
                });
              }
            });
            
            svg.appendChild(rectElement);
          });
        } else {
          // 缺少 rects 数据，无法正确渲染
          failedHighlights++;
          console.warn(`Highlight ${h.id} missing rects data - cannot restore on page ${pageNumber}`);
        }
      }
    });

    // 如果有高亮恢复失败，记录但不显示错误（避免干扰用户体验）
    if (failedHighlights > 0) {
      console.warn(`${failedHighlights} highlight(s) could not be restored on page ${pageNumber}`);
    }
  }, [highlights, selectedHighlightColor]);

  // 初始化阅读器
  useEffect(() => {
    if (!containerRef.current || !url) return;

    if (initializingRef.current || currentUrlRef.current === url) {
      return;
    }

    // 初始化 PDF.js worker
    initializePdfWorker();

    let isMounted = true;
    initializingRef.current = true;
    currentUrlRef.current = url;

    const initReader = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 加载文件
        let fileOrUrl: string | ArrayBuffer | Uint8Array;
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
            fileOrUrl = new Uint8Array(fileData);
          } catch (err) {
            console.error("Failed to read file from Rust backend:", err);
            throw new Error(`Failed to load PDF file: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          // 绝对路径或 URL
          const fileUrl = await getFileUrl(url);
          fileOrUrl = fileUrl;
        }

        // 加载 PDF 文档
        const loadingTask = pdfjsLib.getDocument(fileOrUrl);
        const pdfDoc = await loadingTask.promise;
        pdfDocRef.current = pdfDoc;

        if (!isMounted || !containerRef.current) return;

        const totalPages = pdfDoc.numPages;
        setNumPages(totalPages);
        pageNumRef.current = currentPage ? Math.ceil((currentPage / 100) * totalPages) : 1;
        setPageNum(pageNumRef.current);

        // 获取目录
        const pdfOutline = await pdfDoc.getOutline();
        setOutline(pdfOutline || []);

        // 渲染第一页
        await renderPage(pageNumRef.current);

        setIsLoading(false);
        initializingRef.current = false;
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // 确保错误消息对用户友好
          setError(errorMessage || "无法加载 PDF 文件");
          setIsLoading(false);
        }
        initializingRef.current = false;
      }
    };

    initReader();

    return () => {
      isMounted = false;
      pdfDocRef.current = null;
      currentUrlRef.current = null;
      initializingRef.current = false;

      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, [url, renderPage, currentPage]);

  // 当高亮变化时重新渲染
  useEffect(() => {
    if (pdfDocRef.current && !isLoading) {
      renderPage(pageNum);
    }
  }, [highlights, pageNum, renderPage, isLoading]);

  // 翻页
  const goNext = useCallback(() => {
    if (pageNum < numPages) {
      const nextPage = pageNum + 1;
      pageNumRef.current = nextPage;
      setPageNum(nextPage);
      renderPage(nextPage);
    }
  }, [pageNum, numPages, renderPage]);

  const goPrev = useCallback(() => {
    if (pageNum > 1) {
      const prevPage = pageNum - 1;
      pageNumRef.current = prevPage;
      setPageNum(prevPage);
      renderPage(prevPage);
    }
  }, [pageNum, renderPage]);

  // 缩放
  const zoomIn = useCallback(() => {
    scaleRef.current = Math.min(3, scaleRef.current + 0.25);
    renderPage(pageNum);
  }, [pageNum, renderPage]);

  const zoomOut = useCallback(() => {
    scaleRef.current = Math.max(0.5, scaleRef.current - 0.25);
    renderPage(pageNum);
  }, [pageNum, renderPage]);

  // 跳转到目录项
  const goToOutline = useCallback(
    async (dest: any) => {
      if (!pdfDocRef.current) return;
      try {
        setShowToc(false);
        const destArray = await pdfDocRef.current.getDestination(dest);
        const pageIndex = await pdfDocRef.current.getPageIndex(destArray[0]);
        const targetPage = pageIndex + 1;
        pageNumRef.current = targetPage;
        setPageNum(targetPage);
        renderPage(targetPage);
      } catch (err) {
        console.error("Failed to navigate to outline item:", err);
      }
    },
    [renderPage]
  );

  // 处理文本选择
  const handleTextSelection = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectedText(null);
      return;
    }

    const selectedTextStr = selection.toString().trim();
    if (!selectedTextStr) {
      setSelectedText(null);
      return;
    }

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      await page.getTextContent();
      const viewport = page.getViewport({ scale: scaleRef.current });

      // 获取选中文本的边界框
      const rects: PdfRect[] = [];
      const range = selection.getRangeAt(0);
      const containerRect = containerRef.current?.getBoundingClientRect();

      // 简化处理：使用选择范围的边界框
      const rangeRect = range.getBoundingClientRect();
      if (containerRect) {
        const x = (rangeRect.left - containerRect.left) / viewport.width;
        const y = (rangeRect.top - containerRect.top) / viewport.height;
        const width = rangeRect.width / viewport.width;
        const height = rangeRect.height / viewport.height;

        rects.push({ x, y, width, height });

        let position: { x: number; y: number } | undefined;
        position = {
          x: rangeRect.left - containerRect.left + rangeRect.width / 2,
          y: rangeRect.top - containerRect.top,
        };

        setSelectedText({
          text: selectedTextStr,
          page: pageNum,
          rects,
          position,
        });
      }
    } catch (err) {
      console.error("Failed to process text selection:", err);
    }
  }, [pageNum]);

  // 监听文本选择
  useEffect(() => {
    document.addEventListener("selectionchange", handleTextSelection);
    return () => {
      document.removeEventListener("selectionchange", handleTextSelection);
    };
  }, [handleTextSelection]);

  // 高亮选中文本
  const highlightSelected = useCallback(
    async (_color?: string, type?: AnnotationType) => {
      if (!selectedText || !pdfDocRef.current) return;

      const annotationType = type || selectedAnnotationType;

      // 传递完整的 PDF 位置数据，包括页码和矩形坐标
      // rects 已经归一化到 0-1 范围，确保在不同缩放级别下都能正确显示
      if (selectedText.rects && selectedText.rects.length > 0) {
        onHighlight?.(selectedText.text, selectedText.page, annotationType, selectedText.rects);
      } else {
        // 如果没有 rects，仍然创建高亮但记录警告
        console.warn('PDF highlight created without rects - restoration may fail');
        onHighlight?.(selectedText.text, selectedText.page, annotationType);
      }
      setSelectedText(null);
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
        if (sourceId && onBookmarkAdd) {
          e.preventDefault();
          onBookmarkAdd(pageNum);
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
  }, [goNext, goPrev, sourceId, pageNum, onBookmarkAdd]);

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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(scaleRef.current * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {pageNum} / {numPages}
        </div>
      </div>

      {/* 目录面板 */}
      {showToc && (
        <div className="absolute top-10 left-0 bottom-0 w-64 bg-background border-r z-10 overflow-auto">
          <div className="p-3 border-b font-medium text-sm">目录</div>
          <div className="p-2">
            {outline.map((item, i) => (
              <button
                key={i}
                onClick={() => goToOutline(item.dest)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded truncate"
              >
                {item.title}
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
              const targetPage = parseInt(position);
              if (!isNaN(targetPage)) {
                pageNumRef.current = targetPage;
                setPageNum(targetPage);
                renderPage(targetPage);
              }
            }}
          />
        </div>
      )}

      {/* 阅读区域 */}
      <div className="flex-1 relative overflow-auto" ref={containerRef}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        )}
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          <svg
            ref={overlayRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ pointerEvents: "auto" }}
          />
        </div>

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

                  return {
                    left: `${Math.max(150, Math.min(selectedText.position.x, containerWidth - 150))}px`,
                    top: `${Math.max(10, selectedText.position.y - popupHeight - 10)}px`,
                    transform: "translateX(-50%)",
                  };
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
                    sourceTitle: sourceTitle || "PDF",
                    text: selectedText.text,
                    page: selectedText.page,
                    type: "pdf",
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
              onAddToNote?.(selectedText.text, selectedText.page);
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
            renderPage(pageNum);
            setSelectedHighlight(null);
          }}
          onColorChange={(id, color) => {
            onHighlightUpdate?.(id, { color });
            renderPage(pageNum);
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
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.round((pageNum / numPages) * 100)}%` }}
        />
      </div>
    </div>
  );
}


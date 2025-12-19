import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  Plus,
  RotateCw,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileUrl } from "@/lib/file-url";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Highlight, PdfRect } from "@/types";
import { HighlightColorPicker, HIGHLIGHT_COLORS } from "./highlight-color-picker";
import { FontSelector, FONT_OPTIONS } from "./font-selector";

// 设置 worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfReaderProps {
  url: string;
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, page: number, rects: PdfRect[]) => void;
  onAddToNote?: (text: string, page: number, rects: PdfRect[]) => void;
  onProgress?: (progress: number) => void;
  onColorChange?: (color: string) => void;
  onPageChange?: (page: number, totalPages: number) => void; // 页码变化回调
  initialPage?: number; // 初始页码
  className?: string;
}

interface TextSelection {
  text: string;
  page: number;
  rects: DOMRect[];
}

export function PdfReader({
  url,
  sourceId,
  sourceTitle,
  highlights = [],
  onHighlight,
  onAddToNote,
  onProgress,
  onColorChange,
  onPageChange,
  initialPage,
  className,
}: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const highlightLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [totalPages, setTotalPages] = useState(0);
  
  // 监听 initialPage 变化，实现外部控制翻页
  const prevInitialPageRef = useRef(initialPage);
  useEffect(() => {
    if (initialPage && initialPage !== prevInitialPageRef.current && initialPage >= 1 && initialPage <= totalPages && initialPage !== currentPage) {
      prevInitialPageRef.current = initialPage;
      const newPage = Math.max(1, Math.min(totalPages, initialPage));
      setCurrentPage(newPage);
      setPageInput(String(newPage));
      
      // 立即通知父组件页码变化
      if (onPageChange && totalPages > 0) {
        onPageChange(newPage, totalPages);
      }
      
      // 立即更新进度显示
      if (totalPages > 0) {
        const progress = Math.round((newPage / totalPages) * 100);
        onProgress?.(progress);
      }
    } else if (initialPage) {
      prevInitialPageRef.current = initialPage;
    }
  }, [initialPage, totalPages, currentPage, onPageChange, onProgress]);
  const [scale, setScale] = useState(1.2);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [pageInput, setPageInput] = useState("1");
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(
    HIGHLIGHT_COLORS[0].color
  );
  const [fontFamily, setFontFamily] = useState<string>(FONT_OPTIONS[0].fontFamily);
  const progressUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载 PDF
  useEffect(() => {
    if (!url) return;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 转换本地文件路径为可访问的 URL
        const fileUrl = await getFileUrl(url);
        console.log("Loading PDF from:", fileUrl);

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdfDoc = await loadingTask.promise;
        
        setPdf(pdfDoc);
        const total = pdfDoc.numPages;
        setTotalPages(total);
        
        // 计算初始进度
        const initialPageNum = initialPage || 1;
        const initialProgress = total > 0 ? Math.round((initialPageNum / total) * 100) : 0;
        
        // 设置当前页码
        setCurrentPage(initialPageNum);
        setPageInput(String(initialPageNum));
        
        // 通知父组件总页数和初始页码
        if (onPageChange && total > 0) {
          onPageChange(initialPageNum, total);
        }
        
        // 通知父组件初始进度（立即调用，不防抖）
        if (onProgress && total > 0) {
          onProgress(initialProgress);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setError("无法加载 PDF 文件");
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [url]);

  // 渲染单页
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || renderedPages.has(pageNum)) return;

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // 获取或创建 canvas
      let canvas = canvasRefs.current.get(pageNum);
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRefs.current.set(pageNum, canvas);
      }

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // 渲染 PDF 页面到 canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      // 渲染文本层
      const textContent = await page.getTextContent();
      const textLayerDiv = textLayerRefs.current.get(pageNum);
      
      if (textLayerDiv) {
        textLayerDiv.innerHTML = "";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        // 创建文本层
        textContent.items.forEach((item) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textItem = item as any;
          if (textItem.str) {
            const tx = pdfjsLib.Util.transform(
              viewport.transform,
              textItem.transform
            );

            const span = document.createElement("span");
            span.textContent = textItem.str;
            span.style.position = "absolute";
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - (textItem.height || 12)}px`;
            span.style.fontSize = `${textItem.height || 12}px`;
            // 使用用户选择的字体，但保留原始字体作为后备
            span.style.fontFamily = `${fontFamily}, ${textItem.fontName || "sans-serif"}`;
            span.style.color = "transparent";
            span.style.whiteSpace = "pre";
            
            textLayerDiv.appendChild(span);
          }
        });
      }

      setRenderedPages((prev) => new Set([...prev, pageNum]));
    } catch (err) {
      console.error(`Failed to render page ${pageNum}:`, err);
    }
  }, [pdf, scale, renderedPages]);

  // 渲染可见页面
  useEffect(() => {
    if (!pdf) return;

    // 当字体改变时，清除已渲染页面以重新渲染
    if (fontFamily) {
      setRenderedPages(new Set());
    }

    // 渲染当前页和前后各一页
    const pagesToRender = [currentPage - 1, currentPage, currentPage + 1].filter(
      (p) => p >= 1 && p <= totalPages
    );

    pagesToRender.forEach((page) => {
      renderPage(page);
    });
  }, [pdf, currentPage, totalPages, renderPage, fontFamily]);

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectedText(null);
      return;
    }

    // 获取选择区域
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());

    setSelectedText({
      text,
      page: currentPage,
      rects,
    });
  }, [currentPage]);

  // 监听文本选择
  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    return () => document.removeEventListener("mouseup", handleTextSelection);
  }, [handleTextSelection]);

  // 翻页（带防抖的进度更新）
  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(newPage);
    setPageInput(String(newPage));
    
    // 立即通知父组件页码变化
    if (onPageChange && totalPages > 0) {
      onPageChange(newPage, totalPages);
    }
    
    // 立即更新进度显示（不防抖）
    if (totalPages > 0) {
      const progress = Math.round((newPage / totalPages) * 100);
      // 立即调用进度回调（UI更新）
      if (onProgress) {
        onProgress(progress);
      }
    }
  }, [totalPages, onProgress, onPageChange]);
  
  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }
    };
  }, []);

  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // 处理页码输入
  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(pageInput, 10);
      if (!isNaN(page)) {
        goToPage(page);
      }
    }
  };

  // 缩放
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(3, s + 0.2));
    setRenderedPages(new Set()); // 重新渲染
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(0.5, s - 0.2));
    setRenderedPages(new Set());
  }, []);

  // 将 DOMRect 转换为 PdfRect（相对于页面容器的坐标）
  const domRectsToPageRects = useCallback((rects: DOMRect[], pageNum: number): PdfRect[] => {
    const canvas = canvasRefs.current.get(pageNum);
    if (!canvas) return [];
    
    const canvasRect = canvas.getBoundingClientRect();
    return rects.map(rect => ({
      x: (rect.left - canvasRect.left) / scale,
      y: (rect.top - canvasRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }));
  }, [scale]);

  // 高亮选中文本
  const highlightSelected = useCallback(() => {
    if (!selectedText) return;
    const pdfRects = domRectsToPageRects(selectedText.rects, selectedText.page);
    onHighlight?.(selectedText.text, selectedText.page, pdfRects);
    window.getSelection()?.removeAllRanges();
    setSelectedText(null);
  }, [selectedText, onHighlight, domRectsToPageRects]);
  

  // 渲染高亮层
  const renderHighlightsForPage = useCallback((pageNum: number) => {
    const highlightLayer = highlightLayerRefs.current.get(pageNum);
    const canvas = canvasRefs.current.get(pageNum);
    if (!highlightLayer || !canvas) return;

    // 清空现有高亮
    highlightLayer.innerHTML = "";

    // 找到该页的高亮
    const pageHighlights = highlights.filter(h => h.position?.page === pageNum);
    
    pageHighlights.forEach(h => {
      if (h.position?.rects) {
        h.position.rects.forEach(rect => {
          const highlightDiv = document.createElement("div");
          highlightDiv.className = "pdf-highlight";
          highlightDiv.style.position = "absolute";
          highlightDiv.style.left = `${rect.x * scale}px`;
          highlightDiv.style.top = `${rect.y * scale}px`;
          highlightDiv.style.width = `${rect.width * scale}px`;
          highlightDiv.style.height = `${rect.height * scale}px`;
          highlightDiv.style.backgroundColor = h.color || "rgba(255, 235, 59, 0.4)";
          highlightDiv.style.pointerEvents = "none";
          highlightDiv.style.mixBlendMode = "multiply";
          highlightDiv.title = h.content;
          highlightLayer.appendChild(highlightDiv);
        });
      }
    });
  }, [highlights, scale]);

  // 当高亮或页面变化时重新渲染高亮层
  useEffect(() => {
    if (!pdf) return;
    
    const pagesToRender = [currentPage - 1, currentPage, currentPage + 1].filter(
      (p) => p >= 1 && p <= totalPages
    );
    
    pagesToRender.forEach(pageNum => {
      renderHighlightsForPage(pageNum);
    });
  }, [highlights, currentPage, totalPages, pdf, renderHighlightsForPage]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  
  // 暴露 goToPage 方法给父组件（通过 ref）
  useEffect(() => {
    // 这个方法可以通过 ref 暴露，但目前我们通过 onPageChange 回调来同步
    // 如果需要，可以添加 useImperativeHandle
  }, []);

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goPrev}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={handlePageInput}
              className="h-6 w-12 text-xs text-center"
            />
            <span className="text-xs text-muted-foreground">/ {totalPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goNext}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <FontSelector
            selectedFont={fontFamily}
            onFontSelect={(fontFamily) => {
              setFontFamily(fontFamily);
              // PDF 的文本层是透明的，主要用于文本选择
              // 实际显示的文本是在 canvas 上渲染的，无法改变字体
              // 这里改变的是文本选择时的字体显示
              setRenderedPages(new Set()); // 重新渲染以应用字体
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setScale(1.2);
              setRenderedPages(new Set());
            }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">{progress}%</div>
      </div>

      {/* PDF 显示区域 */}
      <ScrollArea className="flex-1 relative">
        {/* 半透明翻页按钮 - 不遮挡内容 */}
        <button
          onClick={goPrev}
          disabled={currentPage <= 1}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-12 h-20 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg transition-all opacity-0 hover:opacity-100 group disabled:opacity-0 disabled:cursor-not-allowed"
          aria-label="上一页"
        >
          <ChevronLeft className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={goNext}
          disabled={currentPage >= totalPages}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-12 h-20 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg transition-all opacity-0 hover:opacity-100 group disabled:opacity-0 disabled:cursor-not-allowed"
          aria-label="下一页"
        >
          <ChevronRight className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
        </button>
        
        <div
          ref={containerRef}
          className="flex flex-col items-center py-4 gap-4 min-h-full bg-muted/20"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-muted-foreground">加载中...</div>
            </div>
          ) : (
            Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="relative shadow-lg bg-white"
                style={{ display: Math.abs(pageNum - currentPage) <= 2 ? "block" : "none" }}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                  }}
                />
                {/* 高亮层 - 在 canvas 上方，文本层下方 */}
                <div
                  ref={(el) => {
                    if (el) highlightLayerRefs.current.set(pageNum, el);
                  }}
                  className="absolute top-0 left-0 pointer-events-none"
                />
                {/* 文本层 - 最上层用于选择 */}
                <div
                  ref={(el) => {
                    if (el) textLayerRefs.current.set(pageNum, el);
                  }}
                  className="absolute top-0 left-0 select-text"
                  style={{ userSelect: "text" }}
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-white/80 px-2 py-0.5 rounded">
                  {pageNum}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* 选中文本工具栏 - 跟随选中位置（参考微信读书样式） */}
      {selectedText && (() => {
        // 计算弹出框位置 - 基于选中区域，智能定位避免遮挡
        const containerRect = containerRef.current?.getBoundingClientRect();
        let popupStyle: React.CSSProperties = {
          bottom: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
        
        if (selectedText.rects.length > 0 && containerRect) {
          const firstRect = selectedText.rects[0];
          const relativeX = firstRect.left - containerRect.left + firstRect.width / 2;
          const relativeY = firstRect.top - containerRect.top;
          
          // 智能定位：优先显示在选中文本上方，如果上方空间不足则显示在下方
          const popupHeight = 60; // 估算工具栏高度
          const spaceAbove = relativeY;
          
          if (spaceAbove > popupHeight + 20) {
            // 显示在上方
            popupStyle = {
              left: `${Math.max(150, Math.min(relativeX, containerRect.width - 150))}px`,
              top: `${Math.max(10, relativeY - popupHeight - 10)}px`,
              transform: 'translateX(-50%)',
            };
          } else {
            // 显示在下方
            popupStyle = {
              left: `${Math.max(150, Math.min(relativeX, containerRect.width - 150))}px`,
              top: `${Math.min(containerRect.height - popupHeight - 10, relativeY + firstRect.height + 10)}px`,
              transform: 'translateX(-50%)',
            };
          }
        }
        
        return (
          <div 
            className="absolute bg-popover border rounded-lg shadow-xl p-2.5 flex items-center gap-2 z-50 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-200"
            style={popupStyle}
          >
            <div 
              className="cursor-grab hover:bg-muted p-1.5 rounded active:cursor-grabbing transition-colors"
              draggable
              onDragStart={(e) => {
                if (sourceId) {
                  e.dataTransfer.setData("application/x-zentri-reference", JSON.stringify({
                    sourceId,
                    sourceTitle: sourceTitle || "PDF",
                    text: selectedText.text,
                    page: selectedText.page,
                    type: "pdf",
                  }));
                  e.dataTransfer.effectAllowed = "copy";
                }
              }}
              title="拖拽到编辑器以创建引用"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            
            {/* 颜色选择器 */}
            <div className="px-1 border-l border-r border-border">
              <HighlightColorPicker
                selectedColor={selectedHighlightColor}
                onColorSelect={(color) => {
                  setSelectedHighlightColor(color);
                  onColorChange?.(color); // 通知父组件颜色改变
                  // 点击颜色后立即应用高亮
                  const pdfRects = domRectsToPageRects(selectedText.rects, selectedText.page);
                  onHighlight?.(selectedText.text, selectedText.page, pdfRects);
                  window.getSelection()?.removeAllRanges();
                  setSelectedText(null);
                }}
              />
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 px-3"
              onClick={() => {
                const pdfRects = domRectsToPageRects(selectedText.rects, selectedText.page);
                onHighlight?.(selectedText.text, selectedText.page, pdfRects);
                window.getSelection()?.removeAllRanges();
                setSelectedText(null);
              }}
            >
              <Highlighter className="h-3.5 w-3.5" style={{ color: selectedHighlightColor }} />
              高亮
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 px-3"
              onClick={() => {
                const pdfRects = domRectsToPageRects(selectedText.rects, selectedText.page);
                highlightSelected();
                onAddToNote?.(selectedText.text, selectedText.page, pdfRects);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              笔记
            </Button>
          </div>
        );
      })()}

      {/* 进度条 */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

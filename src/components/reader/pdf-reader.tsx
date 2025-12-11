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

// 设置 worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfReaderProps {
  url: string;
  sourceId?: string;
  sourceTitle?: string;
  onHighlight?: (text: string, page: number) => void;
  onAddToNote?: (text: string, page: number) => void;
  onProgress?: (progress: number) => void;
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
  onHighlight,
  onAddToNote,
  onProgress,
  className,
}: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [pageInput, setPageInput] = useState("1");

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
        setTotalPages(pdfDoc.numPages);
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
            span.style.fontFamily = textItem.fontName || "sans-serif";
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

    // 渲染当前页和前后各一页
    const pagesToRender = [currentPage - 1, currentPage, currentPage + 1].filter(
      (p) => p >= 1 && p <= totalPages
    );

    pagesToRender.forEach((page) => {
      renderPage(page);
    });
  }, [pdf, currentPage, totalPages, renderPage]);

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

  // 翻页
  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(newPage);
    setPageInput(String(newPage));
    
    const progress = Math.round((newPage / totalPages) * 100);
    onProgress?.(progress);
  }, [totalPages, onProgress]);

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

  // 高亮选中文本
  const highlightSelected = useCallback(() => {
    if (!selectedText) return;
    onHighlight?.(selectedText.text, selectedText.page);
    window.getSelection()?.removeAllRanges();
    setSelectedText(null);
  }, [selectedText, onHighlight]);

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
      <ScrollArea className="flex-1">
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

      {/* 选中文本工具栏 - 跟随选中位置 */}
      {selectedText && (() => {
        // 计算弹出框位置 - 基于选中区域
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
          popupStyle = {
            left: `${Math.max(120, Math.min(relativeX, containerRect.width - 120))}px`,
            top: `${Math.max(50, relativeY - 50)}px`,
            transform: 'translateX(-50%)',
          };
        }
        
        return (
          <div 
            className="absolute bg-popover border rounded-lg shadow-lg p-2 flex items-center gap-2 z-50"
            style={popupStyle}
          >
            <div 
              className="cursor-grab hover:bg-muted p-1 rounded active:cursor-grabbing"
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={highlightSelected}
            >
              <Highlighter className="h-3 w-3 text-yellow-500" />
              高亮
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                highlightSelected();
                onAddToNote?.(selectedText.text, selectedText.page);
              }}
            >
              <Plus className="h-3 w-3" />
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

import { useEffect, useRef, useState, useCallback } from "react";
import ePub, { Book, Rendition, Contents } from "epubjs";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  Plus,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types";

interface EpubReaderProps {
  url: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, cfiRange: string) => void;
  onAddToNote?: (text: string, cfiRange: string) => void;
  onProgress?: (progress: number) => void;
  className?: string;
}

export function EpubReader({
  url,
  highlights = [],
  onHighlight,
  onAddToNote,
  onProgress,
  className,
}: EpubReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fontSize, setFontSize] = useState(100);
  const [selectedText, setSelectedText] = useState<{ text: string; cfiRange: string } | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<{ label: string; href: string }[]>([]);

  // 初始化阅读器
  useEffect(() => {
    if (!containerRef.current || !url) return;

    const initBook = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 清理旧实例
        if (bookRef.current) {
          bookRef.current.destroy();
        }

        // 创建新的 Book 实例
        const book = ePub(url);
        bookRef.current = book;

        // 等待书籍加载
        await book.ready;

        // 获取目录
        const navigation = await book.loaded.navigation;
        setToc(
          navigation.toc.map((item) => ({
            label: item.label,
            href: item.href,
          }))
        );

        // 渲染到容器
        const rendition = book.renderTo(containerRef.current!, {
          width: "100%",
          height: "100%",
          spread: "none",
        });
        renditionRef.current = rendition;

        // 显示内容
        await rendition.display();

        // 设置主题样式
        rendition.themes.default({
          body: {
            "font-family": "system-ui, -apple-system, sans-serif",
            "line-height": "1.8",
            "padding": "20px 40px",
          },
          "a": {
            "color": "inherit",
          },
        });

        // 监听位置变化
        rendition.on("relocated", (location: { start: { percentage: number } }) => {
          const percent = Math.round(location.start.percentage * 100);
          setProgress(percent);
          onProgress?.(percent);
        });

        // 监听文本选择
        rendition.on("selected", (cfiRange: string, contents: Contents) => {
          const selection = contents.window.getSelection();
          if (selection && selection.toString().trim()) {
            setSelectedText({
              text: selection.toString().trim(),
              cfiRange,
            });
          }
        });

        // 点击时清除选择
        rendition.on("click", () => {
          setSelectedText(null);
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load EPUB:", err);
        setError("无法加载 EPUB 文件");
        setIsLoading(false);
      }
    };

    initBook();

    return () => {
      if (bookRef.current) {
        bookRef.current.destroy();
      }
    };
  }, [url, onProgress]);

  // 应用高亮
  useEffect(() => {
    if (!renditionRef.current || highlights.length === 0) return;

    highlights.forEach((h) => {
      if (h.position?.startOffset !== undefined) {
        // 这里需要 CFI 位置信息
        // renditionRef.current?.annotations.highlight(cfi, {}, () => {}, 'hl', { fill: h.color || 'yellow' });
      }
    });
  }, [highlights]);

  // 更新字体大小
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  // 翻页
  const goNext = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const goPrev = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  // 跳转到目录项
  const goToToc = useCallback((href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  }, []);

  // 高亮选中文本
  const highlightSelected = useCallback(() => {
    if (!selectedText || !renditionRef.current) return;

    // 添加高亮标注
    renditionRef.current.annotations.highlight(
      selectedText.cfiRange,
      {},
      () => {},
      "hl",
      { fill: "yellow", "fill-opacity": "0.3" }
    );

    // 回调
    onHighlight?.(selectedText.text, selectedText.cfiRange);
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

      {/* 阅读区域 */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        )}
        <div ref={containerRef} className="h-full" />
        
        {/* 翻页按钮 */}
        <button
          onClick={goPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-20 flex items-center justify-center hover:bg-muted/50 rounded"
        >
          <ChevronLeft className="h-6 w-6 text-muted-foreground" />
        </button>
        <button
          onClick={goNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-20 flex items-center justify-center hover:bg-muted/50 rounded"
        >
          <ChevronRight className="h-6 w-6 text-muted-foreground" />
        </button>
      </div>

      {/* 选中文本工具栏 */}
      {selectedText && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-lg p-2 flex items-center gap-2 z-50">
          <span className="text-xs text-muted-foreground max-w-[200px] truncate">
            "{selectedText.text}"
          </span>
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
              onAddToNote?.(selectedText.text, selectedText.cfiRange);
            }}
          >
            <Plus className="h-3 w-3" />
            添加到笔记
          </Button>
        </div>
      )}

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


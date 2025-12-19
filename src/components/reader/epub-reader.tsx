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
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileUrl } from "@/lib/file-url";
import type { Highlight } from "@/types";
import { HighlightColorPicker, HIGHLIGHT_COLORS } from "./highlight-color-picker";
import { FontSelector, FONT_OPTIONS } from "./font-selector";

interface EpubReaderProps {
  url: string;
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, cfiRange: string) => void;
  onAddToNote?: (text: string, cfiRange: string) => void;
  onProgress?: (progress: number) => void;
  onColorChange?: (color: string) => void;
  onPageChange?: (page: number, totalPages: number) => void; // EPUB 使用进度作为页码
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
  onColorChange,
  onPageChange,
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
    cfiRange: string;
    position?: { x: number; y: number };
  } | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(
    HIGHLIGHT_COLORS[0].color
  );
  const progressUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 稳定的回调引用
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  // 初始化阅读器
  useEffect(() => {
    if (!containerRef.current || !url) return;
    
    // 防止重复初始化
    if (initializingRef.current || currentUrlRef.current === url) {
      return;
    }

    let isMounted = true;
    initializingRef.current = true;
    currentUrlRef.current = url;

    const initBook = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 清理旧实例
        if (bookRef.current) {
          bookRef.current.destroy();
          bookRef.current = null;
          renditionRef.current = null;
        }

        // 转换本地文件路径为可访问的 URL
        const fileUrl = await getFileUrl(url);
        console.log("Loading EPUB from:", fileUrl);

        // 在 Tauri 环境中，我们需要先获取文件内容然后创建 ArrayBuffer
        let book: Book;
        if (fileUrl.startsWith("asset://") || fileUrl.startsWith("http://asset.localhost")) {
          console.log("Fetching EPUB via asset protocol...");
          try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch EPUB: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log("EPUB fetched, size:", arrayBuffer.byteLength);
            book = ePub(arrayBuffer);
          } catch (fetchErr) {
            console.error("Failed to fetch EPUB:", fetchErr);
            throw fetchErr;
          }
        } else {
          // 直接从 URL 加载
          book = ePub(fileUrl);
        }
        bookRef.current = book;

        // 等待书籍加载
        await book.ready;
        console.log("EPUB book ready");

        if (!isMounted) return;

        // 获取目录
        const navigation = await book.loaded.navigation;
        const tocItems = navigation.toc.map((item) => ({
          label: item.label.trim(),
          href: item.href,
        }));
        setToc(tocItems);
        console.log("EPUB TOC loaded:", tocItems.length, "items");

        if (!isMounted || !containerRef.current) return;

        // 渲染到容器 - 使用固定像素尺寸而不是百分比
        const container = containerRef.current;
        let rect = container.getBoundingClientRect();
        
        // 如果容器尺寸为 0，等待一帧后重新获取
        if (rect.width === 0 || rect.height === 0) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          rect = container.getBoundingClientRect();
        }
        
        const width = Math.max(rect.width, 300);
        const height = Math.max(rect.height, 400);
        console.log("EPUB container size:", width, "x", height);
        
        const rendition = book.renderTo(container, {
          width,
          height,
          spread: "none",
          flow: "paginated",
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        // 监听渲染完成
        rendition.on("rendered", (section: { index: number }) => {
          console.log("EPUB section rendered:", section.index);
          if (isMounted) {
            setIsLoading(false);
          }
          
          // 修复 iframe sandbox 权限问题
          const iframes = container.querySelectorAll("iframe");
          iframes.forEach((iframe) => {
            if (iframe.sandbox) {
              iframe.sandbox.add("allow-scripts");
              iframe.sandbox.add("allow-same-origin");
            }
          });
        });

        // 设置主题样式（初始字体）
        rendition.themes.default({
          body: {
            "font-family": fontFamily,
            "line-height": "1.8",
            "padding": "20px 40px",
            "background": "#fff",
          },
          "a": {
            "color": "#2563eb",
            "text-decoration": "underline",
          },
        });

        // 监听位置变化（带防抖）
        rendition.on("relocated", (location: { start: { percentage: number } }) => {
          const percent = Math.round(location.start.percentage * 100);
          setProgress(percent);
          
          // 立即更新进度（UI显示）
          if (onProgressRef.current) {
            onProgressRef.current(percent);
          }
          
          // 通知页码变化（EPUB 使用进度作为页码）
          if (onPageChange) {
            // EPUB 没有明确的页码，使用百分比作为"页码"
            onPageChange(percent, 100);
          }
        });
        
        // 初始显示后，手动触发一次进度更新
        rendition.on("rendered", () => {
          // 等待一帧确保位置已更新，relocated 事件会自动触发进度更新
          // 这里不需要手动获取，因为 relocated 事件会在内容渲染后自动触发
        });

        // 监听文本选择
        rendition.on("selected", (cfiRange: string, contents: Contents) => {
          const selection = contents.window.getSelection();
          if (selection && selection.toString().trim()) {
            // 获取选中文本的位置
            let position: { x: number; y: number } | undefined;
            try {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              const iframe = container.querySelector("iframe");
              if (iframe && rect) {
                const iframeRect = iframe.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                // 计算相对于容器的位置
                position = {
                  x: iframeRect.left - containerRect.left + rect.left + rect.width / 2,
                  y: iframeRect.top - containerRect.top + rect.top,
                };
              }
            } catch (e) {
              console.warn("Could not get selection position:", e);
            }
            
            setSelectedText({
              text: selection.toString().trim(),
              cfiRange,
              position,
            });
          }
        });

        // 点击时清除选择
        rendition.on("click", () => {
          setSelectedText(null);
        });

        // 显示内容 - 添加超时保护
        console.log("Displaying EPUB...");
        const displayPromise = rendition.display();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Display timeout")), 10000)
        );
        
        try {
          await Promise.race([displayPromise, timeoutPromise]);
          console.log("EPUB display() completed");
        } catch (displayErr) {
          console.warn("EPUB display warning:", displayErr);
          // 不抛出错误，可能只是超时但内容已经加载
        }

        // 确保加载状态更新
        if (isMounted) {
          setIsLoading(false);
        }
        
        initializingRef.current = false;
      } catch (err) {
        console.error("Failed to load EPUB:", err);
        if (isMounted) {
          setError(`无法加载 EPUB 文件: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
        initializingRef.current = false;
      }
    };

    initBook();

    return () => {
      isMounted = false;
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
        renditionRef.current = null;
      }
      currentUrlRef.current = null;
      initializingRef.current = false;
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }
    };
  }, [url]); // 只依赖 url，使用 ref 来访问回调

  // 监听容器尺寸变化，更新 epub.js 布局
  useEffect(() => {
    if (!containerRef.current || !renditionRef.current) return;
    
    const container = containerRef.current;
    let resizeTimeout: ReturnType<typeof setTimeout>;
    
    const resizeObserver = new ResizeObserver((entries) => {
      // 使用防抖避免频繁调用
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const entry = entries[0];
        if (entry && renditionRef.current) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            console.log("Resizing EPUB to:", width, "x", height);
            renditionRef.current.resize(width, height);
          }
        }
      }, 100);
    });
    
    resizeObserver.observe(container);
    
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [isLoading]); // 在加载完成后开始监听

  // 应用高亮 - 使用 CFI 定位
  useEffect(() => {
    if (!renditionRef.current || highlights.length === 0) return;

    // 清除现有高亮（避免重复）
    // epub.js 没有直接的 clearAnnotations，需要重新添加

    highlights.forEach((h) => {
      // 优先使用 CFI 定位
      const cfi = h.position?.cfi || h.position?.startOffset;
      if (cfi && typeof cfi === 'string' && cfi.startsWith('epubcfi')) {
        try {
          renditionRef.current?.annotations.highlight(
            cfi,
            { id: h.id },
            () => {},
            'hl',
            { 
              fill: h.color || 'rgba(255, 235, 59, 0.4)',
              'fill-opacity': '0.4',
            }
          );
        } catch (err) {
          console.warn('Failed to apply highlight:', err);
        }
      }
    });
  }, [highlights]);

  // 更新字体大小
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  // 更新字体
  useEffect(() => {
    if (renditionRef.current && containerRef.current) {
      // 直接操作 iframe 内的样式（最可靠的方法）
      const updateFont = () => {
        const iframe = containerRef.current?.querySelector("iframe");
        if (iframe && iframe.contentDocument) {
          // 移除旧的字体样式
          const oldStyle = iframe.contentDocument.querySelector("style[data-font-override]");
          if (oldStyle) {
            oldStyle.remove();
          }
          
          // 添加新的字体样式
          const style = iframe.contentDocument.createElement("style");
          style.setAttribute("data-font-override", "true");
          style.textContent = `
            body, * {
              font-family: ${fontFamily} !important;
            }
          `;
          iframe.contentDocument.head.appendChild(style);
        }
      };
      
      // 立即尝试更新
      updateFont();
      
      // 监听渲染事件，确保在内容渲染后更新字体
      const handleRendered = () => {
        updateFont();
      };
      
      renditionRef.current.on("rendered", handleRendered);
      
      return () => {
        renditionRef.current?.off("rendered", handleRendered);
      };
    }
  }, [fontFamily]);

  // 翻页
  const goNext = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const goPrev = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  // 跳转到目录项
  const goToToc = useCallback(async (href: string) => {
    if (!renditionRef.current) {
      console.warn("Rendition not ready");
      return;
    }
    try {
      console.log("Navigating to:", href);
      setShowToc(false);
      await renditionRef.current.display(href);
    } catch (err) {
      console.error("Failed to navigate to TOC item:", err);
    }
  }, []);

  // 高亮选中文本
  const highlightSelected = useCallback((color?: string) => {
    if (!selectedText || !renditionRef.current) return;

    const highlightColor = color || selectedHighlightColor;
    
    // 提取颜色值用于 epub.js（需要 RGB 格式）
    const rgbMatch = highlightColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    let fillColor = "yellow";
    let fillOpacity = "0.3";
    
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      fillColor = `rgb(${r}, ${g}, ${b})`;
      // 从 rgba 中提取透明度
      const opacityMatch = highlightColor.match(/[\d.]+\)$/);
      if (opacityMatch) {
        fillOpacity = opacityMatch[0].replace(')', '');
      }
    }

    // 添加高亮标注
    renditionRef.current.annotations.highlight(
      selectedText.cfiRange,
      {},
      () => {},
      "hl",
      { fill: fillColor, "fill-opacity": fillOpacity }
    );

    // 回调（传递颜色信息）
    onHighlight?.(selectedText.text, selectedText.cfiRange);
    setSelectedText(null);
  }, [selectedText, onHighlight, selectedHighlightColor]);

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

      {/* 阅读区域 */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        )}
        <div ref={containerRef} className="h-full" />
        
        {/* 半透明翻页按钮 - 不遮挡内容（参考微信读书） */}
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

      {/* 选中文本工具栏 - 跟随选中位置（参考微信读书样式） */}
      {selectedText && (
        <div 
          className="absolute bg-popover border rounded-lg shadow-xl p-2.5 flex items-center gap-2 z-50 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-200"
          style={selectedText.position ? (() => {
            const containerWidth = containerRef.current?.offsetWidth || 400;
            const popupHeight = 60;
            const spaceAbove = selectedText.position.y;
            
            // 智能定位：优先显示在上方
            if (spaceAbove > popupHeight + 20) {
              return {
                left: `${Math.max(150, Math.min(selectedText.position.x, containerWidth - 150))}px`,
                top: `${Math.max(10, selectedText.position.y - popupHeight - 10)}px`,
                transform: 'translateX(-50%)',
              };
            } else {
              return {
                left: `${Math.max(150, Math.min(selectedText.position.x, containerWidth - 150))}px`,
                top: `${Math.min((containerRef.current?.offsetHeight || 600) - popupHeight - 10, selectedText.position.y + 40)}px`,
                transform: 'translateX(-50%)',
              };
            }
          })() : {
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div 
            className="cursor-grab hover:bg-muted p-1.5 rounded active:cursor-grabbing transition-colors"
            draggable
            onDragStart={(e) => {
              if (sourceId) {
                e.dataTransfer.setData("application/x-zentri-reference", JSON.stringify({
                  sourceId,
                  sourceTitle: sourceTitle || "EPUB",
                  text: selectedText.text,
                  cfi: selectedText.cfiRange,
                  type: "epub",
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
                highlightSelected(color);
              }}
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
              onAddToNote?.(selectedText.text, selectedText.cfiRange);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            笔记
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


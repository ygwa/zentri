/**
 * 功能性中缝 (Functional Gutter)
 * 
 * 专家建议方案二的核心组件：
 * - 中间的分隔条不只是一条线，而是一个工具停靠区
 * - 当选中左侧文字时，自动浮现操作按钮
 * - 提供一键创建笔记、切换布局模式等功能
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  StickyNote,
  BookOpen,
  PenLine,
  GripVertical,
  Sparkles,
} from "lucide-react";

export type LayoutMode = "reading" | "feynman";

interface FunctionalGutterProps {
  /** 选中的文本 */
  selectedText?: string;
  /** 当前布局模式 */
  layoutMode: LayoutMode;
  /** 切换布局模式 */
  onLayoutModeChange: (mode: LayoutMode) => void;
  /** 将选中文本创建为笔记 */
  onCreateNoteFromSelection?: (text: string) => void;
  /** 将选中文本添加到当前笔记 */
  onAddToCurrentNote?: (text: string) => void;
  /** 自定义类名 */
  className?: string;
}

export function FunctionalGutter({
  selectedText,
  layoutMode,
  onLayoutModeChange,
  onCreateNoteFromSelection,
  onAddToCurrentNote,
  className,
}: FunctionalGutterProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hasSelection = !!selectedText && selectedText.trim().length > 0;

  // 处理创建笔记
  const handleCreateNote = useCallback(() => {
    if (selectedText && onCreateNoteFromSelection) {
      onCreateNoteFromSelection(selectedText);
    }
  }, [selectedText, onCreateNoteFromSelection]);

  // 处理添加到当前笔记
  const handleAddToNote = useCallback(() => {
    if (selectedText && onAddToCurrentNote) {
      onAddToCurrentNote(selectedText);
    }
  }, [selectedText, onAddToCurrentNote]);

  return (
    <ResizableHandle
      className={cn(
        // 基础样式 - 比默认更宽
        "relative flex w-6 items-center justify-center",
        "bg-gradient-to-b from-transparent via-muted/30 to-transparent",
        "transition-all duration-300",
        // 悬停时显示更明显
        isHovered && "bg-muted/50 w-7",
        // 有选中文本时高亮
        hasSelection && "bg-primary/5 w-8",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 中缝内容容器 */}
      <div className="flex flex-col items-center gap-2 py-4">
        {/* 选中文本时的操作按钮 */}
        {hasSelection && (
          <div className="flex flex-col gap-1.5 animate-in fade-in-0 slide-in-from-left-2 duration-200">
            <TooltipProvider delayDuration={0}>
              {/* 创建新笔记 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className={cn(
                      "h-8 w-8 rounded-full shadow-md",
                      "bg-primary text-primary-foreground",
                      "hover:bg-primary/90 hover:scale-110",
                      "transition-all duration-200"
                    )}
                    onClick={handleCreateNote}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5" />
                  创建笔记
                  <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-muted rounded">⌘⇧N</kbd>
                </TooltipContent>
              </Tooltip>

              {/* 添加到当前笔记 */}
              {onAddToCurrentNote && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className={cn(
                        "h-7 w-7 rounded-full shadow-sm",
                        "bg-background/80 backdrop-blur-sm",
                        "hover:bg-accent hover:scale-105",
                        "transition-all duration-200"
                      )}
                      onClick={handleAddToNote}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    <PenLine className="h-3.5 w-3.5" />
                    添加到笔记
                    <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-muted rounded">⌘⏎</kbd>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        )}

        {/* 分隔线 */}
        <div className="flex-1 w-px bg-border/50" />

        {/* 布局模式切换按钮 - 固定在中间位置 */}
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-col gap-1.5 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={layoutMode === "reading" ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 w-7 rounded-md transition-all duration-200",
                    layoutMode === "reading" && "bg-sky-100 text-sky-600 shadow-sm"
                  )}
                  onClick={() => onLayoutModeChange("reading")}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-medium">
                  <BookOpen className="h-3.5 w-3.5" />
                  阅读模式
                </div>
                <div className="text-[10px] text-muted-foreground">
                  70% 阅读 / 30% 笔记 · 适合大量输入
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={layoutMode === "feynman" ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 w-7 rounded-md transition-all duration-200",
                    layoutMode === "feynman" && "bg-emerald-100 text-emerald-600 shadow-sm"
                  )}
                  onClick={() => onLayoutModeChange("feynman")}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  费曼模式
                </div>
                <div className="text-[10px] text-muted-foreground">
                  30% 原文 / 70% 笔记 · 适合深度思考
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* 分隔线 */}
        <div className="flex-1 w-px bg-border/50" />

        {/* 拖拽把手 - 仅在悬停时显示 */}
        <div 
          className={cn(
            "flex items-center justify-center transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </div>
    </ResizableHandle>
  );
}

/**
 * 用于监听选中文本的 Hook
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selectedText, setSelectedText] = useState<string>("");

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedText("");
        return;
      }

      // 检查选择是否在容器内
      const range = selection.getRangeAt(0);
      const container = containerRef.current;
      if (container && container.contains(range.commonAncestorContainer)) {
        const text = selection.toString().trim();
        setSelectedText(text);
      } else {
        setSelectedText("");
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);

  return selectedText;
}


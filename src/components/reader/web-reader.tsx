import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Highlighter,
  Plus,
  GripVertical,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Highlight, WebSnapshot } from "@/types";

interface WebReaderProps {
  snapshot: WebSnapshot;
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, selector: string) => void;
  onAddToNote?: (text: string, selector: string) => void;
  onRefresh?: () => void;
  className?: string;
}

interface TextSelection {
  text: string;
  selector: string;
  range: Range;
}

export function WebReader({
  snapshot,
  sourceId,
  sourceTitle,
  highlights = [],
  onHighlight,
  onAddToNote,
  onRefresh,
  className,
}: WebReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(100);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);

  // 生成 XPath 选择器
  const getXPath = useCallback((element: Node): string => {
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentNode!;
    }
    
    if (!(element instanceof Element)) {
      return '';
    }

    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index}]`);
      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }, []);

  // 生成文本选择器
  const generateSelector = useCallback((range: Range): string => {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    const text = range.toString();

    // 如果选择在同一文本节点内
    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
      const xpath = getXPath(startContainer);
      return JSON.stringify({
        type: 'text',
        xpath,
        offset: startOffset,
        length: endOffset - startOffset,
        text: text.slice(0, 100), // 保存前100个字符用于匹配
      });
    }

    // 跨节点选择
    const startXpath = getXPath(startContainer);
    const endXpath = getXPath(endContainer);
    
    return JSON.stringify({
      type: 'range',
      startXpath,
      startOffset,
      endXpath,
      endOffset,
      text: text.slice(0, 100),
    });
  }, [getXPath]);

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current) {
      setSelectedText(null);
      setSelectionPosition(null);
      return;
    }

    // 检查选择是否在内容区域内
    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      setSelectedText(null);
      setSelectionPosition(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 3) {
      setSelectedText(null);
      setSelectionPosition(null);
      return;
    }

    // 生成选择器
    const selector = generateSelector(range);
    
    // 获取选择位置
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();
    
    setSelectedText({ text, selector, range });
    setSelectionPosition({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 10,
    });
  }, [generateSelector]);

  // 监听文本选择
  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    return () => document.removeEventListener("mouseup", handleTextSelection);
  }, [handleTextSelection]);

  // 应用单个高亮到 DOM
  const applyHighlightToDOM = useCallback((highlight: Highlight) => {
    if (!contentRef.current || !highlight.position?.selector) return;

    try {
      const selectorData = JSON.parse(highlight.position.selector);
      const color = highlight.color || 'rgba(255, 235, 59, 0.4)';

      if (selectorData.type === 'text') {
        // 单文本节点高亮
        const xpath = selectorData.xpath;
        const offset = selectorData.offset || 0;
        const length = selectorData.length || selectorData.text?.length || 0;

        // 使用 XPath 查找元素
        const result = document.evaluate(
          xpath,
          contentRef.current,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        const element = result.singleNodeValue;
        if (element) {
          const textNode = Array.from(element.childNodes).find(
            (node) => node.nodeType === Node.TEXT_NODE
          ) as Text | undefined;

          if (textNode && textNode.textContent) {
            const text = textNode.textContent;
            if (offset + length <= text.length) {
              // 创建高亮标记
              const mark = document.createElement('mark');
              mark.setAttribute('data-highlight-id', highlight.id);
              mark.style.backgroundColor = color;
              mark.style.borderRadius = '2px';
              mark.style.padding = '2px 0';
              mark.style.cursor = 'pointer';
              mark.className = 'web-highlight';

              // 分割文本节点
              const beforeText = text.substring(0, offset);
              const highlightText = text.substring(offset, offset + length);
              const afterText = text.substring(offset + length);

              // 创建文本节点
              if (beforeText) {
                textNode.parentNode?.insertBefore(
                  document.createTextNode(beforeText),
                  textNode
                );
              }

              mark.textContent = highlightText;
              textNode.parentNode?.insertBefore(mark, textNode);

              if (afterText) {
                textNode.parentNode?.insertBefore(
                  document.createTextNode(afterText),
                  textNode
                );
              }

              textNode.remove();
            }
          }
        }
      } else if (selectorData.type === 'range') {
        // 跨节点高亮 - 使用文本匹配
        const searchText = selectorData.text?.trim();
        if (searchText && searchText.length > 0 && contentRef.current.textContent?.includes(searchText)) {
          // 使用 Range API 查找文本
          const range = document.createRange();
          const walker = document.createTreeWalker(
            contentRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );

          let found = false;
          let node: Node | null;
          
          while ((node = walker.nextNode()) && !found) {
            const text = node.textContent || '';
            const index = text.indexOf(searchText);
            
            if (index !== -1) {
              try {
                range.setStart(node, index);
                range.setEnd(node, index + searchText.length);

                const mark = document.createElement('mark');
                mark.setAttribute('data-highlight-id', highlight.id);
                mark.style.backgroundColor = color;
                mark.style.borderRadius = '2px';
                mark.style.padding = '2px 0';
                mark.style.cursor = 'pointer';
                mark.className = 'web-highlight';

                try {
                  const contents = range.extractContents();
                  mark.appendChild(contents);
                  range.insertNode(mark);
                  found = true;
                } catch (e) {
                  // 如果 extractContents 失败，尝试 surroundContents
                  try {
                    range.surroundContents(mark);
                    found = true;
                  } catch (e2) {
                    console.error('Failed to apply highlight:', e2);
                  }
                }
              } catch (e) {
                console.error('Failed to create range:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to apply highlight:', err);
    }
  }, []);

  // 应用所有高亮
  const applyHighlights = useCallback(() => {
    if (!contentRef.current) return;

    // 清除已有高亮（避免重复）
    const existingHighlights = contentRef.current.querySelectorAll('mark.web-highlight');
    existingHighlights.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || '');
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    });

    // 应用所有高亮（按创建时间排序，后创建的在前）
    const sortedHighlights = [...highlights].sort((a, b) => b.createdAt - a.createdAt);
    sortedHighlights.forEach((highlight) => {
      applyHighlightToDOM(highlight);
    });
  }, [highlights, applyHighlightToDOM]);

  // 高亮选中文本
  const highlightSelected = useCallback(() => {
    if (!selectedText) return;

    // 先调用回调保存高亮（这会触发 highlights 更新，然后 applyHighlights 会自动应用）
    onHighlight?.(selectedText.text, selectedText.selector);
    
    // 清除选择
    window.getSelection()?.removeAllRanges();
    setSelectedText(null);
    setSelectionPosition(null);
  }, [selectedText, onHighlight]);

  // 当内容或高亮变化时重新应用
  useEffect(() => {
    // 延迟应用，确保 DOM 已更新
    const timer = setTimeout(() => {
      applyHighlights();
    }, 100);

    return () => clearTimeout(timer);
  }, [applyHighlights, snapshot.content]);

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {snapshot.siteName || new URL(snapshot.originalUrl).hostname}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => window.open(snapshot.originalUrl, '_blank')}
            title="在浏览器中打开"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              title="刷新快照"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
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
      </div>

      {/* 内容区域 */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto py-8 px-6">
          {/* 文章标题 */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {snapshot.title}
            </h1>
            {snapshot.author && (
              <p className="text-sm text-muted-foreground">
                By {snapshot.author}
              </p>
            )}
            {snapshot.excerpt && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                {snapshot.excerpt}
              </p>
            )}
          </header>

          {/* 文章内容 */}
          <article
            ref={contentRef}
            className="prose prose-zinc dark:prose-invert max-w-none web-reader-content"
            style={{ fontSize: `${fontSize}%` }}
            dangerouslySetInnerHTML={{ __html: snapshot.content }}
          />
        </div>
      </ScrollArea>

      {/* 选中文本工具栏 */}
      {selectedText && selectionPosition && (
        <div
          className="absolute bg-popover border rounded-lg shadow-lg p-2 flex items-center gap-2 z-50"
          style={{
            left: `${Math.max(80, Math.min(selectionPosition.x, (contentRef.current?.offsetWidth || 400) - 80))}px`,
            top: `${Math.max(50, selectionPosition.y)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="cursor-grab hover:bg-blue-50 hover:border-blue-200 border border-transparent p-1.5 rounded active:cursor-grabbing transition-all flex items-center gap-1.5 group/drag"
            draggable
            onDragStart={(e) => {
              if (sourceId) {
                e.dataTransfer.setData("application/x-zentri-reference", JSON.stringify({
                  sourceId,
                  sourceTitle: sourceTitle || snapshot.title,
                  text: selectedText.text,
                  selector: selectedText.selector,
                  type: "webpage",
                }));
                e.dataTransfer.effectAllowed = "copy";
              }
            }}
            title="拖拽到编辑器以创建引用"
          >
            <GripVertical className="h-4 w-4 text-blue-600 group-hover/drag:text-blue-700" />
            <span className="text-[10px] font-medium text-blue-600 group-hover/drag:text-blue-700 hidden sm:inline">拖拽</span>
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
              onAddToNote?.(selectedText.text, selectedText.selector);
            }}
          >
            <Plus className="h-3 w-3" />
            笔记
          </Button>
        </div>
      )}
    </div>
  );
}


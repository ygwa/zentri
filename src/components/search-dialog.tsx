import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Sparkles, BookOpen, StickyNote, FolderKanban, Loader2 } from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import * as api from "@/services/api";
import type { CardType, EditorContent } from "@/types";

// 辅助函数：从 TipTap JSON 提取文本预览
function contentToString(content: string | EditorContent | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  
  // 从 TipTap JSON 提取文本
  const extractText = (node: any): string => {
    if (!node) return '';
    if (node.text) return node.text;
    if (node.type === 'wikiLink' && node.attrs?.title) {
      return `[[${node.attrs.title}]]`;
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('');
    }
    return '';
  };
  
  if ('content' in content && Array.isArray(content.content)) {
    const text = content.content
      .map(extractText)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  }
  
  return "";
}

const typeConfig: Record<CardType, { icon: React.ElementType; color: string }> = {
  fleeting: { icon: Sparkles, color: "text-amber-500" },
  literature: { icon: BookOpen, color: "text-blue-500" },
  permanent: { icon: StickyNote, color: "text-emerald-500" },
  project: { icon: FolderKanban, color: "text-purple-500" },
};

interface SearchResult {
  id: string;
  title: string;
  score: number;
  snippet?: string;
  type: CardType;
  tags: string[];
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { cards, selectCard } = useAppStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 执行搜索（防抖）
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      // 空搜索时显示最近卡片
      setResults(
        cards.slice(0, 10).map((c) => ({
          id: c.id,
          title: c.title,
          score: 0,
          snippet: contentToString(c.content).slice(0, 100) || undefined,
          type: c.type,
          tags: c.tags,
        }))
      );
      return;
    }

    setIsSearching(true);
    try {
      if (api.isTauriEnv()) {
        const searchResults = await api.search.search(searchQuery);
        // 转换 API 返回格式
        setResults(searchResults.map(r => ({
          id: r.id,
          title: r.title,
          score: r.score,
          snippet: r.snippet,
          type: (r.cardType || 'fleeting') as CardType,
          tags: r.tags || [],
        })));
      } else {
        // Mock 模式：本地过滤
        const filtered = cards.filter(
          (card) => {
            const contentStr = contentToString(card.content);
            return (
              card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              contentStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
              card.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );
          }
        );
        setResults(
          filtered.slice(0, 20).map((c) => ({
            id: c.id,
            title: c.title,
            score: 1,
            snippet: highlightText(contentToString(c.content), searchQuery),
            type: c.type,
            tags: c.tags,
          }))
        );
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }, [cards]);

  // 搜索防抖
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 150);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // 对话框打开时初始化
  useEffect(() => {
    if (open) {
      performSearch("");
    }
  }, [open, performSearch]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          selectCard(results[selectedIndex].id);
          onOpenChange(false);
          setQuery("");
        }
        break;
      case "Escape":
        onOpenChange(false);
        setQuery("");
        break;
    }
  };

  const handleSelect = (id: string) => {
    selectCard(id);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>搜索卡片</DialogTitle>
        </DialogHeader>
        
        {/* 搜索输入 */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索卡片..."
            className="h-12 border-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>

        {/* 搜索结果 */}
        <ScrollArea className="max-h-80">
          <div className="p-2">
            {isSearching ? (
              <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                搜索中...
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                未找到相关卡片
              </div>
            ) : (
              results.map((result, index) => {
                const config = typeConfig[result.type] || typeConfig.fleeting;
                const Icon = config.icon;
                return (
                  <div
                    key={result.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors",
                      index === selectedIndex && "bg-accent"
                    )}
                    onClick={() => handleSelect(result.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{result.title || "无标题"}</p>
                      {result.snippet && (
                        <p 
                          className="text-sm text-muted-foreground line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:text-foreground [&_mark]:px-0.5 [&_mark]:rounded"
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      )}
                      {result.tags.length > 0 && (
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {result.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {query && result.score > 0 && (
                      <span className="text-xs text-muted-foreground/50">
                        {result.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <span>
              <kbd className="rounded border px-1">↑</kbd>
              <kbd className="rounded border px-1">↓</kbd> 导航
            </span>
            <span>
              <kbd className="rounded border px-1">Enter</kbd> 选择
            </span>
          </div>
          <span>{results.length} 个结果</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 简单的文本高亮函数（用于 Mock 模式）
 */
function highlightText(text: string, query: string): string {
  if (!query || !text) return text.slice(0, 100);
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) {
    return text.slice(0, 100) + (text.length > 100 ? "..." : "");
  }
  
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + query.length + 50);
  
  let snippet = "";
  if (start > 0) snippet += "...";
  
  const before = text.slice(start, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length, end);
  
  snippet += before + `<mark>${match}</mark>` + after;
  
  if (end < text.length) snippet += "...";
  
  return snippet;
}


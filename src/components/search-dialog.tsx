import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Sparkles, BookOpen, StickyNote, FolderKanban } from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { CardType } from "@/types";

const typeConfig: Record<CardType, { icon: React.ElementType; color: string }> = {
  fleeting: { icon: Sparkles, color: "text-amber-500" },
  literature: { icon: BookOpen, color: "text-blue-500" },
  permanent: { icon: StickyNote, color: "text-emerald-500" },
  project: { icon: FolderKanban, color: "text-purple-500" },
};

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { cards, selectCard } = useAppStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 搜索结果
  const results = query
    ? cards.filter(
        (card) =>
          card.title.toLowerCase().includes(query.toLowerCase()) ||
          card.content.toLowerCase().includes(query.toLowerCase()) ||
          card.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      )
    : cards.slice(0, 10);

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
            {results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                未找到相关卡片
              </div>
            ) : (
              results.map((card, index) => {
                const config = typeConfig[card.type];
                const Icon = config.icon;
                return (
                  <div
                    key={card.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md p-2",
                      index === selectedIndex && "bg-accent"
                    )}
                    onClick={() => handleSelect(card.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{card.title || "无标题"}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {card.content || "暂无内容"}
                      </p>
                      {card.tags.length > 0 && (
                        <div className="mt-1 flex gap-1">
                          {card.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
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


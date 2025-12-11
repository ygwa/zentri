import { useEffect, useRef, useState } from "react";
import { FileText, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CardSuggestion {
  id: string;
  title: string;
  type?: string;
  preview?: string;
}

interface LinkAutocompleteProps {
  query: string;
  position: { x: number; y: number };
  cards: CardSuggestion[];
  /** 选择卡片或创建新卡片 */
  onSelect: (card: CardSuggestion | null, createNew?: boolean) => void;
  onClose: () => void;
}

export function LinkAutocomplete({
  query,
  position,
  cards,
  onSelect,
  onClose,
}: LinkAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // 过滤卡片
  const filteredCards = cards.filter((card) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      card.title.toLowerCase().includes(q) ||
      card.id.toLowerCase().includes(q)
    );
  });

  // 添加"新建卡片"选项
  const showCreateNew = query.trim().length > 0;
  const totalItems = filteredCards.length + (showCreateNew ? 1 : 0);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev === 0 ? totalItems - 1 : prev - 1));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        handleSelect();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [totalItems, selectedIndex, filteredCards, query, onClose]);

  const handleSelect = () => {
    if (showCreateNew && selectedIndex === filteredCards.length) {
      // 选择了"新建卡片"
      onSelect({ id: "", title: query.trim() }, true);
    } else if (filteredCards[selectedIndex]) {
      onSelect(filteredCards[selectedIndex]);
    }
  };

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // 滚动到选中项
  useEffect(() => {
    const selected = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filteredCards.length === 0 && !showCreateNew) {
    return (
      <div
        ref={menuRef}
        className="link-autocomplete fixed z-50 bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl p-3 w-72"
        style={{ left: position.x, top: position.y }}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground py-4">
          <Sparkles className="h-8 w-8 opacity-30" />
          <span className="text-sm">没有找到匹配的卡片</span>
          <span className="text-xs opacity-60">继续输入标题来新建</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="link-autocomplete fixed z-50 bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl w-80 max-h-72 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      {/* 头部 */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="text-xs text-muted-foreground">
          链接到卡片
          {query && <span className="ml-2 text-foreground font-medium">"{query}"</span>}
        </div>
      </div>

      {/* 列表 */}
      <div className="overflow-y-auto max-h-52 p-1.5">
        {filteredCards.map((card, index) => (
          <button
            key={card.id}
            data-index={index}
            onClick={() => onSelect(card)}
            className={cn(
              "w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left transition-all",
              index === selectedIndex
                ? "bg-primary/10 ring-1 ring-primary/20"
                : "hover:bg-muted/50"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                "bg-muted/80",
                index === selectedIndex && "bg-primary/20"
              )}
            >
              <FileText
                className={cn(
                  "h-4 w-4",
                  index === selectedIndex ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-sm font-medium truncate",
                index === selectedIndex && "text-primary"
              )}>
                {card.title || "无标题"}
              </div>
              {card.preview && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {card.preview}
                </div>
              )}
            </div>
          </button>
        ))}

        {/* 新建卡片选项 */}
        {showCreateNew && (
          <button
            data-index={filteredCards.length}
            onClick={() => onSelect({ id: "", title: query.trim() }, true)}
            className={cn(
              "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all mt-1",
              "border border-dashed",
              selectedIndex === filteredCards.length
                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                : "hover:bg-muted/50 border-muted-foreground/20"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                selectedIndex === filteredCards.length
                  ? "bg-primary/20"
                  : "bg-muted/50"
              )}
            >
              <Plus
                className={cn(
                  "h-4 w-4",
                  selectedIndex === filteredCards.length
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-sm font-medium",
                selectedIndex === filteredCards.length && "text-primary"
              )}>
                新建 "{query.trim()}"
              </div>
              <div className="text-xs text-muted-foreground">
                创建新卡片并链接
              </div>
            </div>
          </button>
        )}
      </div>

      {/* 底部提示 */}
      <div className="border-t px-3 py-1.5 bg-muted/20">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd>
            选择
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
            确认
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
            取消
          </span>
        </div>
      </div>
    </div>
  );
}


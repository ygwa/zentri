import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Card, CardType, ViewType } from "@/types";
import {
  Sparkles,
  BookOpen,
  StickyNote,
  FolderKanban,
  Link2,
  MoreHorizontal,
  Plus,
  Inbox,
  Archive,
  Search,
  LayoutGrid,
  Rows3,
} from "lucide-react";

const typeConfig: Record<
  CardType,
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  fleeting: {
    icon: Sparkles,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200 hover:border-amber-300",
  },
  literature: {
    icon: BookOpen,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200 hover:border-blue-300",
  },
  permanent: {
    icon: StickyNote,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200 hover:border-emerald-300",
  },
  project: {
    icon: FolderKanban,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200 hover:border-purple-300",
  },
};

function formatTime(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

// 单张卡片组件 - 真正的"卡片"视觉
function NoteCard({
  card,
  isSelected,
  isStacked,
  stackIndex,
}: {
  card: Card;
  isSelected: boolean;
  isStacked?: boolean;
  stackIndex?: number;
}) {
  const { selectCard } = useAppStore();
  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-xl border-2 bg-white p-4 shadow-sm transition-all duration-200",
        config.border,
        isSelected && "ring-2 ring-primary ring-offset-2",
        !isStacked && "hover:shadow-md hover:-translate-y-1",
        isStacked && "absolute"
      )}
      style={
        isStacked
          ? {
              top: (stackIndex || 0) * 4,
              left: (stackIndex || 0) * 4,
              zIndex: 10 - (stackIndex || 0),
            }
          : undefined
      }
      onClick={() => selectCard(card.id)}
    >
      {/* 卡片类型标签 - 像贴在卡片上的标签 */}
      <div
        className={cn(
          "absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm",
          config.bg
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      {/* 卡片内容 */}
      <div className="pr-4">
        <h3 className="mb-2 font-medium leading-tight line-clamp-2">
          {card.title || "无标题"}
        </h3>
        <p className="mb-3 text-sm text-muted-foreground line-clamp-3">
          {card.content || "点击开始编辑..."}
        </p>
      </div>

      {/* 卡片底部 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTime(card.updatedAt)}</span>
        <div className="flex items-center gap-2">
          {card.links.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Link2 className="h-3 w-3" />
              {card.links.length}
            </span>
          )}
        </div>
      </div>

      {/* 标签 */}
      {card.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 border-t pt-3">
          {card.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 卡片盒组件 - 像真正的盒子
function CardBox({
  type,
  label,
  icon: Icon,
  count,
  isActive,
  onClick,
  color,
}: {
  type: ViewType;
  label: string;
  icon: React.ElementType;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all",
        isActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/50"
      )}
    >
      {/* 盒子图标 */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg",
          color
        )}
      >
        <Icon className="h-6 w-6" />
      </div>

      {/* 盒子标签 */}
      <span className="text-sm font-medium">{label}</span>

      {/* 卡片数量 - 像盒子上的标签 */}
      <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {count}
      </div>
    </button>
  );
}

// 收件箱 - 临时存放闪念的地方
function InboxSection({
  cards,
  onSelect,
}: {
  cards: Card[];
  onSelect: (id: string) => void;
}) {
  const fleetingCards = cards.filter((c) => c.type === "fleeting").slice(0, 3);

  if (fleetingCards.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <Inbox className="h-5 w-5 text-amber-500" />
        <h2 className="font-semibold">收件箱</h2>
        <span className="text-sm text-muted-foreground">
          {fleetingCards.length} 条待整理
        </span>
      </div>

      {/* 卡片堆叠效果 */}
      <div className="relative h-40 w-64">
        {fleetingCards.map((card, index) => (
          <div
            key={card.id}
            className={cn(
              "absolute cursor-pointer rounded-xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm transition-all hover:shadow-md",
              "hover:-translate-y-2"
            )}
            style={{
              top: index * 8,
              left: index * 8,
              zIndex: fleetingCards.length - index,
              transform: `rotate(${(index - 1) * 2}deg)`,
            }}
            onClick={() => onSelect(card.id)}
          >
            <div className="w-48">
              <p className="text-sm font-medium line-clamp-2">
                {card.title || "无标题闪念"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(card.updatedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardWorkspaceProps {
  onSearch: () => void;
  onCreateCard: () => void;
}

export function CardWorkspace({ onSearch, onCreateCard }: CardWorkspaceProps) {
  const {
    cards,
    currentView,
    setCurrentView,
    selectedCardId,
    selectCard,
    filteredCards,
  } = useAppStore();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const displayCards = filteredCards();

  const boxes: {
    type: ViewType;
    label: string;
    icon: React.ElementType;
    color: string;
  }[] = [
    {
      type: "all",
      label: "全部",
      icon: Archive,
      color: "bg-slate-100 text-slate-600",
    },
    {
      type: "fleeting",
      label: "闪念",
      icon: Sparkles,
      color: "bg-amber-100 text-amber-600",
    },
    {
      type: "literature",
      label: "文献",
      icon: BookOpen,
      color: "bg-blue-100 text-blue-600",
    },
    {
      type: "permanent",
      label: "永久",
      icon: StickyNote,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      type: "project",
      label: "项目",
      icon: FolderKanban,
      color: "bg-purple-100 text-purple-600",
    },
  ];

  const getCounts = (type: ViewType) => {
    if (type === "all") return cards.length;
    return cards.filter((c) => c.type === type).length;
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b bg-white/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            Z
          </div>
          <div>
            <h1 className="text-lg font-semibold">Zentri</h1>
            <p className="text-sm text-muted-foreground">
              你的卡片盒 · {cards.length} 张卡片
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSearch}>
            <Search className="h-4 w-4" />
            搜索
            <kbd className="ml-2 rounded border bg-muted px-1.5 text-xs">
              ⌘K
            </kbd>
          </Button>
          <Button size="sm" onClick={onCreateCard}>
            <Plus className="h-4 w-4" />
            新建卡片
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* 收件箱区域 - 显示待整理的闪念 */}
          {currentView === "all" && (
            <InboxSection cards={cards} onSelect={selectCard} />
          )}

          {/* 卡片盒选择区 */}
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              卡片盒
            </h2>
            <div className="flex flex-wrap gap-4">
              {boxes.map((box) => (
                <CardBox
                  key={box.type}
                  type={box.type}
                  label={box.label}
                  icon={box.icon}
                  count={getCounts(box.type)}
                  isActive={currentView === box.type}
                  onClick={() => setCurrentView(box.type)}
                  color={box.color}
                />
              ))}
            </div>
          </div>

          {/* 视图切换和标题 */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">
              {currentView === "all"
                ? "全部卡片"
                : boxes.find((b) => b.type === currentView)?.label}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {displayCards.length} 张
              </span>
            </h2>

            <div className="flex items-center gap-1 rounded-lg border p-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>网格视图</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => setViewMode("list")}
                    >
                      <Rows3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>列表视图</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* 卡片展示区 */}
          {displayCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Archive className="mb-4 h-16 w-16 opacity-20" />
              <p>这个盒子里还没有卡片</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={onCreateCard}
              >
                创建第一张卡片
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayCards.map((card) => (
                <NoteCard
                  key={card.id}
                  card={card}
                  isSelected={selectedCardId === card.id}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {displayCards.map((card) => {
                const config = typeConfig[card.type];
                const Icon = config.icon;
                return (
                  <div
                    key={card.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-lg border bg-white p-3 transition-all hover:shadow-sm",
                      selectedCardId === card.id && "ring-2 ring-primary"
                    )}
                    onClick={() => selectCard(card.id)}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        config.bg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {card.title || "无标题"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {card.content || "暂无内容"}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {formatTime(card.updatedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}


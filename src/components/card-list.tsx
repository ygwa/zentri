import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Card, CardType, EditorContent } from "@/types";
import { Sparkles, BookOpen, StickyNote, FolderKanban } from "lucide-react";

// 辅助函数：将 content 转换为字符串
function contentToString(content: string | EditorContent | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

const typeConfig: Record<CardType, { icon: React.ElementType; color: string }> = {
  fleeting: { icon: Sparkles, color: "text-amber-500" },
  literature: { icon: BookOpen, color: "text-blue-500" },
  permanent: { icon: StickyNote, color: "text-emerald-500" },
  project: { icon: FolderKanban, color: "text-purple-500" },
};

function formatTime(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

function CardItem({ card, isSelected }: { card: Card; isSelected: boolean }) {
  const { selectCard } = useAppStore();
  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-lg border p-3 transition-colors",
        isSelected
          ? "border-primary bg-accent"
          : "border-transparent hover:border-border hover:bg-accent/50"
      )}
      onClick={() => selectCard(card.id)}
    >
      {/* 头部 */}
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className="text-xs text-muted-foreground">
          {formatTime(card.updatedAt)}
        </span>
        {card.links.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {card.links.length} 链接
          </span>
        )}
      </div>

      {/* 标题 */}
      <h3 className="mb-1 font-medium leading-snug line-clamp-2">
        {card.title || "无标题"}
      </h3>

      {/* 预览 */}
      <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
        {contentToString(card.content) || "暂无内容"}
      </p>

      {/* 标签 */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {card.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{card.tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function CardList() {
  const { filteredCards, selectedCardId, currentView } = useAppStore();
  const cards = filteredCards();

  const viewLabels: Record<string, string> = {
    all: "全部卡片",
    fleeting: "闪念",
    literature: "文献笔记",
    permanent: "永久笔记",
    project: "项目",
  };

  return (
    <div className="flex h-full w-80 flex-col border-r">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">{viewLabels[currentView]}</h2>
        <span className="text-sm text-muted-foreground">{cards.length} 张</span>
      </div>

      {/* 卡片列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {cards.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              暂无卡片
            </div>
          ) : (
            cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                isSelected={selectedCardId === card.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}


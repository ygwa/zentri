import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Link2,
  Tag,
  Clock,
  Sparkles,
  BookOpen,
  StickyNote,
  FolderKanban,
  X,
  ArrowRight,
  ChevronRight,
  CornerDownRight,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { CardType } from "@/types";

const typeConfig: Record<
  CardType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    description: string;
  }
> = {
  fleeting: {
    label: "闪念",
    icon: Sparkles,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    description: "临时的想法，等待整理",
  },
  literature: {
    label: "文献",
    icon: BookOpen,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    description: "来自阅读的笔记",
  },
  permanent: {
    label: "永久",
    icon: StickyNote,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    description: "经过提炼的知识",
  },
  project: {
    label: "项目",
    icon: FolderKanban,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    description: "项目相关的内容",
  },
};

function LinkedCardPreview({
  cardId,
  direction,
}: {
  cardId: string;
  direction: "in" | "out";
}) {
  const { getCardById, selectCard } = useAppStore();
  const card = getCardById(cardId);

  if (!card) return null;

  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:shadow-sm",
        config.border,
        config.bg
      )}
      onClick={() => selectCard(card.id)}
    >
      <div className="mt-0.5">
        {direction === "out" ? (
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <CornerDownRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className="text-sm font-medium truncate">{card.title}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {card.content}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

export function CardEditor() {
  const {
    selectedCardId,
    getCardById,
    updateCard,
    deleteCard,
    selectCard,
    cards,
  } = useAppStore();
  const card = selectedCardId ? getCardById(selectedCardId) : null;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");

  // 同步卡片数据
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setContent(card.content);
    }
  }, [card]);

  // 自动保存
  useEffect(() => {
    if (!card) return;
    const timer = setTimeout(() => {
      if (title !== card.title || content !== card.content) {
        updateCard(card.id, { title, content });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, content, card, updateCard]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim() && card) {
      e.preventDefault();
      if (!card.tags.includes(tagInput.trim())) {
        updateCard(card.id, { tags: [...card.tags, tagInput.trim()] });
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (card) {
      updateCard(card.id, { tags: card.tags.filter((t) => t !== tag) });
    }
  };

  const handleTypeChange = (type: CardType) => {
    if (card) {
      updateCard(card.id, { type });
    }
  };

  const handleDelete = () => {
    if (card && confirm("确定要删除这张卡片吗？")) {
      deleteCard(card.id);
    }
  };

  // 获取关联的卡片
  const linkedCards =
    card?.links
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean) ?? [];

  // 获取反向链接
  const backlinks = cards.filter((c) => c.links.includes(card?.id ?? ""));

  if (!card) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-muted-foreground">
        <div className="relative mb-8">
          {/* 空状态的卡片堆叠效果 */}
          <div className="absolute -top-4 -left-4 h-32 w-48 rotate-[-8deg] rounded-xl border-2 border-dashed border-muted-foreground/20 bg-white/50" />
          <div className="absolute -top-2 -left-2 h-32 w-48 rotate-[-4deg] rounded-xl border-2 border-dashed border-muted-foreground/20 bg-white/70" />
          <div className="relative h-32 w-48 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-white/90 p-4">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-3 h-2 w-full rounded bg-muted" />
            <div className="mt-2 h-2 w-3/4 rounded bg-muted" />
          </div>
        </div>
        <p className="text-lg font-medium">选择一张卡片</p>
        <p className="mt-1 text-sm">从左侧选择卡片开始编辑</p>
        <p className="mt-4 text-xs">
          或按 <kbd className="rounded border bg-white px-1.5 py-0.5">⌘N</kbd>{" "}
          创建新卡片
        </p>
      </div>
    );
  }

  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 卡片编辑器 - 像真正的卡片 */}
      <ScrollArea className="flex-1 p-6">
        <div
          className={cn(
            "mx-auto max-w-2xl rounded-2xl border-2 bg-white shadow-lg",
            config.border
          )}
        >
          {/* 卡片类型头部 */}
          <div
            className={cn(
              "flex items-center justify-between rounded-t-xl px-6 py-3",
              config.bg
            )}
          >
            <div className="flex items-center gap-3">
              <Select value={card.type} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-auto gap-2 border-0 bg-transparent shadow-none">
                  <Icon className={cn("h-5 w-5", config.color)} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([key, val]) => {
                    const TypeIcon = val.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <TypeIcon className={cn("h-4 w-4", val.color)} />
                          <span>{val.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {config.description}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => selectCard(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 卡片主体 */}
          <div className="p-6">
            {/* 标题 */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="卡片标题"
              className="w-full border-0 bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/50"
            />

            {/* 元信息 */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(card.updatedAt).toLocaleString("zh-CN")}
              </span>
              {linkedCards.length > 0 && (
                <span className="flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {linkedCards.length} 出链
                </span>
              )}
              {backlinks.length > 0 && (
                <span className="flex items-center gap-1">
                  <CornerDownRight className="h-3 w-3" />
                  {backlinks.length} 入链
                </span>
              )}
            </div>

            <Separator className="my-4" />

            {/* 内容编辑 */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在这里写下你的想法..."
              className="min-h-[200px] w-full resize-none border-0 bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/50"
            />

            <Separator className="my-4" />

            {/* 标签 */}
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {card.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer gap-1 transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="添加标签..."
                className="h-6 w-24 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* 关联卡片区域 */}
        {(linkedCards.length > 0 || backlinks.length > 0) && (
          <div className="mx-auto mt-6 max-w-2xl">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link2 className="h-4 w-4" />
              关联的卡片
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* 出链 */}
              {linkedCards.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    链接到 →
                  </p>
                  <div className="space-y-2">
                    {linkedCards.map(
                      (linked) =>
                        linked && (
                          <LinkedCardPreview
                            key={linked.id}
                            cardId={linked.id}
                            direction="out"
                          />
                        )
                    )}
                  </div>
                </div>
              )}

              {/* 入链 */}
              {backlinks.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    被引用 ←
                  </p>
                  <div className="space-y-2">
                    {backlinks.map((linked) => (
                      <LinkedCardPreview
                        key={linked.id}
                        cardId={linked.id}
                        direction="in"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* 底部状态栏 */}
      <div className="border-t bg-white/80 px-6 py-2 text-xs text-muted-foreground backdrop-blur">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          已自动保存
        </span>
      </div>
    </div>
  );
}


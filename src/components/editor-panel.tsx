import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreHorizontal,
  Trash2,
  Link2,
  Tag,
  Clock,
  Sparkles,
  BookOpen,
  StickyNote,
  FolderKanban,
  X,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { CardType } from "@/types";

const typeConfig: Record<CardType, { label: string; icon: React.ElementType; color: string }> = {
  fleeting: { label: "闪念", icon: Sparkles, color: "text-amber-500 bg-amber-500/10" },
  literature: { label: "文献", icon: BookOpen, color: "text-blue-500 bg-blue-500/10" },
  permanent: { label: "永久", icon: StickyNote, color: "text-emerald-500 bg-emerald-500/10" },
  project: { label: "项目", icon: FolderKanban, color: "text-purple-500 bg-purple-500/10" },
};

export function EditorPanel() {
  const { selectedCardId, getCardById, updateCard, deleteCard, selectCard, cards } = useAppStore();
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

  const handleDelete = () => {
    if (card && confirm("确定要删除这张卡片吗？")) {
      deleteCard(card.id);
    }
  };

  // 获取关联的卡片
  const linkedCards = card?.links
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) ?? [];

  // 获取反向链接
  const backlinks = cards.filter((c) => c.links.includes(card?.id ?? ""));

  if (!card) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <StickyNote className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p>选择一张卡片开始编辑</p>
          <p className="mt-1 text-sm">或按 ⌘N 创建新卡片</p>
        </div>
      </div>
    );
  }

  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <div className="flex flex-1 flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("gap-1", config.color)}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            自动保存
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除卡片</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon-sm" onClick={() => selectCard(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 主编辑区 */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-2xl p-6">
            {/* 标题 */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="卡片标题"
              className="w-full border-0 bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground"
            />

            {/* 元信息 */}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(card.updatedAt).toLocaleString("zh-CN")}
              </span>
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                {card.links.length} 出链
              </span>
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3 rotate-180" />
                {backlinks.length} 入链
              </span>
            </div>

            {/* 标签 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {card.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag}
                  <X className="ml-1 h-3 w-3" />
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

            <Separator className="my-6" />

            {/* 内容编辑 */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="开始写作..."
              className="min-h-[300px] w-full resize-none border-0 bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground"
            />
          </div>
        </ScrollArea>

        {/* 关联面板 */}
        <div className="w-60 border-l">
          <ScrollArea className="h-full">
            <div className="p-4">
              <h3 className="mb-3 text-sm font-medium">关联卡片</h3>
              
              {/* 出链 */}
              {linkedCards.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs text-muted-foreground">出链</p>
                  <div className="space-y-1">
                    {linkedCards.map((linked) => linked && (
                      <div
                        key={linked.id}
                        className="cursor-pointer rounded-md p-2 text-sm hover:bg-accent"
                        onClick={() => selectCard(linked.id)}
                      >
                        {linked.title || "无标题"}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 入链 */}
              {backlinks.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs text-muted-foreground">入链</p>
                  <div className="space-y-1">
                    {backlinks.map((linked) => (
                      <div
                        key={linked.id}
                        className="cursor-pointer rounded-md p-2 text-sm hover:bg-accent"
                        onClick={() => selectCard(linked.id)}
                      >
                        {linked.title || "无标题"}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {linkedCards.length === 0 && backlinks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  暂无关联卡片
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}


import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Sparkles, BookOpen, StickyNote, FolderKanban } from "lucide-react";
import { useAppStore } from "@/store";
import type { CardType } from "@/types";

const cardTypes: { id: CardType; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  {
    id: "fleeting",
    label: "闪念",
    desc: "临时想法，稍后整理",
    icon: Sparkles,
    color: "border-amber-500 bg-amber-500/10 text-amber-600",
  },
  {
    id: "literature",
    label: "文献",
    desc: "阅读笔记，引用来源",
    icon: BookOpen,
    color: "border-blue-500 bg-blue-500/10 text-blue-600",
  },
  {
    id: "permanent",
    label: "永久",
    desc: "原子化知识点",
    icon: StickyNote,
    color: "border-emerald-500 bg-emerald-500/10 text-emerald-600",
  },
  {
    id: "project",
    label: "项目",
    desc: "项目相关内容",
    icon: FolderKanban,
    color: "border-purple-500 bg-purple-500/10 text-purple-600",
  },
];

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCardDialog({ open, onOpenChange }: CreateCardDialogProps) {
  const { createCard, selectCard } = useAppStore();
  const [type, setType] = useState<CardType>("fleeting");
  const [title, setTitle] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    const card = await createCard(type, title.trim());
    selectCard(card.id);
    onOpenChange(false);
    setTitle("");
    setType("fleeting");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建卡片</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 卡片类型选择 */}
          <div className="grid grid-cols-2 gap-2">
            {cardTypes.map((ct) => {
              const Icon = ct.icon;
              return (
                <button
                  key={ct.id}
                  onClick={() => setType(ct.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                    type === ct.id ? ct.color : "border-transparent hover:bg-accent"
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">{ct.label}</p>
                    <p className="text-xs text-muted-foreground">{ct.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 标题输入 */}
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入卡片标题..."
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


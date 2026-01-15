import { useState, useEffect } from "react";
import { Bookmark, Edit2, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Bookmark as BookmarkType } from "@/types";
import * as api from "@/services/api";

interface BookmarkPanelProps {
  sourceId: string;
  onNavigate?: (position: string) => void;
  className?: string;
}

export function BookmarkPanel({ sourceId, onNavigate, className }: BookmarkPanelProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNote, setEditNote] = useState("");

  // 加载书签
  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        if (api.isTauriEnv()) {
          const data = await api.bookmarks.getBySource(sourceId);
          setBookmarks(data);
        }
      } catch (err) {
        console.error("Failed to load bookmarks:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadBookmarks();
  }, [sourceId]);

  // 处理编辑
  const handleEdit = (bookmark: BookmarkType) => {
    setEditingId(bookmark.id);
    setEditLabel(bookmark.label || "");
    setEditNote(bookmark.note || "");
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      if (api.isTauriEnv()) {
        const updated = await api.bookmarks.update(editingId, {
          label: editLabel || undefined,
          note: editNote || undefined,
        });
        if (updated) {
          setBookmarks(prev => prev.map(b => b.id === editingId ? updated : b));
        }
      }
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update bookmark:", err);
    }
  };

  // 删除书签
  const handleDelete = async (id: string) => {
    try {
      if (api.isTauriEnv()) {
        await api.bookmarks.delete(id);
      }
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error("Failed to delete bookmark:", err);
    }
  };

  // 跳转到书签位置
  const handleNavigate = (position: string) => {
    if (onNavigate) {
      onNavigate(position);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        加载中...
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4" />
          <span className="text-sm font-medium">书签</span>
          <span className="text-xs text-muted-foreground">({bookmarks.length})</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {bookmarks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            暂无书签
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors group"
            >
              {editingId === bookmark.id ? (
                <div className="space-y-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="书签标签"
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <Textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="备注"
                    className="min-h-[60px] text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} className="flex-1 h-7 text-xs">
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      className="flex-1 h-7 text-xs"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {bookmark.label ? (
                        <div className="text-sm font-medium mb-1 truncate">
                          {bookmark.label}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mb-1">
                          位置: {bookmark.position.substring(0, 30)}...
                        </div>
                      )}
                      {bookmark.note && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {bookmark.note}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleEdit(bookmark)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleDelete(bookmark.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs justify-start"
                    onClick={() => handleNavigate(bookmark.position)}
                  >
                    <ChevronRight className="h-3 w-3 mr-1" />
                    跳转到此处
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}





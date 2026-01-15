import { useState } from "react";
import { Edit2, Trash2, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HighlightColorPicker } from "./highlight-color-picker";

import type { Highlight } from "@/types";

interface HighlightContextMenuProps {
  highlight: Highlight;
  position: { x: number; y: number };
  onEdit?: (id: string, note: string) => void;
  onDelete?: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onClose: () => void;
}

export function HighlightContextMenu({
  highlight,
  position,
  onEdit,
  onDelete,
  onColorChange,
  onClose,
}: HighlightContextMenuProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(highlight.note || "");

  const handleSaveNote = () => {
    if (onEdit) {
      onEdit(highlight.id, note);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(highlight.id);
    }
    onClose();
  };

  const handleColorChange = (color: string) => {
    if (onColorChange) {
      onColorChange(highlight.id, color);
    }
  };

  return (
    <div
      className="fixed z-50 bg-popover border rounded-lg shadow-xl p-3 min-w-[280px] max-w-[400px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -100%)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">高亮内容</p>
          <p className="text-xs text-muted-foreground italic line-clamp-2">
            "{highlight.content}"
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加笔记..."
            className="min-h-[80px] text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveNote} className="flex-1">
              保存
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setNote(highlight.note || "");
              }}
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      ) : (
        <>
          {highlight.note && (
            <div className="mb-2 p-2 bg-muted rounded text-xs">
              {highlight.note}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-2" />
              {highlight.note ? "编辑笔记" : "添加笔记"}
            </Button>

            <div className="flex items-center gap-2 px-2 py-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mr-2">颜色:</span>
              <HighlightColorPicker
                selectedColor={highlight.color}
                onColorSelect={handleColorChange}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 text-xs text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              删除高亮
            </Button>
          </div>
        </>
      )}
    </div>
  );
}





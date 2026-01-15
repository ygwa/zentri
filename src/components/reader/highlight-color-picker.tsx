import { Underline, Strikethrough, Highlighter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnotationType } from "@/types";

// 高亮颜色选项（参考微信读书）
export const HIGHLIGHT_COLORS = [
  {
    id: "yellow",
    name: "黄色",
    color: "rgba(255, 235, 59, 0.4)",
    borderColor: "rgba(255, 235, 59, 0.8)",
  },
  {
    id: "green",
    name: "绿色",
    color: "rgba(129, 199, 132, 0.4)",
    borderColor: "rgba(129, 199, 132, 0.8)",
  },
  {
    id: "blue",
    name: "蓝色",
    color: "rgba(100, 181, 246, 0.4)",
    borderColor: "rgba(100, 181, 246, 0.8)",
  },
  {
    id: "red",
    name: "红色",
    color: "rgba(239, 83, 80, 0.4)",
    borderColor: "rgba(239, 83, 80, 0.8)",
  },
  {
    id: "purple",
    name: "紫色",
    color: "rgba(171, 71, 188, 0.4)",
    borderColor: "rgba(171, 71, 188, 0.8)",
  },
] as const;

export type HighlightColorId = typeof HIGHLIGHT_COLORS[number]["id"];

// 标注类型选项
export const ANNOTATION_TYPES: Array<{ type: AnnotationType; label: string; icon: typeof Highlighter }> = [
  { type: "highlight", label: "高亮", icon: Highlighter },
  { type: "underline", label: "下划线", icon: Underline },
  { type: "strikethrough", label: "删除线", icon: Strikethrough },
];

interface HighlightColorPickerProps {
  selectedColor?: string;
  selectedType?: AnnotationType;
  onColorSelect: (color: string) => void;
  onTypeSelect?: (type: AnnotationType) => void;
  showTypeSelector?: boolean; // 是否显示类型选择器
  className?: string;
}

export function HighlightColorPicker({
  selectedColor,
  selectedType = "highlight",
  onColorSelect,
  onTypeSelect,
  showTypeSelector = false,
  className,
}: HighlightColorPickerProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 标注类型选择器 */}
      {showTypeSelector && onTypeSelect && (
        <div className="flex items-center gap-1 border-r pr-2 mr-1">
          {ANNOTATION_TYPES.map((typeOption) => {
            const Icon = typeOption.icon;
            const isSelected = selectedType === typeOption.type;
            return (
              <button
                key={typeOption.type}
                onClick={() => onTypeSelect(typeOption.type)}
                className={cn(
                  "p-1.5 rounded transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
                title={typeOption.label}
                aria-label={`选择${typeOption.label}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      )}
      
      {/* 颜色选择器 */}
      <div className="flex items-center gap-1.5">
        {HIGHLIGHT_COLORS.map((colorOption) => {
          const isSelected =
            selectedColor === colorOption.color ||
            (!selectedColor && colorOption.id === "yellow");
          
          return (
            <button
              key={colorOption.id}
              onClick={() => onColorSelect(colorOption.color)}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                isSelected
                  ? "border-foreground shadow-md scale-110"
                  : "border-transparent hover:border-foreground/50"
              )}
              style={{
                backgroundColor: colorOption.color,
                borderColor: isSelected
                  ? colorOption.borderColor
                  : "transparent",
              }}
              title={colorOption.name}
              aria-label={`选择${colorOption.name}高亮`}
            />
          );
        })}
      </div>
    </div>
  );
}


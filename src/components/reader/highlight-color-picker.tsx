import { cn } from "@/lib/utils";

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

interface HighlightColorPickerProps {
  selectedColor?: string;
  onColorSelect: (color: string) => void;
  className?: string;
}

export function HighlightColorPicker({
  selectedColor,
  onColorSelect,
  className,
}: HighlightColorPickerProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
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
  );
}


import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Type } from "lucide-react";
import { cn } from "@/lib/utils";

// 字体选项（参考微信读书）
export const FONT_OPTIONS = [
  {
    id: "system",
    name: "系统默认",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    description: "使用系统默认字体",
  },
  {
    id: "serif",
    name: "衬线字体",
    fontFamily: "'Times New Roman', 'Songti SC', 'SimSun', serif",
    description: "传统印刷字体，适合长文阅读",
  },
  {
    id: "sans-serif",
    name: "无衬线字体",
    fontFamily: "'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    description: "现代简洁字体，易读性强",
  },
  {
    id: "mono",
    name: "等宽字体",
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace",
    description: "等宽字体，适合代码和技术文档",
  },
  {
    id: "kai",
    name: "楷体",
    fontFamily: "'KaiTi', 'STKaiti', '楷体', serif",
    description: "中文楷体，传统优雅",
  },
  {
    id: "song",
    name: "宋体",
    fontFamily: "'SimSun', '宋体', 'NSimSun', serif",
    description: "中文宋体，经典阅读字体",
  },
] as const;

export type FontId = typeof FONT_OPTIONS[number]["id"];

interface FontSelectorProps {
  selectedFont?: string;
  onFontSelect: (fontFamily: string, fontId: FontId) => void;
  className?: string;
}

export function FontSelector({
  selectedFont,
  onFontSelect,
  className,
}: FontSelectorProps) {
  // 根据 fontFamily 找到对应的字体选项
  const currentFont = FONT_OPTIONS.find(
    (font) => font.fontFamily === selectedFont
  ) || FONT_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", className)}
          title="选择字体"
        >
          <Type className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {FONT_OPTIONS.map((font) => (
          <DropdownMenuItem
            key={font.id}
            onClick={() => onFontSelect(font.fontFamily, font.id)}
            className={cn(
              "flex flex-col items-start gap-1 py-2.5",
              currentFont.id === font.id && "bg-accent"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium text-sm">{font.name}</span>
              {currentFont.id === font.id && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {font.description}
            </span>
            <span
              className="text-xs text-muted-foreground/70 mt-1"
              style={{ fontFamily: font.fontFamily }}
            >
              Aa 字体预览
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}







/**
 * 建议5: 快捷键提示增强
 * 在 Tooltip 中显示快捷键组合
 */
import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// 检测是否是 Mac
const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

// 快捷键符号映射
const keySymbols: Record<string, string> = {
  cmd: isMac ? '⌘' : 'Ctrl',
  ctrl: isMac ? '⌃' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: '⇧',
  enter: '↵',
  backspace: '⌫',
  delete: '⌦',
  escape: 'Esc',
  tab: '⇥',
  space: '␣',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

// 格式化快捷键
function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map(key => {
      const k = key.trim().toLowerCase();
      return keySymbols[k] || key.trim().toUpperCase();
    })
    .join(isMac ? '' : '+');
}

interface KbdProps {
  keys: string; // e.g. "cmd+s", "cmd+shift+p"
  className?: string;
}

// 单独的快捷键显示组件
export function Kbd({ keys, className }: KbdProps) {
  const formatted = formatShortcut(keys);
  
  return (
    <kbd
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded",
        "bg-muted/80 text-muted-foreground text-[10px] font-mono",
        "border border-border/50 shadow-sm",
        className
      )}
    >
      {formatted}
    </kbd>
  );
}

interface KbdTooltipProps {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

// 带快捷键提示的 Tooltip
export function KbdTooltip({
  children,
  label,
  shortcut,
  side = "bottom",
  className,
}: KbdTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5",
          className
        )}
      >
        <span className="text-xs">{label}</span>
        {shortcut && <Kbd keys={shortcut} />}
      </TooltipContent>
    </Tooltip>
  );
}







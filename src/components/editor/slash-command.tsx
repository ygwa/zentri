import { useEffect, useRef, useState } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table,
  Image,
  Type,
  Sparkles,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  keywords: string[];
  group: string;
  shortcut?: string;
}

const commands: CommandItem[] = [
  // 文本
  {
    id: "text",
    label: "正文",
    description: "普通段落文本",
    icon: Type,
    keywords: ["text", "paragraph", "正文", "段落"],
    group: "基础",
  },
  {
    id: "heading1",
    label: "一级标题",
    description: "大标题",
    icon: Heading1,
    keywords: ["h1", "heading", "标题", "大标题"],
    group: "基础",
    shortcut: "#",
  },
  {
    id: "heading2",
    label: "二级标题",
    description: "中标题",
    icon: Heading2,
    keywords: ["h2", "heading", "标题", "中标题"],
    group: "基础",
    shortcut: "##",
  },
  {
    id: "heading3",
    label: "三级标题",
    description: "小标题",
    icon: Heading3,
    keywords: ["h3", "heading", "标题", "小标题"],
    group: "基础",
    shortcut: "###",
  },
  // 列表
  {
    id: "bullet",
    label: "无序列表",
    description: "创建项目符号列表",
    icon: List,
    keywords: ["bullet", "list", "ul", "无序", "列表"],
    group: "列表",
    shortcut: "-",
  },
  {
    id: "numbered",
    label: "有序列表",
    description: "创建编号列表",
    icon: ListOrdered,
    keywords: ["numbered", "list", "ol", "有序", "列表", "编号"],
    group: "列表",
    shortcut: "1.",
  },
  {
    id: "todo",
    label: "待办事项",
    description: "带复选框的任务列表",
    icon: CheckSquare,
    keywords: ["todo", "task", "checkbox", "待办", "任务"],
    group: "列表",
    shortcut: "[]",
  },
  // 块元素
  {
    id: "quote",
    label: "引用",
    description: "创建引用块",
    icon: Quote,
    keywords: ["quote", "blockquote", "引用"],
    group: "块",
    shortcut: ">",
  },
  {
    id: "code",
    label: "代码块",
    description: "带语法高亮的代码",
    icon: Code,
    keywords: ["code", "codeblock", "代码"],
    group: "块",
    shortcut: "```",
  },
  {
    id: "divider",
    label: "分割线",
    description: "水平分割线",
    icon: Minus,
    keywords: ["divider", "hr", "分割", "横线"],
    group: "块",
    shortcut: "---",
  },
  // 高级
  {
    id: "link",
    label: "链接卡片",
    description: "链接到其他卡片 [[",
    icon: Link2,
    keywords: ["link", "卡片", "链接", "双链", "wikilink"],
    group: "高级",
    shortcut: "[[",
  },
  {
    id: "table",
    label: "表格",
    description: "创建 3x3 表格",
    icon: Table,
    keywords: ["table", "表格"],
    group: "高级",
  },
  {
    id: "image",
    label: "图片",
    description: "嵌入图片",
    icon: Image,
    keywords: ["image", "img", "图片"],
    group: "高级",
  },
];

interface SlashCommandMenuProps {
  query: string;
  position: { x: number; y: number };
  onSelect: (command: string) => void | Promise<void>;
  onClose: () => void;
}

export function SlashCommandMenu({
  query,
  position,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // 过滤命令
  const filteredCommands = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  // 按组分类
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? filteredCommands.length - 1 : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          onSelect(cmd.id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // 滚动到选中项
  useEffect(() => {
    const selected = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filteredCommands.length === 0) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 bg-popover border rounded-lg shadow-lg p-3 w-64"
        style={{ left: position.x, top: position.y }}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm">没有找到匹配的命令</span>
        </div>
      </div>
    );
  }

  let flatIndex = 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border rounded-lg shadow-xl w-72 max-h-80 overflow-y-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div className="p-1.5">
        {Object.entries(groupedCommands).map(([group, items]) => (
          <div key={group}>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group}
            </div>
            {items.map((cmd) => {
              const currentIndex = flatIndex++;
              const Icon = cmd.icon;
              const isSelected = currentIndex === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  data-index={currentIndex}
                  onClick={() => onSelect(cmd.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all",
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      "bg-muted/80 border",
                      isSelected && "bg-primary/20 border-primary/30"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium",
                      isSelected && "text-primary"
                    )}>
                      {cmd.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {cmd.description}
                    </div>
                  </div>
                  {cmd.shortcut && (
                    <div className="flex-shrink-0">
                      <kbd className="px-1.5 py-0.5 bg-muted/80 rounded text-[10px] text-muted-foreground font-mono">
                        {cmd.shortcut}
                      </kbd>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* 底部提示 */}
      <div className="border-t px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↓</kbd>
            导航
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
            选择
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
            关闭
          </span>
        </div>
      </div>
    </div>
  );
}


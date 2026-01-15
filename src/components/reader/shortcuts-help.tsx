import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShortcutsHelpProps {
  onClose: () => void;
  className?: string;
}

export function ShortcutsHelp({ onClose, className }: ShortcutsHelpProps) {
  const shortcuts = [
    { key: "← / →", description: "翻页" },
    { key: "PageUp / PageDown", description: "翻页" },
    { key: "B", description: "添加书签" },
    { key: "Shift + B", description: "切换书签面板" },
    { key: "T", description: "切换目录" },
    { key: "?", description: "显示快捷键帮助" },
  ];

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
      <div className="bg-popover border rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">快捷键</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          {shortcuts.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}





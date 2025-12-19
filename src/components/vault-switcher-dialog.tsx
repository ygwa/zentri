import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderOpen, Loader2 } from "lucide-react";
import { useAppStore } from "@/store";
import { isTauriEnv } from "@/services/api";

interface VaultSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VaultSwitcherDialog({
  open,
  onOpenChange,
}: VaultSwitcherDialogProps) {
  const { vaultPath, setVaultPath, isLoading } = useAppStore();
  const [path, setPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 当对话框打开时，初始化路径为当前 vault 路径
  useEffect(() => {
    if (open) {
      setPath(vaultPath || "");
    }
  }, [open, vaultPath]);

  const handleSubmit = async () => {
    if (!path.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await setVaultPath(path.trim());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to set vault path:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBrowse = async () => {
    if (isTauriEnv()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "选择笔记库文件夹",
        });
        if (selected && typeof selected === "string") {
          setPath(selected);
        }
      } catch (err) {
        console.error("Failed to open folder dialog:", err);
      }
    } else {
      // 非 Tauri 环境使用默认路径
      setPath("~/Documents/Zentri");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>切换笔记库</DialogTitle>
          <DialogDescription>
            选择一个新的笔记库位置。所有笔记将以 Markdown 文件形式存储在这个文件夹中。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">笔记库路径</label>
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="例如: ~/Documents/Zentri"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={isSubmitting || isLoading}
              />
              <Button
                variant="outline"
                onClick={handleBrowse}
                disabled={isSubmitting || isLoading}
                type="button"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                浏览...
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              如果文件夹不存在，将自动创建
            </p>
          </div>

          {vaultPath && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-1 text-muted-foreground">
                当前笔记库：
              </p>
              <p className="text-sm font-mono text-foreground break-all">
                {vaultPath}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isLoading}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!path.trim() || isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                切换中...
              </>
            ) : (
              "确认切换"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

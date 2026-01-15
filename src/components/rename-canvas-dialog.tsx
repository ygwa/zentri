import { useState, useEffect } from "react";
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
import { Pencil } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface RenameCanvasDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canvasId: string;
    currentTitle: string;
    onRenamed: () => void;
}

export function RenameCanvasDialog({
    open,
    onOpenChange,
    canvasId,
    currentTitle,
    onRenamed,
}: RenameCanvasDialogProps) {
    const [title, setTitle] = useState(currentTitle);
    const [isRenaming, setIsRenaming] = useState(false);

    useEffect(() => {
        if (open) {
            setTitle(currentTitle);
        }
    }, [open, currentTitle]);

    const handleRename = async () => {
        if (!title.trim() || title.trim() === currentTitle) {
            onOpenChange(false);
            return;
        }

        setIsRenaming(true);
        try {
            await invoke("update_canvas", {
                id: canvasId,
                title: title.trim(),
            });
            onRenamed();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to rename canvas:", error);
            alert(`重命名失败: ${error}`);
        } finally {
            setIsRenaming(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-blue-500" />
                        Rename Board
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="rename-title">Name</Label>
                        <Input
                            id="rename-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleRename();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isRenaming}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleRename} disabled={!title.trim() || isRenaming}>
                        {isRenaming ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
import { useAppStore } from "@/store";

interface RenameCardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cardId: string | null;
    onRenamed?: () => void;
}

export function RenameCardDialog({
    open,
    onOpenChange,
    cardId,
    onRenamed,
}: RenameCardDialogProps) {
    const { getCardById, updateCard } = useAppStore();
    const card = cardId ? getCardById(cardId) : null;
    const [title, setTitle] = useState(card?.title || "");
    const [isRenaming, setIsRenaming] = useState(false);

    useEffect(() => {
        if (open && card) {
            setTitle(card.title || "");
        }
    }, [open, card]);

    const handleRename = async () => {
        if (!cardId || !title.trim() || title.trim() === card?.title) {
            onOpenChange(false);
            return;
        }

        setIsRenaming(true);
        try {
            await updateCard(cardId, { title: title.trim() });
            onRenamed?.();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to rename card:", error);
            alert(`重命名失败: ${error}`);
        } finally {
            setIsRenaming(false);
        }
    };

    if (!card) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-blue-500" />
                        Rename Card
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="rename-title">Title</Label>
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





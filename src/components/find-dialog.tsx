import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown } from "lucide-react";

interface FindDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editor?: any; // TipTap Editor instance
    replaceMode?: boolean;
}

export function FindDialog({ open, onOpenChange, editor, replaceMode = false }: FindDialogProps) {
    const [searchText, setSearchText] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [matchCount, setMatchCount] = useState(0);
    const [currentMatch, setCurrentMatch] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
        }
    }, [open]);

    // 简单的文本查找实现
    const handleFind = () => {
        if (!editor || !searchText.trim()) {
            setMatchCount(0);
            setCurrentMatch(0);
            return;
        }

        // 获取编辑器内容
        const content = editor.getHTML();
        const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = content.match(regex);
        const count = matches ? matches.length : 0;
        setMatchCount(count);
        
        // 这里可以添加高亮显示匹配项的逻辑
        // TipTap 可能需要使用插件来实现查找功能
    };

    useEffect(() => {
        if (searchText) {
            handleFind();
        } else {
            setMatchCount(0);
            setCurrentMatch(0);
        }
    }, [searchText]);

    const handleReplace = () => {
        if (!editor || !searchText.trim()) return;
        
        // 简单的替换实现
        const content = editor.getHTML();
        const newContent = content.replace(
            new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            replaceText
        );
        editor.commands.setContent(newContent);
        handleFind();
    };

    const handleReplaceAll = () => {
        if (!editor || !searchText.trim()) return;
        
        const content = editor.getHTML();
        const newContent = content.replace(
            new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            replaceText
        );
        editor.commands.setContent(newContent);
        setMatchCount(0);
        setCurrentMatch(0);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {replaceMode ? "Find and Replace" : "Find"}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="search">Find</Label>
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-zinc-400" />
                            <Input
                                id="search"
                                ref={searchInputRef}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                        onOpenChange(false);
                                    } else if (e.key === "Enter" && e.shiftKey) {
                                        // Shift+Enter: previous match
                                        if (currentMatch > 0) {
                                            setCurrentMatch(currentMatch - 1);
                                        }
                                    } else if (e.key === "Enter") {
                                        // Enter: next match
                                        if (currentMatch < matchCount - 1) {
                                            setCurrentMatch(currentMatch + 1);
                                        }
                                    }
                                }}
                                placeholder="Search..."
                                autoFocus
                            />
                            {matchCount > 0 && (
                                <div className="text-xs text-zinc-400 whitespace-nowrap">
                                    {currentMatch + 1} / {matchCount}
                                </div>
                            )}
                        </div>
                    </div>
                    {replaceMode && (
                        <div className="grid gap-2">
                            <Label htmlFor="replace">Replace</Label>
                            <Input
                                id="replace"
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.metaKey) {
                                        handleReplaceAll();
                                    } else if (e.key === "Enter") {
                                        handleReplace();
                                    }
                                }}
                                placeholder="Replace with..."
                            />
                        </div>
                    )}
                    {matchCount > 0 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (currentMatch > 0) {
                                        setCurrentMatch(currentMatch - 1);
                                    }
                                }}
                                disabled={currentMatch === 0}
                            >
                                <ChevronUp className="h-4 w-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (currentMatch < matchCount - 1) {
                                        setCurrentMatch(currentMatch + 1);
                                    }
                                }}
                                disabled={currentMatch === matchCount - 1}
                            >
                                <ChevronDown className="h-4 w-4" />
                                Next
                            </Button>
                        </div>
                    )}
                </div>
                {replaceMode && (
                    <div className="flex items-center justify-end gap-2 pb-4">
                        <Button variant="outline" onClick={handleReplace} disabled={!searchText.trim()}>
                            Replace
                        </Button>
                        <Button variant="outline" onClick={handleReplaceAll} disabled={!searchText.trim()}>
                            Replace All
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}





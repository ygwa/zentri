import { useState, useEffect, useMemo } from "react";
import { LayoutGrid, Plus, Trash2, Search, MoreHorizontal, Pencil, ArrowUpDown, Clock, Calendar } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { CanvasListItem } from "@/types/canvas";
import { CreateCanvasDialog } from "@/components/create-canvas-dialog";
import { RenameCanvasDialog } from "@/components/rename-canvas-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface CanvasGridViewProps {
    onOpenCanvas: (id: string) => void;
}

type SortOption = "date-modified" | "date-created" | "title";

export function CanvasGridView({ onOpenCanvas }: CanvasGridViewProps) {
    const [canvases, setCanvases] = useState<CanvasListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("date-modified");

    // Dialogs State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [renameDialogState, setRenameDialogState] = useState<{ open: boolean; id: string; title: string }>({
        open: false,
        id: "",
        title: ""
    });
    const [deleteDialogState, setDeleteDialogState] = useState<{ open: boolean; id: string; title: string }>({
        open: false,
        id: "",
        title: ""
    });

    useEffect(() => {
        loadCanvases();
    }, []);

    const loadCanvases = async () => {
        setIsLoading(true);
        try {
            const data = await invoke<CanvasListItem[]>("get_canvases");
            setCanvases(data);
        } catch (error) {
            console.error("Failed to load canvases:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter and Sort Logic
    const filteredAndSortedCanvases = useMemo(() => {
        let result = [...canvases];

        // Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c => c.title.toLowerCase().includes(query));
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case "date-modified":
                    return (b.updatedAt || 0) - (a.updatedAt || 0); // Descending
                case "date-created":
                    return (b.createdAt || 0) - (a.createdAt || 0); // Descending
                case "title":
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });

        return result;
    }, [canvases, searchQuery, sortBy]);

    const handleCreated = async (canvasId: string) => {
        await loadCanvases();
        onOpenCanvas(canvasId);
    };

    const handleRenameClick = (e: React.MouseEvent, canvas: CanvasListItem) => {
        e.stopPropagation();
        setRenameDialogState({ open: true, id: canvas.id, title: canvas.title });
    };

    const handleDeleteClick = (e: React.MouseEvent, canvas: CanvasListItem) => {
        e.stopPropagation();
        setDeleteDialogState({ open: true, id: canvas.id, title: canvas.title });
    };

    const confirmDelete = async () => {
        try {
            await invoke("delete_canvas", { id: deleteDialogState.id });
            loadCanvases();
            setDeleteDialogState({ ...deleteDialogState, open: false });
        } catch (error) {
            console.error("Failed to delete canvas:", error);
            alert(`删除失败: ${error}`);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#fcfcfc] animate-in fade-in duration-300">
            {/* Toolbar - Removed 'Boards' Title since it is in MainLayout header */}
            <div className="h-10 border-b border-zinc-200 flex items-center px-4 justify-between shrink-0 bg-white shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <Input
                            placeholder="Find a board..."
                            className="pl-8 h-7 text-xs bg-zinc-50 border-zinc-200 focus:bg-white transition-all rounded-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Sort */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-zinc-500 hover:text-zinc-800 rounded-sm">
                                <ArrowUpDown size={12} />
                                <span className="text-[10px] uppercase font-bold tracking-wide">Sort</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setSortBy("date-modified")} className={sortBy === "date-modified" ? "bg-zinc-100" : ""}>
                                <Clock className="mr-2 h-3.5 w-3.5" /> Modified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy("date-created")} className={sortBy === "date-created" ? "bg-zinc-100" : ""}>
                                <Calendar className="mr-2 h-3.5 w-3.5" /> Created
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSortBy("title")} className={sortBy === "title" ? "bg-zinc-100" : ""}>
                                <span className="mr-2 text-xs font-bold">Aa</span> Name
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="w-px h-4 bg-zinc-200 mx-1" />

                    <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                        size="sm"
                        className="h-7 px-2.5 gap-1.5 bg-zinc-900 hover:bg-zinc-800 shadow-sm rounded-sm"
                    >
                        <Plus size={12} /> <span className="text-xs font-medium">New Board</span>
                    </Button>
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                        <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin" />
                        <span className="text-xs font-medium">Loading...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredAndSortedCanvases.map((canvas) => (
                            <div
                                key={canvas.id}
                                onClick={() => onOpenCanvas(canvas.id)}
                                className="group flex flex-col gap-2 cursor-pointer relative"
                            >
                                {/* Preview Card */}
                                <div className="aspect-[16/10] bg-white rounded-lg border border-zinc-200 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-0.5 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />

                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-100 group-hover:text-zinc-200 transition-colors">
                                        <LayoutGrid size={40} strokeWidth={1} />
                                    </div>

                                    {/* Action Menu - More visible on hover */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <button className="h-6 w-6 flex items-center justify-center bg-white hover:bg-zinc-50 rounded-sm border border-zinc-200 shadow-sm text-zinc-400 hover:text-zinc-700 transition-colors">
                                                    <MoreHorizontal size={14} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenCanvas(canvas.id); }}>
                                                    Open
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => handleRenameClick(e, canvas)}>
                                                    <Pencil className="mr-2 h-3.5 w-3.5 text-zinc-500" /> Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={(e) => handleDeleteClick(e, canvas)}
                                                    className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                                >
                                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="px-1 flex flex-col gap-0.5">
                                    <h3 className="font-medium text-zinc-700 text-sm group-hover:text-zinc-900 transition-colors truncate">
                                        {canvas.title}
                                    </h3>
                                    <p className="text-[10px] text-zinc-400">
                                        {format(new Date(canvas.updatedAt), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {filteredAndSortedCanvases.length === 0 && !searchQuery && (
                            <div className="col-span-full flex flex-col items-center justify-center py-32 text-zinc-400 gap-4 border-2 border-dashed border-zinc-100 rounded-xl bg-zinc-50/50">
                                <div className="p-3 bg-white rounded-full shadow-sm border border-zinc-100">
                                    <LayoutGrid size={24} className="text-zinc-300" />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <h3 className="text-zinc-900 font-medium text-sm">No boards yet</h3>
                                    <p className="text-xs text-zinc-500">Create your first whiteboard.</p>
                                </div>
                                <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" size="sm" className="mt-2 h-8 rounded-sm">
                                    Create Board
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Dialogs */}
            <CreateCanvasDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onCreated={handleCreated}
            />

            <RenameCanvasDialog
                open={renameDialogState.open}
                onOpenChange={(open) => setRenameDialogState(prev => ({ ...prev, open }))}
                canvasId={renameDialogState.id}
                currentTitle={renameDialogState.title}
                onRenamed={loadCanvases}
            />

            <AlertDialog open={deleteDialogState.open} onOpenChange={(open) => setDeleteDialogState(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Board?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Permanently delete <span className="font-semibold text-zinc-900">"{deleteDialogState.title}"</span>? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

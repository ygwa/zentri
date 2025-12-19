import { useState, useEffect } from "react";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { CanvasListItem } from "@/types/canvas";
import { CreateCanvasDialog } from "@/components/create-canvas-dialog";

interface CanvasGridViewProps {
    onOpenCanvas: (id: string) => void;
}

export function CanvasGridView({ onOpenCanvas }: CanvasGridViewProps) {
    const [canvases, setCanvases] = useState<CanvasListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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

    const handleCreate = () => {
        setIsCreateDialogOpen(true);
    };

    const handleCreated = async (canvasId: string) => {
        await loadCanvases();
        onOpenCanvas(canvasId);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this canvas?")) return;
        try {
            await invoke("delete_canvas", { id });
            loadCanvases();
        } catch (error) {
            console.error("Failed to delete canvas:", error);
            alert(`删除失败: ${error}`);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in duration-300">
            <div className="h-10 border-b border-zinc-200 flex items-center px-4 justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    <LayoutGrid size={14} className="text-zinc-500" />
                    Whiteboards
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium transition-all"
                    >
                        <Plus size={12} /> <span className="font-medium">New Board</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#f8f9fa] p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-zinc-400">Loading...</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {canvases.map((canvas) => (
                            <div
                                key={canvas.id}
                                onClick={() => onOpenCanvas(canvas.id)}
                                className="group flex flex-col gap-2 cursor-pointer"
                            >
                                <div className="aspect-video bg-white rounded-sm border border-zinc-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all flex items-center justify-center relative overflow-hidden group-hover:-translate-y-1">
                                    <LayoutGrid className="text-zinc-200 group-hover:text-blue-100 transition-colors" size={48} />

                                    <button
                                        onClick={(e) => handleDelete(e, canvas.id)}
                                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <div className="px-1">
                                    <div className="font-bold text-zinc-800 text-sm group-hover:text-blue-600 transition-colors truncate">
                                        {canvas.title}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 font-mono">
                                        Updated {new Date(canvas.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {canvases.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-400 gap-4 border-2 border-dashed border-zinc-200 rounded-lg">
                                <LayoutGrid size={32} />
                                <div className="text-sm">No whiteboards yet. Create one to start visual thinking.</div>
                                <button onClick={handleCreate} className="text-blue-500 hover:underline">Create Board</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <CreateCanvasDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onCreated={handleCreated}
            />
        </div>
    );
}

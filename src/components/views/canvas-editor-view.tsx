import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { X } from "lucide-react";


interface CanvasEditorViewProps {
    canvasId: string;
    onClose: () => void;
}

export function CanvasEditorView({ canvasId, onClose }: CanvasEditorViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-white">
            {/* Header - Minimalist */}
            <div className="h-10 bg-white border-b border-zinc-200 flex items-center justify-between px-4 shrink-0 z-10">
                <div className="flex items-center gap-2">
                    {/* Title is handled inside CanvasEditor or we can hoist it here later */}
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Canvas Editor</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 w-full h-full relative overflow-hidden">
                <CanvasEditor canvasId={canvasId} />
            </div>
        </div>
    );
}

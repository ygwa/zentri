import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { X } from "lucide-react";
import { motion } from "framer-motion";

interface CanvasEditorViewProps {
    canvasId: string;
    onClose: () => void;
}

export function CanvasEditorView({ canvasId, onClose }: CanvasEditorViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-4 z-40 bg-white rounded-lg shadow-2xl border border-zinc-200 overflow-hidden flex flex-col"
        >
            <div className="h-10 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Canvas</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-200 rounded text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="flex-1 w-full h-full relative">
                <CanvasEditor canvasId={canvasId} />
            </div>
        </motion.div>
    );
}

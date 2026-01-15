/**
 * Import Dropzone Component - 文件拖放导入区域
 */
import { UploadCloud } from "lucide-react";

interface ImportDropzoneProps {
    isDragging: boolean;
    showDropZone: boolean;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onQuickImport: () => void;
    onToggleDropZone: () => void;
}

export function ImportDropzone({
    isDragging,
    showDropZone,
    onDrop,
    onDragOver,
    onDragLeave,
    onQuickImport,
    onToggleDropZone,
}: ImportDropzoneProps) {
    if (showDropZone) {
        return (
            <div
                onClick={onQuickImport}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`mb-6 border-2 border-dashed rounded-sm p-4 flex flex-col items-center justify-center transition-colors cursor-pointer group ${isDragging
                        ? 'border-blue-400 bg-blue-50/20'
                        : 'border-zinc-200 hover:border-blue-400 hover:bg-blue-50/10 text-zinc-400'
                    }`}
            >
                <UploadCloud size={24} className={`mb-2 transition-colors ${isDragging ? 'text-blue-500' : 'group-hover:text-blue-500'}`} />
                <span className="text-xs font-medium">
                    {isDragging ? 'Drop files here to import' : 'Click or Drag & Drop PDF/EPUB files here'}
                </span>
                <span className="text-[10px] text-zinc-400 mt-1">
                    Or click "Add" button to add webpages, videos, etc.
                </span>
            </div>
        );
    }

    return (
        <button
            onClick={onToggleDropZone}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className="mb-6 w-full border-2 border-dashed border-zinc-200 rounded-sm p-3 flex items-center justify-center gap-2 text-xs text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
            <UploadCloud size={16} />
            <span>Click to show import area or drag files here</span>
        </button>
    );
}

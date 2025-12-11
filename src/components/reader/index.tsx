export { EpubReader } from "./epub-reader";
export { PdfReader } from "./pdf-reader";

import { EpubReader } from "./epub-reader";
import { PdfReader } from "./pdf-reader";
import { BookOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types";

interface UnifiedReaderProps {
  url: string;
  fileType: "epub" | "pdf";
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, position: string | number) => void;
  onAddToNote?: (text: string, position: string | number) => void;
  onProgress?: (progress: number) => void;
  className?: string;
}

// 统一的阅读器组件
export function UnifiedReader({
  url,
  fileType,
  sourceId,
  sourceTitle,
  highlights,
  onHighlight,
  onAddToNote,
  onProgress,
  className,
}: UnifiedReaderProps) {
  if (!url) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground", className)}>
        <BookOpen className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">请选择一个文件开始阅读</p>
      </div>
    );
  }

  if (fileType === "epub") {
    return (
      <EpubReader
        url={url}
        sourceId={sourceId}
        sourceTitle={sourceTitle}
        highlights={highlights}
        onHighlight={(text, cfi) => onHighlight?.(text, cfi)}
        onAddToNote={(text, cfi) => onAddToNote?.(text, cfi)}
        onProgress={onProgress}
        className={className}
      />
    );
  }

  if (fileType === "pdf") {
    return (
      <PdfReader
        url={url}
        sourceId={sourceId}
        sourceTitle={sourceTitle}
        onHighlight={(text, page) => onHighlight?.(text, page)}
        onAddToNote={(text, page) => onAddToNote?.(text, page)}
        onProgress={onProgress}
        className={className}
      />
    );
  }

  // 不支持的格式
  return (
    <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground", className)}>
      <FileText className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm">不支持的文件格式</p>
      <p className="text-xs mt-1">目前支持 EPUB 和 PDF 格式</p>
    </div>
  );
}

// 文件类型检测
export function detectFileType(url: string): "epub" | "pdf" | null {
  const lower = url.toLowerCase();
  if (lower.endsWith(".epub")) return "epub";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

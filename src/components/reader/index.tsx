// 导出所有阅读器组件
export { EpubReader } from "./epub-reader";
export { PdfReader } from "./pdf-reader";
export { WebReader } from "./web-reader";

import { EpubReader } from "./epub-reader";
import { PdfReader } from "./pdf-reader";
import { BookOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/types";

// 支持的文件类型（仅 EPUB 和 PDF）
export type SupportedBookFormat = "epub" | "pdf";

interface UnifiedReaderProps {
  url: string;
  fileType?: SupportedBookFormat | null; // 可选，如果未提供则自动检测
  sourceId?: string;
  sourceTitle?: string;
  highlights?: Highlight[];
  onHighlight?: (text: string, position: string | number, type?: "highlight" | "underline" | "strikethrough", rects?: Array<{ x: number; y: number; width: number; height: number }>) => void;
  onAddToNote?: (text: string, position: string | number) => void;
  onBookmarkAdd?: (position: string | number) => void;
  onProgress?: (progress: number) => void;
  onProgressCfi?: (progress: number, cfi: string) => void; // 进度和 CFI 一起保存
  onPageChange?: (page: number, totalPages: number) => void;
  currentPage?: number; // 当前进度（0-100 百分比）
  currentCfi?: string; // 当前 CFI 位置
  onHighlightUpdate?: (id: string, updates: { note?: string; color?: string }) => void;
  onHighlightDelete?: (id: string) => void;
  className?: string;
}

// 统一的阅读器组件 - 路由到 EPUB 或 PDF 阅读器
export function UnifiedReader({
  url,
  fileType,
  sourceId,
  sourceTitle,
  highlights,
  onHighlight,
  onAddToNote,
  onProgress,
  onProgressCfi,
  onPageChange,
  currentPage,
  currentCfi,
  onHighlightUpdate,
  onHighlightDelete,
  onBookmarkAdd,
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

  // 自动检测文件类型（如果未提供）
  const detectedType = fileType || detectFileType(url);

  // EPUB 阅读器
  if (detectedType === "epub") {
    return (
      <EpubReader
        url={url}
        sourceId={sourceId}
        sourceTitle={sourceTitle}
        highlights={highlights}
        onHighlight={(text, position, type) => onHighlight?.(text, position, type)}
        onAddToNote={(text, position) => onAddToNote?.(text, position)}
        onProgress={onProgress}
        onProgressCfi={onProgressCfi}
        onPageChange={onPageChange}
        initialProgress={currentPage}
        initialCfi={currentCfi}
        onHighlightUpdate={onHighlightUpdate}
        onHighlightDelete={onHighlightDelete}
        onBookmarkAdd={(position) => onBookmarkAdd?.(position)}
        className={className}
      />
    );
  }

  // PDF 阅读器
  if (detectedType === "pdf") {
    return (
      <PdfReader
        url={url}
        sourceId={sourceId}
        sourceTitle={sourceTitle}
        highlights={highlights}
        onHighlight={(text, position, type, rects) => onHighlight?.(text, position, type, rects)}
        onAddToNote={(text, position) => onAddToNote?.(text, position)}
        onProgress={onProgress}
        onPageChange={onPageChange}
        currentPage={currentPage}
        onHighlightUpdate={onHighlightUpdate}
        onHighlightDelete={onHighlightDelete}
        onBookmarkAdd={(position) => onBookmarkAdd?.(position)}
        className={className}
      />
    );
  }

  // 不支持的格式
  return (
    <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground", className)}>
      <FileText className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm">不支持的文件格式</p>
      <p className="text-xs mt-1">
        支持的格式：EPUB, PDF
      </p>
    </div>
  );
}

// 文件类型检测 - 仅支持 EPUB 和 PDF
export function detectFileType(url: string): SupportedBookFormat | null {
  const lower = url.toLowerCase();
  
  if (lower.endsWith(".epub")) return "epub";
  if (lower.endsWith(".pdf")) return "pdf";
  
  return null;
}

// 检查是否为支持的文件格式
export function isSupportedFormat(format: string): format is SupportedBookFormat {
  const supportedFormats: SupportedBookFormat[] = ["epub", "pdf"];
  return supportedFormats.includes(format as SupportedBookFormat);
}

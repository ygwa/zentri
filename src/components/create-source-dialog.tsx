/**
 * 添加文献对话框
 * 用于创建新的文献源（书籍、文章、网页等）
 * 支持从 EPUB/PDF 自动解析元数据
 */

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  Globe,
  Video,
  Headphones,
  GraduationCap,
  FolderOpen,
  File,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/store";
import { pickReadableFile } from "@/lib/file-picker";
import { parseBookMetadata, generatePlaceholderCover } from "@/lib/book-metadata";
import type { SourceType } from "@/types";

const sourceTypes: {
  id: SourceType;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    id: "book",
    label: "书籍",
    desc: "电子书、纸质书",
    icon: BookOpen,
    color: "border-amber-500 bg-amber-500/10 text-amber-600",
  },
  {
    id: "article",
    label: "文章",
    desc: "博客、公众号文章",
    icon: FileText,
    color: "border-blue-500 bg-blue-500/10 text-blue-600",
  },
  {
    id: "webpage",
    label: "网页",
    desc: "网站页面、在线文档",
    icon: Globe,
    color: "border-green-500 bg-green-500/10 text-green-600",
  },
  {
    id: "video",
    label: "视频",
    desc: "YouTube、B站等",
    icon: Video,
    color: "border-red-500 bg-red-500/10 text-red-600",
  },
  {
    id: "podcast",
    label: "播客",
    desc: "音频节目",
    icon: Headphones,
    color: "border-purple-500 bg-purple-500/10 text-purple-600",
  },
  {
    id: "paper",
    label: "论文",
    desc: "学术论文、期刊",
    icon: GraduationCap,
    color: "border-indigo-500 bg-indigo-500/10 text-indigo-600",
  },
];

interface CreateSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (sourceId: string) => void;
}

export function CreateSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSourceDialogProps) {
  const { createSource } = useAppStore();
  const [type, setType] = useState<SourceType>("book");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [cover, setCover] = useState<string | null>(null);  // 封面图片 data URL
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);  // 元数据解析中
  const [parseError, setParseError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    try {
      const source = await createSource({
        type,
        title: title.trim(),
        author: author.trim() || undefined,
        url: url.trim() || undefined,
        cover: cover || generatePlaceholderCover(title.trim(), type === 'paper' ? 'paper' : 'book'),
        tags: [],
        progress: 0,
      });
      
      onOpenChange(false);
      onCreated?.(source.id);
      
      // 重置表单
      setTitle("");
      setAuthor("");
      setUrl("");
      setCover(null);
      setType("book");
      setParseError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 解析文件元数据
  const handleParseMetadata = async (filePath: string) => {
    setIsParsing(true);
    setParseError(null);
    
    try {
      const metadata = await parseBookMetadata(filePath);
      
      // 自动填充表单
      if (metadata.title && !title.trim()) {
        setTitle(metadata.title);
      }
      if (metadata.author && !author.trim()) {
        setAuthor(metadata.author);
      }
      if (metadata.coverUrl) {
        setCover(metadata.coverUrl);
      }
      
    } catch (error) {
      console.error("Failed to parse metadata:", error);
      setParseError("无法解析文件元数据，请手动填写");
    } finally {
      setIsParsing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  // 根据类型显示不同的 URL 提示
  const getUrlPlaceholder = () => {
    switch (type) {
      case "book":
        return "EPUB/PDF 文件路径（可选）";
      case "article":
      case "webpage":
        return "文章链接（可选）";
      case "video":
        return "视频链接（可选）";
      case "podcast":
        return "播客链接（可选）";
      case "paper":
        return "论文链接或 DOI（可选）";
      default:
        return "链接（可选）";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加文献</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 文献类型选择 */}
          <div className="grid grid-cols-3 gap-2">
            {sourceTypes.map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.id}
                  onClick={() => setType(st.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-colors",
                    type === st.id
                      ? st.color
                      : "border-transparent hover:bg-accent"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">{st.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {st.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 标题输入 */}
          <div className="space-y-2">
            <Label htmlFor="source-title">
              标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入文献标题..."
              autoFocus
            />
          </div>

          {/* 作者输入 */}
          <div className="space-y-2">
            <Label htmlFor="source-author">作者</Label>
            <Input
              id="source-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="作者名称（可选）"
            />
          </div>

          {/* URL / 文件路径输入 */}
          <div className="space-y-2">
            <Label htmlFor="source-url">
              {type === "book" || type === "paper" ? "文件路径 / 链接" : "链接 / 文件路径"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="source-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getUrlPlaceholder()}
                className="flex-1"
              />
              {/* 文件选择按钮 - 仅对书籍和论文类型显示 */}
              {(type === "book" || type === "paper") && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={isParsing}
                  onClick={async () => {
                    const result = await pickReadableFile();
                    if (result) {
                      setUrl(result.path);
                      // 自动解析 EPUB 元数据
                      if (result.path.toLowerCase().endsWith('.epub')) {
                        await handleParseMetadata(result.path);
                      } else {
                        // PDF 或其他格式：使用文件名作为标题
                        if (!title.trim()) {
                          const nameWithoutExt = result.name.replace(/\.(epub|pdf)$/i, "");
                          setTitle(nameWithoutExt);
                        }
                      }
                    }
                  }}
                >
                  {isParsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {url && (type === "book" || type === "paper") && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                <File className="h-3 w-3 shrink-0" />
                <span className="truncate">{url.split(/[/\\]/).pop()}</span>
                {isParsing && (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    解析中...
                  </span>
                )}
              </div>
            )}
            {parseError && (
              <p className="text-[10px] text-amber-600">{parseError}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {type === "book" || type === "paper"
                ? "支持 EPUB、PDF 格式，EPUB 可自动识别书名和作者"
                : "添加链接后可快速访问原文"}
            </p>
          </div>

          {/* 封面预览 - 仅当有封面时显示 */}
          {cover && (
            <div className="space-y-2">
              <Label>封面预览</Label>
              <div className="flex items-start gap-3">
                <img 
                  src={cover} 
                  alt="封面预览" 
                  className="w-16 h-auto rounded shadow-sm border"
                />
                <div className="flex-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-500" />
                    已从文件自动提取封面
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 mt-1"
                    onClick={() => setCover(null)}
                  >
                    移除封面
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? "添加中..." : "添加文献"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


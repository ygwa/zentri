/**
 * 添加文献对话框
 * 支持自动提取元数据：
 * - 网页：输入 URL 自动抓取标题、作者
 * - EPUB：自动解析书名、作者、封面
 * - PDF：自动提取标题（从文件名）
 */

import { useState, useEffect, useCallback } from "react";
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
  Link,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAppStore } from "@/store";
import { pickReadableFile } from "@/lib/file-picker";
import { parseBookMetadata, generatePlaceholderCover } from "@/lib/book-metadata";
import * as api from "@/services/api";
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
    desc: "EPUB/PDF 电子书",
    icon: BookOpen,
    color: "border-amber-500 bg-amber-500/10 text-amber-600",
  },
  {
    id: "webpage",
    label: "网页",
    desc: "在线文章、博客",
    icon: Globe,
    color: "border-green-500 bg-green-500/10 text-green-600",
  },
  {
    id: "article",
    label: "文章",
    desc: "公众号、Newsletter",
    icon: FileText,
    color: "border-blue-500 bg-blue-500/10 text-blue-600",
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
    desc: "学术论文、PDF",
    icon: GraduationCap,
    color: "border-indigo-500 bg-indigo-500/10 text-indigo-600",
  },
];

interface CreateSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (sourceId: string) => void;
}

type FetchStatus = "idle" | "loading" | "success" | "error";

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
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 重置表单
  const resetForm = useCallback(() => {
    setTitle("");
    setAuthor("");
    setUrl("");
    setDescription("");
    setCover(null);
    setFetchStatus("idle");
    setFetchError(null);
  }, []);

  // 类型切换时重置表单
  useEffect(() => {
    resetForm();
  }, [type, resetForm]);

  // URL 改变时自动获取网页元数据（防抖）
  useEffect(() => {
    if (!url || type !== "webpage" && type !== "article") return;
    
    // 简单的 URL 验证
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;
    
    const timer = setTimeout(async () => {
      setFetchStatus("loading");
      setFetchError(null);
      
      try {
        if (api.isTauriEnv()) {
          const metadata = await api.webReader.fetchWebpageMetadata(url);
          setTitle(metadata.title);
          if (metadata.author) setAuthor(metadata.author);
          if (metadata.description) setDescription(metadata.description);
          setFetchStatus("success");
        } else {
          // 浏览器环境：简化处理
          setFetchStatus("idle");
        }
      } catch (err) {
        console.error("Failed to fetch webpage metadata:", err);
        setFetchError("无法获取网页信息，请手动输入");
        setFetchStatus("error");
      }
    }, 800); // 800ms 防抖

    return () => clearTimeout(timer);
  }, [url, type]);

  // 处理文件选择
  const handleFileSelect = async () => {
    const result = await pickReadableFile();
    if (!result) return;

    setUrl(result.path);
    setFetchStatus("loading");
    setFetchError(null);

    try {
      // 解析元数据
      const metadata = await parseBookMetadata(result.path);
      
      if (metadata.title) {
        setTitle(metadata.title);
      } else {
        // 使用文件名作为标题
        const nameWithoutExt = result.name.replace(/\.(epub|pdf)$/i, "");
        setTitle(nameWithoutExt);
      }
      
      if (metadata.author) setAuthor(metadata.author);
      if (metadata.coverUrl) setCover(metadata.coverUrl);
      if (metadata.description) setDescription(metadata.description);
      
      setFetchStatus("success");
    } catch (err) {
      console.error("Failed to parse file metadata:", err);
      // 使用文件名作为标题
      const nameWithoutExt = result.name.replace(/\.(epub|pdf)$/i, "");
      setTitle(nameWithoutExt);
      setFetchError("无法解析文件元数据，已使用文件名作为标题");
      setFetchStatus("error");
    }
  };

  // 创建文献源
  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const source = await createSource({
        type,
        title: title.trim(),
        author: author.trim() || undefined,
        url: url.trim() || undefined,
        description: description.trim() || undefined,
        cover: cover || generatePlaceholderCover(title.trim(), type === "paper" ? "paper" : "book"),
        tags: [],
        progress: 0,
      });

      onOpenChange(false);
      onCreated?.(source.id);
      resetForm();
      setType("book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  // 是否为电子书类型
  const isBookType = type === "book" || type === "paper";
  // 是否为网页类型
  const isWebType = type === "webpage" || type === "article";

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

          {/* 电子书：文件选择 */}
          {isBookType && (
            <div className="space-y-2">
              <Label>选择文件</Label>
              <div
                onClick={handleFileSelect}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  url
                    ? "border-green-300 bg-green-50/50"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                )}
              >
                {url ? (
                  <div className="flex items-center justify-center gap-2">
                    <File className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700 truncate max-w-[200px]">
                      {url.split(/[/\\]/).pop()}
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-8 w-8" />
                    <div>
                      <p className="text-sm font-medium">点击选择 EPUB 或 PDF 文件</p>
                      <p className="text-xs">支持自动提取书名、作者、封面</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 网页/文章：URL 输入 */}
          {isWebType && (
            <div className="space-y-2">
              <Label htmlFor="source-url">
                <span className="flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  网页链接
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="source-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="pr-10"
                />
                {fetchStatus === "loading" && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {fetchStatus === "success" && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {fetchStatus === "error" && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                输入链接后将自动获取标题和摘要
              </p>
            </div>
          )}

          {/* 其他类型：链接输入（可选） */}
          {!isBookType && !isWebType && (
            <div className="space-y-2">
              <Label htmlFor="source-url">链接（可选）</Label>
              <Input
                id="source-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="输入视频/播客链接..."
              />
            </div>
          )}

          {/* 状态提示 */}
          {fetchStatus === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在解析...</span>
            </div>
          )}
          {fetchStatus === "success" && title && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
              <Sparkles className="h-4 w-4" />
              <span>已自动填充信息</span>
            </div>
          )}
          {fetchError && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4" />
              <span>{fetchError}</span>
            </div>
          )}

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
              placeholder={
                isBookType
                  ? "选择文件后自动填充"
                  : isWebType
                  ? "输入链接后自动填充"
                  : "输入标题..."
              }
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

          {/* 封面预览 */}
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
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                添加中...
              </>
            ) : (
              "添加文献"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

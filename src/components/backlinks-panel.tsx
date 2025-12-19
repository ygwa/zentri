/**
 * Backlinks Panel - 反向链接面板
 * 显示指定卡片的所有反向链接
 */
import { Link2, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { useBacklinks } from "@/hooks/use-backlinks";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// 卡片类型颜色
const typeColors: Record<string, string> = {
  fleeting: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  literature: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
  permanent: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  project: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
};

interface BacklinksPanelProps {
  /** 当前卡片 ID */
  cardId: string | null | undefined;
  /** 点击反向链接时的回调 */
  onLinkClick?: (id: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否显示标题 */
  showTitle?: boolean;
}

export function BacklinksPanel({
  cardId,
  onLinkClick,
  className,
  showTitle = true,
}: BacklinksPanelProps) {
  const { backlinks, isLoading, error, refresh } = useBacklinks(cardId);

  if (!cardId) {
    return null;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 标题栏 */}
      {showTitle && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              反向链接
            </span>
            {backlinks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {backlinks.length}
              </span>
            )}
          </div>
          <button
            onClick={refresh}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="刷新"
          >
            <RefreshCw
              className={cn(
                "w-3 h-3 text-muted-foreground",
                isLoading && "animate-spin"
              )}
            />
          </button>
        </div>
      )}

      {/* 内容区 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* 加载状态 */}
          {isLoading && backlinks.length === 0 && (
            <div className="py-4 text-center">
              <RefreshCw className="w-4 h-4 mx-auto text-muted-foreground animate-spin" />
              <p className="mt-2 text-xs text-muted-foreground">加载中...</p>
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="py-4 text-center">
              <AlertCircle className="w-4 h-4 mx-auto text-destructive" />
              <p className="mt-2 text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && !error && backlinks.length === 0 && (
            <div className="py-6 text-center">
              <Link2 className="w-5 h-5 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">
                暂无反向链接
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                其他卡片链接到这里时会显示
              </p>
            </div>
          )}

          {/* 反向链接列表 */}
          {backlinks.map((link) => (
            <button
              key={link.id}
              onClick={() => onLinkClick?.(link.id)}
              className={cn(
                "w-full text-left p-2 rounded-md",
                "hover:bg-muted/50 transition-colors",
                "group flex items-start gap-2"
              )}
            >
              <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {link.title}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] px-1 py-0.5 rounded uppercase font-medium shrink-0",
                      typeColors[link.cardType] || typeColors.permanent
                    )}
                  >
                    {link.cardType}
                  </span>
                </div>
                {link.context && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {link.context}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * BacklinksInline - 内联反向链接显示
 * 用于在笔记底部显示反向链接
 */
interface BacklinksInlineProps {
  cardId: string | null | undefined;
  onLinkClick?: (id: string) => void;
}

export function BacklinksInline({ cardId, onLinkClick }: BacklinksInlineProps) {
  const { backlinks, isLoading } = useBacklinks(cardId);

  if (!cardId || (backlinks.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <div className="mt-8 pt-4 border-t border-border/50">
      <h4 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-3 flex items-center gap-1.5">
        <Link2 className="w-3 h-3" />
        反向链接
        {backlinks.length > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted">
            {backlinks.length}
          </span>
        )}
      </h4>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">加载中...</div>
      ) : (
        <div className="space-y-1.5 font-mono text-xs">
          {backlinks.map((link, index) => (
            <div key={link.id} className="flex items-center gap-2 text-muted-foreground">
              <span className="text-muted-foreground/50">[{index + 1}]</span>
              <button
                onClick={() => onLinkClick?.(link.id)}
                className="text-primary hover:underline cursor-pointer text-left truncate"
              >
                [[{link.title}]]
              </button>
              <span
                className={cn(
                  "text-[8px] px-1 py-0.5 rounded uppercase",
                  typeColors[link.cardType] || typeColors.permanent
                )}
              >
                {link.cardType}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen,
  StickyNote,
  FolderKanban,
  Link2,
  MoreHorizontal,
  Trash2,
  Edit,
  ArrowLeft,
  PanelRightOpen,
  X,
  Library,
  Globe,
  FileText,
  Video,
  Headphones,
  GraduationCap,
  ExternalLink,
  Clock,
  Highlighter,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Card as CardData, CardType, Source, SourceType } from "@/types";
import { EpubReader } from "@/components/reader/epub-reader";
import { PdfReader } from "@/components/reader/pdf-reader";

// 卡片类型配置 - 建议2: 添加顶部色条样式
const typeConfig: Record<
  CardType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    stripeClass: string; // 顶部色条类名
    accentColor: string; // 强调色（用于点阵图等）
  }
> = {
  fleeting: {
    label: "闪念",
    icon: Sparkles,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    stripeClass: "box-stripe-amber",
    accentColor: "#f59e0b",
  },
  literature: {
    label: "文献",
    icon: BookOpen,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    stripeClass: "box-stripe-sky",
    accentColor: "#0ea5e9",
  },
  permanent: {
    label: "永久",
    icon: StickyNote,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    stripeClass: "box-stripe-emerald",
    accentColor: "#10b981",
  },
  project: {
    label: "项目",
    icon: FolderKanban,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    stripeClass: "box-stripe-violet",
    accentColor: "#8b5cf6",
  },
};

const cardTypes: CardType[] = ["fleeting", "literature", "permanent", "project"];

// EPUB 阅读器嵌入组件
function EpubReaderEmbed({ source }: { source: Source }) {
  const { createHighlight, createCard, getHighlightsBySource, updateSource } = useAppStore();

  const highlights = getHighlightsBySource(source.id);

  // 处理高亮
  const handleHighlight = (text: string, cfi: string) => {
    createHighlight({
      sourceId: source.id,
      content: text,
      position: { startOffset: cfi as unknown as number },
      color: "yellow",
    });
  };

  // 处理添加到笔记
  const handleAddToNote = (text: string, cfi: string) => {
    // 先创建高亮
    createHighlight({
      sourceId: source.id,
      content: text,
      position: { startOffset: cfi as unknown as number },
      color: "yellow",
    });

    // 创建文献笔记
    const card = createCard("literature", `摘录自《${source.title}》`, source.id);
    useAppStore.getState().updateCard(card.id, {
      content: `> ${text}\n\n`,
    });
  };

  // 处理进度更新
  const handleProgress = (progress: number) => {
    updateSource(source.id, { progress, lastReadAt: Date.now() });
  };

  // 如果没有文件 URL，显示占位提示
  if (!source.url) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center p-8">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-2">请添加 EPUB 文件</p>
          <p className="text-xs text-muted-foreground">
            上传文件后即可开始阅读
          </p>
        </div>
      </div>
    );
  }

  return (
    <EpubReader
      url={source.url}
      highlights={highlights}
      onHighlight={handleHighlight}
      onAddToNote={handleAddToNote}
      onProgress={handleProgress}
      className="h-full"
    />
  );
}

// PDF 阅读器嵌入组件
function PdfReaderEmbed({ source }: { source: Source }) {
  const { createHighlight, createCard, updateSource } = useAppStore();

  // 处理高亮
  const handleHighlight = (text: string, page: number) => {
    createHighlight({
      sourceId: source.id,
      content: text,
      position: { page },
      color: "yellow",
    });

    // 同时创建文献笔记
    const card = createCard("literature", `摘录自《${source.title}》第${page}页`, source.id);
    useAppStore.getState().updateCard(card.id, {
      content: `> ${text}\n\n📖 第 ${page} 页\n\n`,
    });
  };

  // 处理进度更新
  const handleProgress = (progress: number) => {
    updateSource(source.id, { progress, lastReadAt: Date.now() });
  };

  // 如果没有文件 URL，显示占位提示
  if (!source.url) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center p-8">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-2">请添加 PDF 文件</p>
          <p className="text-xs text-muted-foreground">
            上传文件后即可开始阅读
          </p>
        </div>
      </div>
    );
  }

  return (
    <PdfReader
      url={source.url}
      onHighlight={handleHighlight}
      onProgress={handleProgress}
      className="h-full"
    />
  );
}

// 文献源类型配置
const sourceTypeConfig: Record<
  SourceType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
  }
> = {
  book: { label: "书籍", icon: BookOpen, color: "text-amber-600" },
  article: { label: "文章", icon: FileText, color: "text-blue-600" },
  webpage: { label: "网页", icon: Globe, color: "text-green-600" },
  video: { label: "视频", icon: Video, color: "text-red-600" },
  podcast: { label: "播客", icon: Headphones, color: "text-purple-600" },
  paper: { label: "论文", icon: GraduationCap, color: "text-indigo-600" },
};

function formatTime(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

// ==================== 盒子页面组件 ====================

// 计算盒子之间的链接统计
function useBoxStats() {
  const { cards } = useAppStore();
  
  const stats: Record<CardType, {
    count: number;
    totalLinks: number;
    inLinks: number;  // 从其他盒子指向这个盒子
    outLinks: number; // 从这个盒子指向其他盒子
    recentActivity: number; // 24小时内更新数
    recentCards: CardData[];
  }> = {
    fleeting: { count: 0, totalLinks: 0, inLinks: 0, outLinks: 0, recentActivity: 0, recentCards: [] },
    literature: { count: 0, totalLinks: 0, inLinks: 0, outLinks: 0, recentActivity: 0, recentCards: [] },
    permanent: { count: 0, totalLinks: 0, inLinks: 0, outLinks: 0, recentActivity: 0, recentCards: [] },
    project: { count: 0, totalLinks: 0, inLinks: 0, outLinks: 0, recentActivity: 0, recentCards: [] },
  };

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  // 统计每个盒子的基础数据
  cards.forEach((card) => {
    stats[card.type].count++;
    stats[card.type].totalLinks += card.links.length;
    if (card.updatedAt > dayAgo) {
      stats[card.type].recentActivity++;
    }
  });

  // 统计跨盒子链接
  cards.forEach((card) => {
    card.links.forEach((linkId) => {
      const linkedCard = cards.find((c) => c.id === linkId);
      if (linkedCard && linkedCard.type !== card.type) {
        stats[card.type].outLinks++;
        stats[linkedCard.type].inLinks++;
      }
    });
  });

  // 获取最近卡片
  cardTypes.forEach((type) => {
    stats[type].recentCards = cards
      .filter((c) => c.type === type)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);
  });

  return stats;
}

// 建议2: 链接丰富度点阵图组件 - 更精致的视觉反馈
function LinkDots({ count, maxDots = 12, color }: { count: number; maxDots?: number; color: string }) {
  const activeDots = Math.min(count, maxDots);
  return (
    <div className="flex gap-[3px] flex-wrap justify-center items-center" style={{ maxWidth: 52 }}>
      {Array.from({ length: maxDots }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full transition-all duration-300"
          style={{
            backgroundColor: color,
            opacity: i < activeDots ? 1 : 0.12,
            transform: i < activeDots ? 'scale(1)' : 'scale(0.7)',
            boxShadow: i < activeDots ? `0 0 4px ${color}40` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// 盒子卡片 - 建议2: 添加顶部色条 + 点阵图可视化
function BoxCard({
  type,
  stats,
  onClick,
}: {
  type: CardType;
  stats: {
    count: number;
    totalLinks: number;
    inLinks: number;
    outLinks: number;
    recentActivity: number;
    recentCards: CardData[];
  };
  onClick: () => void;
}) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all duration-300 group relative overflow-hidden",
        "box-stripe", // 启用顶部色条基础样式
        config.stripeClass, // 对应颜色的色条
        "border hover:border-border/80",
        // 建议1: 增强卡片悬停效果
        "hover:-translate-y-1.5 hover:shadow-lg"
      )}
    >
      {/* 建议2: 顶部 4px 色条已通过 CSS 实现 */}
      
      {/* 背景流动动画 - 更微妙 */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-60 transition-opacity duration-500",
        config.bgColor
      )}>
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 12px,
            ${config.accentColor}06 12px,
            ${config.accentColor}06 24px
          )`,
          animation: 'flow 25s linear infinite',
        }} />
      </div>

      {/* 头部 */}
      <CardHeader className={cn("p-4 pb-3 pt-5 relative", config.bgColor, "bg-opacity-50")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center",
              "bg-white shadow-sm backdrop-blur-sm",
              "ring-1 ring-black/[0.03]"
            )}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <h3 className={cn("font-semibold text-base", config.color)}>{config.label}盒</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-tabular-lg text-sm">{stats.count}</span> 张卡片
              </p>
            </div>
          </div>
          {stats.recentActivity > 0 && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-[10px] font-tabular px-2 py-0.5",
                "bg-white/80 backdrop-blur-sm shadow-sm"
              )}
            >
              <span className="relative flex h-1.5 w-1.5 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" 
                  style={{ backgroundColor: config.accentColor }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" 
                  style={{ backgroundColor: config.accentColor }} />
              </span>
              {stats.recentActivity} 活跃
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 relative">
        {/* 建议2: 改进链接可视化 - 数字 + 点阵图 */}
        <div className="flex items-center gap-2 mb-3 py-3 border-y border-border/50 bg-muted/30 -mx-4 px-4 rounded-sm">
          <div className="flex-1 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xl font-bold font-tabular-lg" style={{ color: config.accentColor }}>
                {stats.inLinks}
              </span>
              <LinkDots count={stats.inLinks} color={config.accentColor} />
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-2">
              <ArrowLeft className="h-2.5 w-2.5" />
              入链
            </div>
          </div>
          <div className="w-px h-14 bg-border/40" />
          <div className="flex-1 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xl font-bold font-tabular-lg" style={{ color: config.accentColor }}>
                {stats.totalLinks}
              </span>
              <LinkDots count={stats.totalLinks} color={config.accentColor} />
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-2">
              <Link2 className="h-2.5 w-2.5" />
              总链
            </div>
          </div>
          <div className="w-px h-14 bg-border/40" />
          <div className="flex-1 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xl font-bold font-tabular-lg" style={{ color: config.accentColor }}>
                {stats.outLinks}
              </span>
              <LinkDots count={stats.outLinks} color={config.accentColor} />
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-2">
              出链
              <ArrowLeft className="h-2.5 w-2.5 rotate-180" />
            </div>
          </div>
        </div>

        {/* 最近卡片 */}
        {stats.recentCards.length > 0 ? (
          <div className="space-y-1.5">
            {stats.recentCards.slice(0, 3).map((card, i) => (
              <div
                key={card.id}
                className={cn(
                  "flex items-center gap-2 text-xs p-2 rounded-lg",
                  "bg-white/60 hover:bg-white/90 transition-colors",
                  "border border-transparent hover:border-border/30"
                )}
              >
                <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-tabular">
                  {i + 1}
                </span>
                <span className="truncate flex-1 font-medium">{card.title || "无标题"}</span>
                {card.links.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-tabular">
                    <Link2 className="h-2.5 w-2.5" />
                    {card.links.length}
                  </span>
                )}
              </div>
            ))}
            {stats.count > 3 && (
              <div className="text-[10px] text-muted-foreground text-center pt-2 font-tabular">
                还有 <span className="font-medium">{stats.count - 3}</span> 张卡片...
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-xs text-muted-foreground mb-3">暂无卡片</div>
            <Button variant="outline" size="sm" className="h-8 text-xs shadow-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              创建第一张
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 建议2: 知识流动图 - 桑基图风格（更精致的可视化）
function KnowledgeFlow({ stats }: { stats: ReturnType<typeof useBoxStats> }) {
  // 计算总的跨盒子链接
  const totalCrossLinks = Object.values(stats).reduce((sum, s) => sum + s.outLinks, 0);
  
  // 找出最活跃的流动方向
  const flows: { from: CardType; to: CardType; count: number }[] = [];
  const { cards } = useAppStore();
  
  cards.forEach((card) => {
    card.links.forEach((linkId) => {
      const linkedCard = cards.find((c) => c.id === linkId);
      if (linkedCard && linkedCard.type !== card.type) {
        const existing = flows.find((f) => f.from === card.type && f.to === linkedCard.type);
        if (existing) {
          existing.count++;
        } else {
          flows.push({ from: card.type, to: linkedCard.type, count: 1 });
        }
      }
    });
  });

  const topFlows = flows.sort((a, b) => b.count - a.count).slice(0, 4);
  const maxFlow = Math.max(...topFlows.map(f => f.count), 1);

  if (totalCrossLinks === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-5 mb-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        知识流动
        <Badge variant="outline" className="ml-2 text-[10px] font-tabular px-2">
          实时
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground font-tabular">
          <span className="font-semibold">{totalCrossLinks}</span> 条跨盒子链接
        </span>
      </h3>
      
      {/* 桑基图风格的流动可视化 - 更精致 */}
      <div className="space-y-4">
        {topFlows.map((flow, i) => {
          const fromConfig = typeConfig[flow.from];
          const toConfig = typeConfig[flow.to];
          const FromIcon = fromConfig.icon;
          const ToIcon = toConfig.icon;
          const flowWidth = Math.max((flow.count / maxFlow) * 100, 25);
          const flowHeight = Math.max(4, Math.min(12, 4 + (flow.count / maxFlow) * 8));
          
          return (
            <div key={i} className="flex items-center gap-3 group">
              {/* 来源盒子 */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                "shadow-sm ring-1 ring-black/[0.03] transition-all",
                "group-hover:shadow-md group-hover:-translate-x-0.5",
                fromConfig.bgColor
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center bg-white/70"
                )}>
                  <FromIcon className={cn("h-3.5 w-3.5", fromConfig.color)} />
                </div>
                <span className={fromConfig.color}>{fromConfig.label}</span>
              </div>
              
              {/* 桑基流动条 */}
              <div className="flex-1 relative h-8 flex items-center">
                {/* 背景轨道 */}
                <div className="absolute inset-x-0 h-1 bg-muted/40 rounded-full" />
                
                {/* 流动条 - 粗细根据数量变化 */}
                <div
                  className="relative rounded-full overflow-hidden transition-all duration-700 ease-out"
                  style={{
                    width: `${flowWidth}%`,
                    height: `${flowHeight}px`,
                    background: `linear-gradient(90deg, ${fromConfig.accentColor}dd, ${toConfig.accentColor}dd)`,
                    boxShadow: `0 2px 8px ${fromConfig.accentColor}30`,
                  }}
                >
                  {/* 流动光效 */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                      animation: 'sankey-shine 2.5s ease-in-out infinite',
                    }}
                  />
                </div>
                
                {/* 数量标签 - 居中显示 */}
                <div 
                  className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 shadow-sm backdrop-blur-sm"
                  style={{ 
                    left: `calc(${flowWidth / 2}% - 16px)`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <span className="text-xs font-bold font-tabular" style={{ color: toConfig.accentColor }}>
                    {flow.count}
                  </span>
                </div>
                
                {/* 箭头 */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <ArrowLeft 
                    className="h-4 w-4 rotate-180 transition-transform group-hover:translate-x-0.5" 
                    style={{ color: toConfig.accentColor }}
                  />
                </div>
              </div>
              
              {/* 目标盒子 */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                "shadow-sm ring-1 ring-black/[0.03] transition-all",
                "group-hover:shadow-md group-hover:translate-x-0.5",
                toConfig.bgColor
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center bg-white/70"
                )}>
                  <ToIcon className={cn("h-3.5 w-3.5", toConfig.color)} />
                </div>
                <span className={toConfig.color}>{toConfig.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 底部提示 */}
      {flows.length > 4 && (
        <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-muted-foreground text-center">
          还有 <span className="font-medium font-tabular">{flows.length - 4}</span> 条其他流向
        </div>
      )}
    </div>
  );
}

// 盒子列表页面
function BoxesView({
  onOpenBox,
}: {
  onOpenBox: (type: CardType) => void;
}) {
  const stats = useBoxStats();
  const { cards } = useAppStore();
  
  const totalCards = cards.length;
  const totalLinks = cards.reduce((sum, c) => sum + c.links.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* 头部统计 - 建议5: 数字使用等宽字体，更精致的统计展示 */}
      <div className="border-b px-6 py-4 bg-card shadow-sm">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-lg font-semibold">我的卡片盒</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-tabular-lg text-foreground">{totalCards}</span> 张卡片 · 
              <span className="font-tabular-lg text-foreground ml-1">{totalLinks}</span> 条链接
            </p>
          </div>
          <div className="flex items-center gap-1">
            {cardTypes.map((type) => {
              const config = typeConfig[type];
              const Icon = config.icon;
              return (
                <div 
                  key={type} 
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                    "hover:bg-muted/50"
                  )}
                  onClick={() => onOpenBox(type)}
                >
                  <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", config.bgColor)}>
                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  </div>
                  <span className="text-sm font-tabular font-medium">{stats[type].count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 主内容 - 建议1: 使用微妙的背景网格 */}
      <ScrollArea className="flex-1 min-h-0">
        <div 
          className="p-6 max-w-5xl mx-auto min-h-full"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 0)`,
            backgroundSize: '20px 20px',
          }}
        >
          {/* 知识流动图 */}
          <KnowledgeFlow stats={stats} />

          {/* 盒子网格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {cardTypes.map((type) => (
              <BoxCard
                key={type}
                type={type}
                stats={stats[type]}
                onClick={() => onOpenBox(type)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* CSS 动画 */}
      <style>{`
        @keyframes flow {
          from { background-position: 0 0; }
          to { background-position: 48px 48px; }
        }
      `}</style>
    </div>
  );
}

// ==================== 卡片列表组件 ====================

// 格式化卡片 ID 为短格式
function formatCardId(id: string): string {
  // 取前 6 位作为显示
  return id.slice(0, 6).toUpperCase();
}

// 建议3: 卡片网格项 - 瀑布流中的卡片，内容长度自适应
function CardGridItem({
  card,
  onSelect,
  onDelete,
  onOpenInSplit,
  isSelected,
}: {
  card: CardData;
  onSelect: () => void;
  onDelete: () => void;
  onOpenInSplit?: () => void;
  isSelected?: boolean;
}) {
  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <Card
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-all duration-200 group overflow-hidden h-full flex flex-col",
        // 选中态样式
        isSelected && [
          "ring-2 relative",
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-xl before:z-10",
          config.color.includes('amber') && "ring-amber-500/30 before:bg-amber-500 bg-amber-50/30",
          config.color.includes('sky') && "ring-sky-500/30 before:bg-sky-500 bg-sky-50/30",
          config.color.includes('emerald') && "ring-emerald-500/30 before:bg-emerald-500 bg-emerald-50/30",
          config.color.includes('violet') && "ring-violet-500/30 before:bg-violet-500 bg-violet-50/30",
        ],
        // 非选中时的悬停效果
        !isSelected && "hover:shadow-lg"
      )}
      style={isSelected ? {
        boxShadow: `0 0 0 1px ${config.accentColor}20, 0 4px 16px ${config.accentColor}15`,
      } : undefined}
    >
      {/* 顶部色条 */}
      <div 
        className="h-1 w-full flex-shrink-0"
        style={{ background: `linear-gradient(90deg, ${config.accentColor}, ${config.accentColor}80)` }}
      />
      
      {/* 卡片内容 */}
      <div className="flex-1 flex flex-col p-3">
        {/* 头部：类型图标 + 标题 */}
        <div className="flex items-start gap-2.5 mb-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            config.bgColor
          )}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-0.5">
              {card.title || "无标题"}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <code className="font-mono font-tabular">{formatCardId(card.id)}</code>
              <span>·</span>
              <span className="font-tabular">{formatTime(card.updatedAt)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5 -mr-1 flex-shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelect(); }}>
                <Edit className="h-3.5 w-3.5 mr-2" />
                编辑
              </DropdownMenuItem>
              {onOpenInSplit && (
                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpenInSplit(); }}>
                  <PanelRightOpen className="h-3.5 w-3.5 mr-2" />
                  在侧栏打开
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 内容摘要 - 固定3行 */}
        <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3 min-h-[3.5rem]">
          {card.content || "暂无内容"}
        </p>
        
        {/* 底部元信息 */}
        <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-border/40">
          <div className="flex gap-1.5 min-w-0 overflow-hidden">
            {card.tags.slice(0, 2).map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0 h-5 truncate max-w-[80px]"
              >
                {tag}
              </Badge>
            ))}
            {card.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground font-tabular">+{card.tags.length - 2}</span>
            )}
          </div>
          {card.links.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0 font-tabular">
              <Link2 className="h-3 w-3" />
              {card.links.length}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// 建议3: 卡片列表项 - 更明显的选中态样式
function CardListItem({
  card,
  onSelect,
  onDelete,
  onOpenInSplit,
  isSelected,
}: {
  card: CardData;
  onSelect: () => void;
  onDelete: () => void;
  onOpenInSplit?: () => void;
  isSelected?: boolean;
}) {
  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card cursor-pointer transition-all group relative",
        // 建议3: 选中态 - 左侧强调色竖线 + 背景变化 + 更明显的视觉反馈
        isSelected ? [
          "border-transparent",
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-lg",
          config.color.includes('amber') && "before:bg-amber-500 bg-amber-50/50",
          config.color.includes('sky') && "before:bg-sky-500 bg-sky-50/50",
          config.color.includes('emerald') && "before:bg-emerald-500 bg-emerald-50/50",
          config.color.includes('violet') && "before:bg-violet-500 bg-violet-50/50",
        ] : "hover:bg-accent/50 hover:border-border/80"
      )}
      style={isSelected ? {
        boxShadow: `0 0 0 1px ${config.accentColor}25, 0 2px 8px ${config.accentColor}10`,
      } : undefined}
    >
      <code className="text-[10px] text-muted-foreground font-mono bg-muted/80 px-1.5 py-0.5 rounded flex-shrink-0 font-tabular">
        {formatCardId(card.id)}
      </code>
      <div className={cn(
        "w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
        config.bgColor
      )}>
        <Icon className={cn("h-3 w-3", config.color)} />
      </div>
      <span className="text-sm font-medium truncate min-w-0 max-w-[180px]">
        {card.title || "无标题"}
      </span>
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
        {card.content || ""}
      </span>
      {card.tags.length > 0 && (
        <div className="hidden md:flex gap-1 flex-shrink-0">
          {card.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 bg-muted/30">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {card.links.length > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0 font-tabular">
          <Link2 className="h-2.5 w-2.5" />
          {card.links.length}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-14 text-right font-tabular">
        {formatTime(card.updatedAt)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelect(); }}>
            <Edit className="h-3.5 w-3.5 mr-2" />
            编辑
          </DropdownMenuItem>
          {onOpenInSplit && (
            <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpenInSplit(); }}>
              <PanelRightOpen className="h-3.5 w-3.5 mr-2" />
              在侧栏打开
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }}
            className="text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ==================== 卡片编辑器组件 ====================

// 建议4: 卡片编辑器 - 内容限宽居中，保持"卡片"形态
function CardEditor({
  card,
  onClose,
  onOpenLink,
  showCloseButton,
  isFullPage,
}: {
  card: CardData;
  onClose?: () => void;
  onOpenLink?: (id: string) => void;
  showCloseButton?: boolean;
  isFullPage?: boolean; // 是否是全页展示（详情页场景）
}) {
  const { updateCard, cards } = useAppStore();
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [tagInput, setTagInput] = useState("");

  const config = typeConfig[card.type];
  const Icon = config.icon;

  const linkedCards = card.links
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean);
  const backlinks = cards.filter((c) => c.links.includes(card.id));

  const handleSave = () => {
    updateCard(card.id, { title, content });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!card.tags.includes(tagInput.trim())) {
        updateCard(card.id, { tags: [...card.tags, tagInput.trim()] });
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateCard(card.id, { tags: card.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 头部 - 紧凑的元信息，带有顶部色条暗示 */}
      <div className={cn(
        "px-4 py-2 border-b flex items-center justify-between relative flex-shrink-0",
        "bg-gradient-to-b from-muted/40 to-transparent"
      )}>
        {/* 顶部色条 */}
        <div 
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, ${config.accentColor}, ${config.accentColor}80)` }}
        />
        <div className="flex items-center gap-2">
          <code className="text-[10px] text-muted-foreground font-mono bg-muted/80 px-1.5 py-0.5 rounded font-tabular">
            {formatCardId(card.id)}
          </code>
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
            config.bgColor
          )}>
            <Icon className={cn("h-3 w-3", config.color)} />
            <span className={cn("font-medium", config.color)}>{config.label}</span>
          </div>
        </div>
        {showCloseButton && onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      {/* 时间信息 */}
      <div className="px-4 py-1.5 border-b text-[10px] text-muted-foreground flex items-center gap-3 font-tabular bg-muted/10 flex-shrink-0">
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          创建: {new Date(card.createdAt).toLocaleDateString("zh-CN")}
        </span>
        <span>更新: {new Date(card.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>

      {/* 内容 - 可滚动区域 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className={cn(
          "p-4 space-y-4",
          // 建议4: 全页展示时限制最大宽度 650px-700px，居中显示，左右留白
          isFullPage && "max-w-[680px] mx-auto px-8"
        )}>
          {/* 标题输入 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className={cn(
              "w-full text-lg font-semibold bg-transparent outline-none",
              "border-b border-transparent focus:border-border/50 pb-1.5",
              "transition-all placeholder:text-muted-foreground/50"
            )}
            placeholder="卡片标题"
          />
          
          {/* 内容输入 */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            className={cn(
              "w-full min-h-[160px] bg-transparent outline-none resize-none",
              "text-sm text-foreground/85 leading-relaxed",
              "placeholder:text-muted-foreground/40"
            )}
            placeholder="写下你的想法..."
          />

          {/* 标签区域 */}
          <div className="pt-3 border-t border-border/40">
            <p className="text-[11px] font-medium mb-2 text-muted-foreground">标签</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {card.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={cn(
                    "cursor-pointer text-[11px] transition-all px-2 py-0",
                    "hover:bg-destructive/10 hover:text-destructive"
                  )}
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag}
                  <X className="h-2.5 w-2.5 ml-1 opacity-50 hover:opacity-100" />
                </Badge>
              ))}
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="添加标签..."
                className="h-6 w-24 text-[11px] bg-muted/30 border-dashed"
              />
            </div>
          </div>

          {/* 关联卡片 */}
          {(linkedCards.length > 0 || backlinks.length > 0) && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-[11px] font-medium mb-2 text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                关联卡片
              </p>
              {linkedCards.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-tabular">
                    出链 ({linkedCards.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedCards.map(
                      (linked) =>
                        linked && (
                          <Button
                            key={linked.id}
                            variant="outline"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => onOpenLink?.(linked.id)}
                          >
                            {linked.title?.slice(0, 12) || "无标题"}
                            {(linked.title?.length || 0) > 12 && "..."}
                          </Button>
                        )
                    )}
                  </div>
                </div>
              )}
              {backlinks.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-tabular">
                    入链 ({backlinks.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {backlinks.map((linked) => (
                      <Button
                        key={linked.id}
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() => onOpenLink?.(linked.id)}
                      >
                        {linked.title?.slice(0, 12) || "无标题"}
                        {(linked.title?.length || 0) > 12 && "..."}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ==================== 盒子详情页面 ====================

function BoxDetailView({
  type,
  onBack,
}: {
  type: CardType;
  onBack: () => void;
}) {
  const { cards, createCard, deleteCard } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [splitCardId, setSplitCardId] = useState<string | null>(null);

  const config = typeConfig[type];
  const Icon = config.icon;

  // 过滤卡片
  const filteredCards = cards
    .filter((card) => card.type === type)
    .filter(
      (card) =>
        !searchQuery ||
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
  const splitCard = splitCardId ? cards.find((c) => c.id === splitCardId) : null;

  const handleCreateCard = () => {
    const card = createCard(type, "");
    setSelectedCardId(card.id);
  };

  const handleOpenLink = (id: string) => {
    // 如果已经打开了一张卡片，在侧栏打开链接的卡片
    if (selectedCardId) {
      setSplitCardId(id);
    } else {
      setSelectedCardId(id);
    }
  };

  const handleOpenInSplit = (id: string) => {
    setSplitCardId(id);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* 主内容区 */}
      <div className={cn("flex flex-col flex-1 min-w-0 overflow-hidden", (selectedCard || splitCard) && "border-r")}>
        {/* 工具栏 */}
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Icon className={cn("h-4 w-4", config.color)} />
              <h1 className="text-sm font-semibold">{config.label}盒</h1>
              <Badge variant="outline">{filteredCards.length}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className="pl-7 h-7 w-40 text-xs"
                />
              </div>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="h-7 w-7 rounded-r-none"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="h-7 w-7 rounded-l-none"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button onClick={handleCreateCard} size="sm" className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                新建
              </Button>
            </div>
          </div>
        </div>

        {/* 卡片列表 - 可滚动区域 */}
        <ScrollArea className="flex-1 min-h-0">
          <div
            className="p-5"
            style={{
              // 建议1: 更微妙的背景网格，增加"桌面"的质感
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.025) 1px, transparent 0)`,
              backgroundSize: '20px 20px',
            }}
          >
            {filteredCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Plus className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm mb-1">暂无卡片</p>
                <p className="text-xs mb-4">点击「新建」创建第一张卡片</p>
                <Button onClick={handleCreateCard} size="sm" className="shadow-sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  创建卡片
                </Button>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-1.5 max-w-4xl">
                {filteredCards.map((card) => (
                  <CardListItem
                    key={card.id}
                    card={card}
                    onSelect={() => setSelectedCardId(card.id)}
                    onDelete={() => deleteCard(card.id)}
                    onOpenInSplit={() => handleOpenInSplit(card.id)}
                    isSelected={selectedCardId === card.id}
                  />
                ))}
              </div>
            ) : (
              // 建议3: 瀑布流布局 - 模拟"把卡片铺在桌子上"的有机感
              <div className="masonry-grid">
                {filteredCards.map((card) => (
                  <CardGridItem
                    key={card.id}
                    card={card}
                    onSelect={() => setSelectedCardId(card.id)}
                    onDelete={() => deleteCard(card.id)}
                    onOpenInSplit={() => handleOpenInSplit(card.id)}
                    isSelected={selectedCardId === card.id}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧编辑面板 - 支持双栏 */}
      {(selectedCard || splitCard) && (
        <div className="flex h-full">
          {/* 主编辑器 */}
          {selectedCard && (
            <div className={cn("w-80 h-full border-r flex flex-col", splitCard && "border-r")}>
              <CardEditor
                key={selectedCard.id}
                card={selectedCard}
                onClose={() => setSelectedCardId(null)}
                onOpenLink={handleOpenLink}
                showCloseButton
              />
            </div>
          )}
          {/* 侧栏编辑器（双链查看） */}
          {splitCard && (
            <div className="w-80 h-full bg-muted/30 flex flex-col">
              <CardEditor
                key={splitCard.id}
                card={splitCard}
                onClose={() => setSplitCardId(null)}
                onOpenLink={(id) => {
                  // 在侧栏点击链接，替换侧栏内容
                  setSplitCardId(id);
                }}
                showCloseButton
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 文献库组件 ====================

// 文献源卡片 - 建议5: 数字使用等宽字体，更精致的卡片设计
function SourceCard({
  source,
  onClick,
}: {
  source: Source;
  onClick: () => void;
}) {
  const config = sourceTypeConfig[source.type];
  const Icon = config.icon;

  return (
    <Card 
      onClick={onClick} 
      className="cursor-pointer transition-all group hover:shadow-lg hover:-translate-y-1"
    >
      <CardContent className="p-4">
        <div className="flex gap-3.5">
          {/* 封面/图标 - 更精致的设计 */}
          <div className={cn(
            "w-14 h-18 rounded-lg flex items-center justify-center flex-shrink-0",
            "bg-gradient-to-br from-muted/80 to-muted/40",
            "ring-1 ring-black/[0.03]"
          )}>
            <Icon className={cn("h-7 w-7", config.color)} />
          </div>
          
          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium line-clamp-1">{source.title}</h3>
              <Badge 
                variant="outline" 
                className="text-[10px] flex-shrink-0 bg-muted/30"
              >
                {config.label}
              </Badge>
            </div>
            {source.author && (
              <p className="text-xs text-muted-foreground mt-0.5">{source.author}</p>
            )}
            
            {/* 进度条 - 更精致 */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>阅读进度</span>
                <span className="font-tabular-lg text-xs">{source.progress}%</span>
              </div>
              <Progress value={source.progress} className="h-1.5" />
            </div>
            
            {/* 底部信息 */}
            <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
              {source.noteIds.length > 0 && (
                <span className="flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  <span className="font-tabular">{source.noteIds.length}</span> 笔记
                </span>
              )}
              {source.lastReadAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(source.lastReadAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 文献阅读器视图（左侧阅读，右侧笔记）
function ReaderView({
  source,
  onBack,
}: {
  source: Source;
  onBack: () => void;
}) {
  const { cards, createCard, getHighlightsBySource, getNotesBySource } = useAppStore();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  
  const config = sourceTypeConfig[source.type];
  const Icon = config.icon;
  const sourceHighlights = getHighlightsBySource(source.id);
  const sourceNotes = getNotesBySource(source.id);
  const selectedNote = selectedNoteId ? cards.find((c) => c.id === selectedNoteId) : null;

  // 检测是否有可阅读的文件
  const hasReadableFile = source.url && (
    source.url.toLowerCase().endsWith('.epub') ||
    source.url.toLowerCase().endsWith('.pdf')
  );

  const handleCreateNote = () => {
    const note = createCard("literature", `${source.title} 笔记`, source.id);
    setSelectedNoteId(note.id);
  };

  return (
    <div className="flex h-full">
      {/* 左侧：阅读区 */}
      <div className="flex-1 flex flex-col border-r">
        {/* 头部 */}
        <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Icon className={cn("h-4 w-4", config.color)} />
            <div className="min-w-0">
              <h1 className="text-sm font-medium truncate">{source.title}</h1>
              {source.author && (
                <p className="text-xs text-muted-foreground">{source.author}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {source.url && !hasReadableFile && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  打开原文
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCreateNote}>
              <Plus className="h-3 w-3 mr-1" />
              新建笔记
            </Button>
          </div>
        </div>

        {/* 阅读内容区 */}
        {hasReadableFile ? (
          // 有可阅读文件时显示阅读器
          <div className="flex-1 relative">
            {source.url?.toLowerCase().endsWith('.epub') ? (
              <EpubReaderEmbed source={source} />
            ) : (
              <PdfReaderEmbed source={source} />
            )}
          </div>
        ) : (
          // 无可阅读文件时显示信息页
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 max-w-3xl mx-auto">
              {/* 文献信息卡片 */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-28 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <Icon className={cn("h-10 w-10", config.color)} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold mb-1">{source.title}</h2>
                      {source.author && (
                        <p className="text-sm text-muted-foreground mb-2">{source.author}</p>
                      )}
                      {source.description && (
                        <p className="text-sm text-muted-foreground mb-3">{source.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {source.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {source.metadata && (
                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                          {source.metadata.pageCount && <span>{source.metadata.pageCount} 页</span>}
                          {source.metadata.publisher && <span>{source.metadata.publisher}</span>}
                          {source.metadata.publishDate && <span>{source.metadata.publishDate}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 进度 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>阅读进度</span>
                      <span className="font-medium font-tabular">{source.progress}%</span>
                    </div>
                    <Progress value={source.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* 高亮摘录 */}
              {sourceHighlights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Highlighter className="h-4 w-4 text-yellow-500" />
                    高亮摘录 ({sourceHighlights.length})
                  </h3>
                  <div className="space-y-2">
                    {sourceHighlights.map((h) => (
                      <Card key={h.id} className="bg-yellow-50 border-yellow-200">
                        <CardContent className="p-3">
                          <p className="text-sm italic">"{h.content}"</p>
                          {h.note && (
                            <p className="text-xs text-muted-foreground mt-2 pl-3 border-l-2">
                              {h.note}
                            </p>
                          )}
                          {h.position && (
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {h.position.chapter && `${h.position.chapter} · `}
                              {h.position.page && `第 ${h.position.page} 页`}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* 上传提示 */}
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm mb-2">添加 EPUB 或 PDF 文件</p>
                  <p className="text-xs mb-4">
                    上传文件后即可在线阅读、划线和记录笔记
                  </p>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    上传文件
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* 右侧：笔记区 */}
      <div className="w-80 flex flex-col bg-muted/20">
        {/* 笔记列表头部 */}
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">文献笔记</span>
          <Badge variant="outline" className="font-tabular">{sourceNotes.length}</Badge>
        </div>

        {selectedNote ? (
          // 显示选中的笔记编辑器
          <CardEditor
            card={selectedNote}
            onClose={() => setSelectedNoteId(null)}
            showCloseButton
          />
        ) : (
          // 显示笔记列表
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {sourceNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs mb-2">还没有笔记</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={handleCreateNote}>
                    <Plus className="h-3 w-3 mr-1" />
                    创建笔记
                  </Button>
                </div>
              ) : (
                sourceNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className="p-2 rounded border bg-card hover:bg-accent/50 cursor-pointer"
                  >
                    <p className="text-sm font-medium truncate">{note.title || "无标题"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {note.content || "暂无内容"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatTime(note.updatedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// 文献库页面 - 建议5: 数字使用等宽字体，更精致的布局
function LibraryView({
  onBack,
  onOpenSource,
}: {
  onBack: () => void;
  onOpenSource: (source: Source) => void;
}) {
  const { sources } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<SourceType | "all">("all");

  // 过滤
  const filteredSources = sources
    .filter((s) => filterType === "all" || s.type === filterType)
    .filter(
      (s) =>
        !searchQuery ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.author?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (b.lastReadAt || b.updatedAt) - (a.lastReadAt || a.updatedAt));

  // 统计
  const stats = {
    total: sources.length,
    reading: sources.filter((s) => s.progress > 0 && s.progress < 100).length,
    completed: sources.filter((s) => s.progress === 100).length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 - 建议5: 数字使用等宽字体 */}
      <div className="border-b px-4 py-3 bg-card shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Library className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold">文献库</h1>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">总计</span>
              <span className="font-tabular-lg">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-muted-foreground">阅读中</span>
              <span className="font-tabular-lg">{stats.reading}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground">已读完</span>
              <span className="font-tabular-lg">{stats.completed}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 类型过滤 */}
          <div className="flex gap-1">
            <Button
              variant={filterType === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilterType("all")}
            >
              全部
            </Button>
            {(Object.keys(sourceTypeConfig) as SourceType[]).map((type) => {
              const config = sourceTypeConfig[type];
              const Icon = config.icon;
              const count = sources.filter((s) => s.type === type).length;
              if (count === 0) return null;
              return (
                <Button
                  key={type}
                  variant={filterType === type ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setFilterType(type)}
                >
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  {config.label}
                  <span className="text-muted-foreground font-tabular">{count}</span>
                </Button>
              );
            })}
          </div>
          
          <div className="flex-1" />
          
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文献..."
              className="pl-8 h-8 w-52 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 文献列表 - 建议1: 添加背景纹理 */}
      <ScrollArea className="flex-1 min-h-0">
        <div 
          className="p-5 min-h-full"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 0)`,
            backgroundSize: '20px 20px',
          }}
        >
          {filteredSources.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 mx-auto">
                <Library className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm mb-2">暂无文献</p>
              <p className="text-xs mb-4">添加书籍、文章、网页等开始阅读</p>
              <Button variant="outline" size="sm" className="shadow-sm">
                <Plus className="h-4 w-4 mr-1.5" />
                添加文献
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  onClick={() => onOpenSource(source)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ==================== 主组件 ====================

type ViewState = 
  | { type: "boxes" }
  | { type: "box"; boxType: CardType }
  | { type: "library" }
  | { type: "reader"; source: Source };

export function CardDesk() {
  const [view, setView] = useState<ViewState>({ type: "boxes" });

  // 盒子页面
  if (view.type === "boxes") {
    return (
      <div className="flex flex-col h-full">
        {/* 顶部导航 */}
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setView({ type: "boxes" })}
            >
              <LayoutGrid className="h-4 w-4" />
              卡片盒
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setView({ type: "library" })}
            >
              <Library className="h-4 w-4" />
              文献库
            </Button>
          </div>
        </div>
        <div className="flex-1">
          <BoxesView onOpenBox={(type) => setView({ type: "box", boxType: type })} />
        </div>
      </div>
    );
  }

  // 盒子详情
  if (view.type === "box") {
    return (
      <div className="h-full overflow-hidden">
        <BoxDetailView
          type={view.boxType}
          onBack={() => setView({ type: "boxes" })}
        />
      </div>
    );
  }

  // 文献库
  if (view.type === "library") {
    return (
      <div className="flex flex-col h-full">
        {/* 顶部导航 */}
        <div className="border-b px-4 py-2 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setView({ type: "boxes" })}
          >
            <LayoutGrid className="h-4 w-4" />
            卡片盒
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
          >
            <Library className="h-4 w-4" />
            文献库
          </Button>
        </div>
        <div className="flex-1">
          <LibraryView
            onBack={() => setView({ type: "boxes" })}
            onOpenSource={(source) => setView({ type: "reader", source })}
          />
        </div>
      </div>
    );
  }

  // 阅读器
  if (view.type === "reader") {
    return (
      <ReaderView
        source={view.source}
        onBack={() => setView({ type: "library" })}
      />
    );
  }

  return null;
}

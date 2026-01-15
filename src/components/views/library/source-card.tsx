/**
 * Source Card Component - 单个文献源卡片
 * 从 library-view.tsx 提取的子组件
 */
import { BookOpen, Highlighter, MoreVertical, Trash2 } from "lucide-react";
import type { Source } from "@/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SourceCardProps {
    source: Source;
    onRead: (source: Source) => void;
    onDelete: (source: Source, e?: React.MouseEvent) => void;
}

// 柔和颜色的几何图形封面配置（莫兰迪色系）
const COVER_PATTERNS = [
    { bg: 'bg-rose-100', accent: 'bg-rose-200', pattern: 'circle' },
    { bg: 'bg-blue-100', accent: 'bg-blue-200', pattern: 'square' },
    { bg: 'bg-emerald-100', accent: 'bg-emerald-200', pattern: 'triangle' },
    { bg: 'bg-violet-100', accent: 'bg-violet-200', pattern: 'diamond' },
    { bg: 'bg-amber-100', accent: 'bg-amber-200', pattern: 'hexagon' },
    { bg: 'bg-sky-100', accent: 'bg-sky-200', pattern: 'circle' },
    { bg: 'bg-pink-100', accent: 'bg-pink-200', pattern: 'square' },
    { bg: 'bg-teal-100', accent: 'bg-teal-200', pattern: 'triangle' },
];

// 根据source ID生成稳定的随机索引
function getCoverPatternIndex(sourceId: string): number {
    let hash = 0;
    for (let i = 0; i < sourceId.length; i++) {
        hash = ((hash << 5) - hash) + sourceId.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash) % COVER_PATTERNS.length;
}

// 根据类型和ID获取封面颜色和图案
function getCoverColor(type: Source['type'], sourceId?: string): { bg: string; accent: string; pattern: string } {
    if (sourceId) {
        const index = getCoverPatternIndex(sourceId);
        return COVER_PATTERNS[index];
    }
    // 回退到基于类型的颜色
    const typeColors: Record<string, { bg: string; accent: string; pattern: string }> = {
        book: { bg: 'bg-rose-100', accent: 'bg-rose-200', pattern: 'circle' },
        article: { bg: 'bg-blue-100', accent: 'bg-blue-200', pattern: 'square' },
        webpage: { bg: 'bg-zinc-100', accent: 'bg-zinc-200', pattern: 'diamond' },
        video: { bg: 'bg-violet-100', accent: 'bg-violet-200', pattern: 'triangle' },
        podcast: { bg: 'bg-pink-100', accent: 'bg-pink-200', pattern: 'hexagon' },
        paper: { bg: 'bg-emerald-100', accent: 'bg-emerald-200', pattern: 'square' },
    };
    return typeColors[type] || { bg: 'bg-zinc-100', accent: 'bg-zinc-200', pattern: 'circle' };
}

// 格式化时间差
function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)}mo ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

// Type Badge 组件
function TypeBadge({ type, hasBackdrop = false }: { type: Source['type']; hasBackdrop?: boolean }) {
    const badges: Record<string, { color: string; label: string }> = {
        book: { color: hasBackdrop ? 'bg-red-500/90 backdrop-blur-sm' : 'bg-red-500', label: 'EPUB' },
        article: { color: hasBackdrop ? 'bg-blue-500/90 backdrop-blur-sm' : 'bg-blue-500', label: 'ARTICLE' },
        webpage: { color: hasBackdrop ? 'bg-zinc-800/90 backdrop-blur-sm' : 'bg-zinc-800', label: 'WEB' },
        paper: { color: hasBackdrop ? 'bg-red-500/90 backdrop-blur-sm' : 'bg-red-500', label: 'PDF' },
        video: { color: hasBackdrop ? 'bg-purple-500/90 backdrop-blur-sm' : 'bg-purple-500', label: 'VIDEO' },
        podcast: { color: hasBackdrop ? 'bg-pink-500/90 backdrop-blur-sm' : 'bg-pink-500', label: 'PODCAST' },
    };

    const badge = badges[type];
    if (!badge) return null;

    return (
        <div className={`${badge.color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm`}>
            {badge.label}
        </div>
    );
}

// 渲染几何图形图案
function renderPattern(pattern: string, accent: string) {
    switch (pattern) {
        case 'circle':
            return (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className={`w-24 h-24 ${accent} rounded-full`}></div>
                </div>
            );
        case 'square':
            return (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className={`w-20 h-20 ${accent} rotate-45`}></div>
                </div>
            );
        case 'triangle':
            return (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className={`w-0 h-0 border-l-[40px] border-r-[40px] border-b-[70px] border-l-transparent border-r-transparent ${accent.replace('bg-', 'border-')}`}></div>
                </div>
            );
        case 'diamond':
            return (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className={`w-16 h-16 ${accent} rotate-45`}></div>
                </div>
            );
        case 'hexagon':
            return (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className={`w-20 h-20 ${accent} transform rotate-30`} style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
                </div>
            );
        default:
            return null;
    }
}

export function SourceCard({ source, onRead, onDelete }: SourceCardProps) {
    const coverPattern = getCoverColor(source.type, source.id);
    const highlights = source.noteIds?.length || 0;
    const added = formatTimeAgo(source.createdAt);

    return (
        <div className="group flex flex-col gap-2 relative">
            {/* 右键菜单按钮 */}
            <div className="absolute top-2 right-2 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-white/90 hover:bg-white rounded-sm shadow-sm border border-zinc-200 backdrop-blur-sm"
                            title="更多操作"
                        >
                            <MoreVertical size={14} className="text-zinc-600" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => onRead(source)}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            阅读
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={(e) => onDelete(source, e)}
                            className="text-red-600 focus:text-red-600"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div onClick={() => onRead(source)} className="cursor-pointer">
                {/* Book Cover */}
                <div className={`aspect-[3/4] rounded-sm shadow-sm relative overflow-hidden border border-zinc-200 transition-all group-hover:shadow-md group-hover:-translate-y-1 ${source.cover ? 'bg-zinc-100' : coverPattern.bg} flex flex-col justify-between`}>
                    {source.cover ? (
                        <>
                            <img
                                src={source.cover}
                                alt={source.title}
                                className="absolute inset-0 w-full h-full object-cover z-0"
                                loading="lazy"
                                onError={(e) => {
                                    const img = e.currentTarget;
                                    img.style.display = 'none';
                                    const parent = img.parentElement;
                                    if (parent) {
                                        parent.className = parent.className.replace(/bg-\w+-\d+/g, '');
                                        const colorClass = getCoverColor(source.type, source.id);
                                        parent.classList.add(colorClass.bg);
                                    }
                                }}
                            />
                            {/* 有封面时的内容覆盖层 */}
                            <div className="relative z-10 flex flex-col p-4 justify-between h-full bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
                                <div className="text-white/95 font-bold font-serif text-lg leading-tight drop-shadow-lg">
                                    {source.title}
                                </div>

                                {/* Type Badge */}
                                <div className="absolute top-2 right-2 z-20 pointer-events-auto">
                                    <TypeBadge type={source.type} hasBackdrop />
                                </div>

                                <div className="text-white/90 text-xs font-medium drop-shadow-lg mt-auto">
                                    {source.author || 'Unknown'}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* 无封面时的几何图形占位符 */
                        <>
                            {renderPattern(coverPattern.pattern, coverPattern.accent)}
                            <div className="relative z-10 flex flex-col p-4 justify-between h-full">
                                <div className="text-zinc-700 font-bold font-serif text-lg leading-tight">
                                    {source.title}
                                </div>

                                {/* Type Badge */}
                                <div className="absolute top-2 right-2 z-20">
                                    <TypeBadge type={source.type} />
                                </div>

                                <div className="text-zinc-600 text-xs font-medium mt-auto">
                                    {source.author || 'Unknown'}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30 pointer-events-none">
                        <button className="bg-white text-zinc-900 px-3 py-1.5 rounded-sm text-xs font-bold shadow-lg flex items-center gap-2 pointer-events-auto">
                            <BookOpen size={14} /> Read
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 z-20">
                        <div
                            className="h-full bg-white/90 transition-all"
                            style={{ width: `${source.progress}%` }}
                        ></div>
                    </div>
                </div>

                {/* Meta */}
                <div className="flex justify-between items-start px-0.5">
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-zinc-700 truncate group-hover:text-blue-600 transition-colors">
                            {source.title}
                        </span>
                        <span className="text-[10px] text-zinc-400">{added}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 rounded-sm shrink-0">
                        <Highlighter size={10} /> {highlights}
                    </div>
                </div>
            </div>
        </div>
    );
}

export { formatTimeAgo };

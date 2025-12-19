import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BookOpen, Search, Import, Grid, List, UploadCloud, Highlighter, Filter, X, ChevronDown, ChevronUp, BarChart3, Trash2, MoreVertical } from "lucide-react";
import { useAppStore } from "@/store";
import type { Source, SourceType } from "@/types";
import { CreateSourceDialog } from "@/components/create-source-dialog";
import { pickReadableFile } from "@/lib/file-picker";
import { parseBookMetadata, generatePlaceholderCover } from "@/lib/book-metadata";
import { useDebounce } from "@/hooks/use-debounce";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LibraryViewProps {
    onRead?: (source: Source) => void;
}

type SortBy = 'updated' | 'created' | 'progress' | 'title';
type SortOrder = 'asc' | 'desc';

// 根据类型获取封面颜色
function getCoverColor(type: Source['type']): string {
    const colors: Record<string, string> = {
        book: 'bg-orange-600',
        article: 'bg-blue-600',
        webpage: 'bg-zinc-600',
        video: 'bg-purple-600',
        podcast: 'bg-pink-600',
        paper: 'bg-emerald-600',
    };
    return colors[type] || 'bg-zinc-600';
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

export function LibraryView({ onRead }: LibraryViewProps) {
    const { sources, loadSources, createSource, deleteSource } = useAppStore();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(
        () => (localStorage.getItem('library-view-mode') as 'grid' | 'list') || 'grid'
    );
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showDropZone, setShowDropZone] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; source: Source | null }>({ open: false, source: null });
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // 搜索和过滤状态
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<SourceType | 'all'>('all');
    const [tagFilter, setTagFilter] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortBy>('updated');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // 防抖搜索
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // 保存视图模式到 localStorage
    useEffect(() => {
        localStorage.setItem('library-view-mode', viewMode);
    }, [viewMode]);

    // 加载数据 - 如果sources为空则加载
    useEffect(() => {
        if (sources.length === 0) {
            loadSources();
        }
    }, [sources.length, loadSources]);

    // 处理文件拖放
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            const ext = file.name.toLowerCase().split('.').pop();
            if (ext === 'epub' || ext === 'pdf') {
                // 创建blob URL用于浏览器环境
                const url = URL.createObjectURL(file);
                await handleFileImport({
                    path: url,
                    name: file.name,
                });
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    // 处理文件导入（自动提取元数据）
    const handleFileImport = async (file: { path: string; name: string }) => {
        try {
            // 根据文件类型创建source
            const ext = file.name.toLowerCase().split('.').pop();
            const type = ext === 'pdf' ? 'paper' : 'book';
            const nameWithoutExt = file.name.replace(/\.(epub|pdf)$/i, "");
            
            // 尝试解析元数据
            let title = nameWithoutExt;
            let author: string | undefined;
            let cover: string | undefined;
            
            try {
                const metadata = await parseBookMetadata(file.path);
                if (metadata.title) title = metadata.title;
                if (metadata.author) author = metadata.author;
                if (metadata.coverUrl) cover = metadata.coverUrl;
            } catch (err) {
                console.warn("Failed to parse metadata, using filename:", err);
            }
            
            await createSource({
                type: type as Source['type'],
                title,
                author,
                url: file.path,
                cover: cover || generatePlaceholderCover(title, type as 'book' | 'paper'),
                tags: [],
                progress: 0,
            });
            // 导入后自动刷新
            await loadSources();
        } catch (err) {
            console.error("Failed to import file:", err);
        }
    };

    // 处理Import按钮点击 - 直接打开创建对话框
    const handleImportClick = () => {
        setShowCreateDialog(true);
    };

    // 快速导入文件（用于拖放区域点击）
    const handleQuickImport = async () => {
        const result = await pickReadableFile();
        if (result) {
            await handleFileImport(result);
            // 导入后自动刷新
            await loadSources();
        }
    };

    // 获取所有标签
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        sources.forEach(source => {
            source.tags?.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }, [sources]);

    // 处理搜索和过滤
    const processedSources = useMemo(() => {
        let result = [...sources];

        // 搜索过滤
        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase();
            result = result.filter(source => 
                source.title.toLowerCase().includes(query) ||
                source.author?.toLowerCase().includes(query) ||
                source.description?.toLowerCase().includes(query) ||
                source.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // 类型过滤
        if (typeFilter !== 'all') {
            result = result.filter(s => s.type === typeFilter);
        }

        // 标签过滤
        if (tagFilter) {
            result = result.filter(s => s.tags.includes(tagFilter));
        }

        // 排序
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'progress':
                    comparison = a.progress - b.progress;
                    break;
                case 'created':
                    comparison = a.createdAt - b.createdAt;
                    break;
                case 'updated':
                default:
                    comparison = a.updatedAt - b.updatedAt;
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [sources, debouncedSearchQuery, typeFilter, tagFilter, sortBy, sortOrder]);

    // 统计信息
    const stats = useMemo(() => {
        const total = sources.length;
        const byType = sources.reduce((acc, s) => {
            acc[s.type] = (acc[s.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const avgProgress = total > 0 
            ? Math.round(sources.reduce((sum, s) => sum + s.progress, 0) / total) 
            : 0;
        const completed = sources.filter(s => s.progress === 100).length;
        const inProgress = sources.filter(s => s.progress > 0 && s.progress < 100).length;
        const notStarted = sources.filter(s => s.progress === 0).length;
        
        return { total, byType, avgProgress, completed, inProgress, notStarted };
    }, [sources]);

    // 切换排序
    const handleSort = useCallback((newSortBy: SortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('desc');
        }
    }, [sortBy]);

    // 清除所有过滤
    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setTypeFilter('all');
        setTagFilter('');
        setSortBy('updated');
        setSortOrder('desc');
    }, []);

    // 处理删除
    const handleDelete = useCallback((source: Source, e?: React.MouseEvent) => {
        e?.stopPropagation(); // 阻止事件冒泡
        setDeleteConfirm({ open: true, source });
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteConfirm.source) return;
        
        try {
            await deleteSource(deleteConfirm.source.id);
            setDeleteConfirm({ open: false, source: null });
            // 删除后自动刷新
            await loadSources();
        } catch (err) {
            console.error("Failed to delete source:", err);
        }
    }, [deleteConfirm.source, deleteSource, loadSources]);

    return (
        <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="border-b border-zinc-200 bg-white shrink-0">
                <div className="h-10 flex items-center px-4 justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        <BookOpen size={14} className="text-zinc-500" /> 
                        Digital Bookshelf
                        {processedSources.length !== sources.length && (
                            <span className="ml-2 text-[10px] font-normal text-zinc-400 normal-case">
                                ({processedSources.length} / {sources.length})
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <div className="flex bg-zinc-100 rounded-sm p-0.5 border border-zinc-200">
                            <button 
                                onClick={() => setViewMode('grid')} 
                                className={`p-1 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                                title="Grid View"
                            >
                                <Grid size={14} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')} 
                                className={`p-1 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                                title="List View"
                            >
                                <List size={14} />
                            </button>
                        </div>
                        <div className="h-full w-px bg-zinc-200 mx-1"></div>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..." 
                                className="pl-7 pr-3 py-1 bg-zinc-50 border border-zinc-200 rounded-sm text-xs w-48 focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-zinc-400" 
                            />
                            <Search size={12} className="absolute left-2 top-1.5 text-zinc-400" />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1.5 text-zinc-400 hover:text-zinc-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-1 px-2 rounded-sm text-xs transition-colors ${
                                showFilters || typeFilter !== 'all' || tagFilter
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                            }`}
                            title="Filters"
                        >
                            <Filter size={12} className="inline mr-1" />
                            Filters
                        </button>
                        <button 
                            onClick={handleImportClick}
                            className="flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium transition-all active:translate-y-px"
                            title="添加文献（网页、电子书、视频等）"
                        >
                            <Import size={12} /> <span className="font-medium">Add</span>
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500 font-medium">Type:</span>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as SourceType | 'all')}
                                className="px-2 py-1 bg-white border border-zinc-200 rounded-sm text-xs focus:outline-none focus:border-blue-500"
                            >
                                <option value="all">All Types</option>
                                <option value="book">Book</option>
                                <option value="article">Article</option>
                                <option value="webpage">Webpage</option>
                                <option value="video">Video</option>
                                <option value="podcast">Podcast</option>
                                <option value="paper">Paper</option>
                            </select>
                        </div>
                        {allTags.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-500 font-medium">Tag:</span>
                                <select
                                    value={tagFilter}
                                    onChange={(e) => setTagFilter(e.target.value)}
                                    className="px-2 py-1 bg-white border border-zinc-200 rounded-sm text-xs focus:outline-none focus:border-blue-500"
                                >
                                    <option value="">All Tags</option>
                                    {allTags.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500 font-medium">Sort:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortBy)}
                                className="px-2 py-1 bg-white border border-zinc-200 rounded-sm text-xs focus:outline-none focus:border-blue-500"
                            >
                                <option value="updated">Last Updated</option>
                                <option value="created">Date Added</option>
                                <option value="progress">Progress</option>
                                <option value="title">Title</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-1 hover:bg-zinc-200 rounded-sm"
                                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                            >
                                {sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        </div>
                        {(typeFilter !== 'all' || tagFilter || searchQuery) && (
                            <button
                                onClick={clearFilters}
                                className="ml-auto px-2 py-1 text-zinc-500 hover:text-zinc-700 text-xs flex items-center gap-1"
                            >
                                <X size={12} />
                                Clear
                            </button>
                        )}
                    </div>
                )}

                {/* Stats Bar */}
                {sources.length > 0 && (
                    <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-1.5 flex items-center gap-4 text-[10px] text-zinc-500">
                        <div className="flex items-center gap-1">
                            <BarChart3 size={10} />
                            <span className="font-medium">{stats.total} total</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span>{stats.completed} completed</span>
                            <span>{stats.inProgress} in progress</span>
                            <span>{stats.notStarted} not started</span>
                            <span className="ml-2">Avg: {stats.avgProgress}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[#f8f9fa] p-6">
                {/* Import Drop Zone - 可折叠 */}
                {showDropZone && (
                    <div 
                        ref={dropZoneRef}
                        onClick={handleQuickImport}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`mb-6 border-2 border-dashed rounded-sm p-4 flex flex-col items-center justify-center transition-colors cursor-pointer group ${
                            isDragging 
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
                )}
                
                {/* Toggle Drop Zone Button */}
                {!showDropZone && (
                    <button
                        onClick={() => setShowDropZone(true)}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className="mb-6 w-full border-2 border-dashed border-zinc-200 rounded-sm p-3 flex items-center justify-center gap-2 text-xs text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                        <UploadCloud size={16} />
                        <span>Click to show import area or drag files here</span>
                    </button>
                )}

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {processedSources.length > 0 ? processedSources.map(source => {
                            const coverColor = getCoverColor(source.type);
                            const highlights = source.noteIds?.length || 0;
                            const added = formatTimeAgo(source.createdAt);
                            
                            // 调试：检查封面数据
                            if (source.cover && !source.cover.startsWith('data:') && !source.cover.startsWith('http')) {
                                console.warn('Source cover URL format may be invalid:', source.id, source.cover);
                            }
                            
                            return (
                                <div 
                                    key={source.id} 
                                    className="group flex flex-col gap-2 relative"
                                >
                                    {/* 右键菜单按钮 - 在hover时显示 */}
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
                                                <DropdownMenuItem onClick={() => onRead?.(source)}>
                                                    <BookOpen className="mr-2 h-4 w-4" />
                                                    阅读
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={(e) => handleDelete(source, e)}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    删除
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    
                                    <div 
                                        onClick={() => onRead?.(source)} 
                                        className="cursor-pointer"
                                    >
                                    {/* Book Cover */}
                                    <div className={`aspect-[3/4] rounded-sm shadow-sm relative overflow-hidden border border-zinc-200 transition-all group-hover:shadow-md group-hover:-translate-y-1 ${source.cover ? 'bg-zinc-100' : coverColor} flex flex-col justify-between`}>
                                        {/* Cover Image - 如果有封面则显示 */}
                                        {source.cover ? (
                                            <>
                                                <img 
                                                    src={source.cover} 
                                                    alt={source.title}
                                                    className="absolute inset-0 w-full h-full object-cover z-0"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        // 如果图片加载失败，隐藏图片显示占位符
                                                        const img = e.currentTarget;
                                                        img.style.display = 'none';
                                                        const parent = img.parentElement;
                                                        if (parent) {
                                                            // 移除可能存在的其他背景类，添加占位符颜色
                                                            parent.className = parent.className.replace(/bg-\w+-\d+/g, '');
                                                            parent.classList.add(coverColor);
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
                                                        {source.type === 'book' && (
                                                            <div className="bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm">EPUB</div>
                                                        )}
                                                        {source.type === 'article' && (
                                                            <div className="bg-blue-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm">ARTICLE</div>
                                                        )}
                                                        {source.type === 'webpage' && (
                                                            <div className="bg-zinc-800/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm">WEB</div>
                                                        )}
                                                        {source.type === 'paper' && (
                                                            <div className="bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm">PDF</div>
                                                        )}
                                                        {source.type === 'video' && (
                                                            <div className="bg-purple-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm">VIDEO</div>
                                                        )}
                                                        {source.type === 'podcast' && (
                                                            <div className="bg-pink-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm">PODCAST</div>
                                                        )}
                                                    </div>

                                                    <div className="text-white/90 text-xs font-medium drop-shadow-lg mt-auto">
                                                        {source.author || 'Unknown'}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            /* 无封面时的占位符内容 */
                                            <div className="relative z-10 flex flex-col p-4 justify-between h-full">
                                                <div className="text-white/90 font-bold font-serif text-lg leading-tight drop-shadow-md">
                                                    {source.title}
                                                </div>
                                                
                                                {/* Type Badge */}
                                                <div className="absolute top-2 right-2 z-20">
                                                    {source.type === 'book' && (
                                                        <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">EPUB</div>
                                                    )}
                                                    {source.type === 'article' && (
                                                        <div className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">ARTICLE</div>
                                                    )}
                                                    {source.type === 'webpage' && (
                                                        <div className="bg-zinc-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">WEB</div>
                                                    )}
                                                    {source.type === 'paper' && (
                                                        <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">PDF</div>
                                                    )}
                                                    {source.type === 'video' && (
                                                        <div className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">VIDEO</div>
                                                    )}
                                                    {source.type === 'podcast' && (
                                                        <div className="bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">PODCAST</div>
                                                    )}
                                                </div>

                                                <div className="text-white/70 text-xs font-medium drop-shadow-md mt-auto">
                                                    {source.author || 'Unknown'}
                                                </div>
                                            </div>
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
                        }) : (
                            <div className="col-span-full text-center py-12 text-zinc-400 text-sm">
                                {sources.length === 0 
                                    ? "No books in your shelf yet. Import some files to get started."
                                    : "No sources match your filters. Try adjusting your search or filters."
                                }
                            </div>
                        )}
                    </div>
                ) : (
                    /* List View */
                    <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-[10px] text-zinc-500 uppercase font-bold border-b border-zinc-200 tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 font-bold w-8"></th>
                                    <th className="px-4 py-2 font-bold w-12 text-center">#</th>
                                    <th 
                                        className="px-4 py-2 font-bold cursor-pointer hover:bg-zinc-100 transition-colors"
                                        onClick={() => handleSort('title')}
                                    >
                                        Title & Author
                                        {sortBy === 'title' && (
                                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </th>
                                    <th className="px-4 py-2 font-bold w-32">Type</th>
                                    <th 
                                        className="px-4 py-2 font-bold w-24 cursor-pointer hover:bg-zinc-100 transition-colors"
                                        onClick={() => handleSort('progress')}
                                    >
                                        Progress
                                        {sortBy === 'progress' && (
                                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </th>
                                    <th className="px-4 py-2 font-bold w-16 text-right">Highlights</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {processedSources.length > 0 ? processedSources.map((source, i) => (
                                    <tr 
                                        key={source.id} 
                                        className="hover:bg-blue-50/30 transition-colors group text-xs relative"
                                    >
                                        {/* 右键菜单按钮 */}
                                        <td className="px-4 py-3 w-8">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded transition-opacity"
                                                        title="更多操作"
                                                    >
                                                        <MoreVertical size={12} className="text-zinc-400" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={() => onRead?.(source)}>
                                                        <BookOpen className="mr-2 h-4 w-4" />
                                                        阅读
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        onClick={(e) => handleDelete(source, e)}
                                                        className="text-red-600 focus:text-red-600"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        删除
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                        <td 
                                            onClick={() => onRead?.(source)}
                                            className="px-4 py-3 text-zinc-400 font-mono text-center cursor-pointer"
                                        >{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-zinc-800">{source.title}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{source.author || "Unknown"}</div>
                                        </td>
                                        <td 
                                            onClick={() => onRead?.(source)}
                                            className="px-4 py-3 cursor-pointer"
                                        >
                                            <span className="px-1.5 py-0.5 border border-zinc-200 bg-zinc-50 rounded text-[9px] uppercase font-bold text-zinc-500">
                                                {source.type}
                                            </span>
                                        </td>
                                        <td 
                                            onClick={() => onRead?.(source)}
                                            className="px-4 py-3 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1 bg-zinc-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500 transition-all" 
                                                        style={{ width: `${source.progress}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-mono text-zinc-400 w-10 text-right">{source.progress}%</span>
                                            </div>
                                        </td>
                                        <td 
                                            onClick={() => onRead?.(source)}
                                            className="px-4 py-3 text-right font-mono text-zinc-500 cursor-pointer"
                                        >
                                            {source.noteIds?.length || 0}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 text-xs">
                                            {sources.length === 0 
                                                ? "No sources found. Click 'Add' to import your first source."
                                                : "No sources match your filters. Try adjusting your search or filters."
                                            }
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Source Dialog */}
            <CreateSourceDialog 
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onCreated={async () => {
                    setShowCreateDialog(false);
                    // 自动刷新数据
                    await loadSources();
                }}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, source: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>确认删除</DialogTitle>
                        <DialogDescription>
                            确定要删除文献 "{deleteConfirm.source?.title}" 吗？
                            <br />
                            <span className="text-xs text-zinc-500 mt-1 block">
                                此操作无法撤销，相关的笔记和高亮也会被删除。
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirm({ open: false, source: null })}
                        >
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

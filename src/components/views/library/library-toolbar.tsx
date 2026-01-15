/**
 * Library Toolbar Component - 搜索、过滤、排序工具栏
 */
import { BookOpen, Search, Import, Grid, List, Filter, X, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import type { SourceType } from "@/types";

type SortBy = 'updated' | 'created' | 'progress' | 'title';
type SortOrder = 'asc' | 'desc';

interface LibraryToolbarProps {
    // 视图模式
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;

    // 搜索
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // 过滤
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    typeFilter: SourceType | 'all';
    setTypeFilter: (type: SourceType | 'all') => void;
    tagFilter: string;
    setTagFilter: (tag: string) => void;
    allTags: string[];

    // 排序
    sortBy: SortBy;
    setSortBy: (sort: SortBy) => void;
    sortOrder: SortOrder;
    setSortOrder: (order: SortOrder) => void;

    // 统计
    stats: {
        total: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        avgProgress: number;
    };

    // 显示数量
    filteredCount: number;
    totalCount: number;

    // 操作
    onImportClick: () => void;
    onClearFilters: () => void;
}

export function LibraryToolbar({
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    showFilters,
    setShowFilters,
    typeFilter,
    setTypeFilter,
    tagFilter,
    setTagFilter,
    allTags,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    stats,
    filteredCount,
    totalCount,
    onImportClick,
    onClearFilters,
}: LibraryToolbarProps) {
    return (
        <div className="border-b border-zinc-200 bg-white shrink-0">
            {/* Main Toolbar */}
            <div className="h-10 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    <BookOpen size={14} className="text-zinc-500" />
                    Digital Bookshelf
                    {filteredCount !== totalCount && (
                        <span className="ml-2 text-[10px] font-normal text-zinc-400 normal-case">
                            ({filteredCount} / {totalCount})
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {/* View Mode Toggle */}
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

                    {/* Search */}
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

                    {/* Filters Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-1 px-2 rounded-sm text-xs transition-colors ${showFilters || typeFilter !== 'all' || tagFilter
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                            }`}
                        title="Filters"
                    >
                        <Filter size={12} className="inline mr-1" />
                        Filters
                    </button>

                    {/* Import Button */}
                    <button
                        onClick={onImportClick}
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
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="p-1 hover:bg-zinc-200 rounded-sm"
                            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                            {sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    </div>
                    {(typeFilter !== 'all' || tagFilter || searchQuery) && (
                        <button
                            onClick={onClearFilters}
                            className="ml-auto px-2 py-1 text-zinc-500 hover:text-zinc-700 text-xs flex items-center gap-1"
                        >
                            <X size={12} />
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* Stats Bar */}
            {totalCount > 0 && (
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
    );
}

export type { SortBy, SortOrder };

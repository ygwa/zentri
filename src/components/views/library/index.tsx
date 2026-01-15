import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "@/store";
import type { Source, SourceType } from "@/types";
import { CreateSourceDialog } from "@/components/create-source-dialog";
import { pickReadableFile } from "@/lib/file-picker";
import { parseBookMetadata, generatePlaceholderCover } from "@/lib/book-metadata";
import { useDebounce } from "@/hooks/use-debounce";
import { BookOpen, Trash2, MoreVertical, Search, Plus } from "lucide-react";
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

import { LibraryToolbar, type SortBy, type SortOrder } from "./library-toolbar";
import { SourceCard } from "./source-card";
import { ImportDropzone } from "./import-dropzone";

interface LibraryViewProps {
    onRead?: (source: Source) => void;
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
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

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

    // 加载数据
    useEffect(() => {
        const loadData = async () => {
            if (sources.length === 0 && !isLoading) {
                setIsLoading(true);
                setLoadError(null);
                try {
                    await loadSources();
                } catch (err) {
                    console.error("Failed to load sources:", err);
                    setLoadError(err instanceof Error ? err.message : "加载失败");
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadData();
    }, [sources.length, loadSources, isLoading]);

    // 处理文件导入
    const handleFileImport = useCallback(async (file: { path: string; name: string }) => {
        try {
            const ext = file.name.toLowerCase().split('.').pop();
            const type = ext === 'pdf' ? 'paper' : 'book';
            const nameWithoutExt = file.name.replace(/\.(epub|pdf)$/i, "");

            let title = nameWithoutExt;
            let author: string | undefined;
            let cover: string | undefined;

            try {
                const metadata = await parseBookMetadata(file.path);
                if (metadata.title) title = metadata.title;
                if (metadata.author) author = metadata.author;
                if (metadata.coverUrl) {
                    // 确保封面是 data URL 格式，如果是 blob URL 需要转换
                    if (metadata.coverUrl.startsWith('blob:')) {
                        try {
                            const response = await fetch(metadata.coverUrl);
                            const blob = await response.blob();
                            const reader = new FileReader();
                            cover = await new Promise<string>((resolve, reject) => {
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        } catch (blobErr) {
                            console.warn("Failed to convert blob URL to data URL:", blobErr);
                            cover = undefined;
                        }
                    } else {
                        cover = metadata.coverUrl;
                    }
                }
            } catch (err) {
                console.warn("Failed to parse metadata, using filename:", err);
            }

            // 确保始终有封面（使用占位符作为回退）
            if (!cover) {
                cover = generatePlaceholderCover(title, type as 'book' | 'paper');
            }

            // 保存文件到 assets/books 目录
            let finalUrl = file.path;
            try {
                const { saveBookFile } = await import("@/services/api/assets");
                const savedPath = await saveBookFile(file.path, file.name);
                finalUrl = savedPath; // 使用保存后的相对路径
            } catch (err) {
                console.error("Failed to save book file:", err);
                // 如果保存失败，继续使用原始路径（降级方案）
            }

            await createSource({
                type: type as Source['type'],
                title,
                author,
                url: finalUrl,
                cover: cover, // 已经确保有值了
                tags: [],
                progress: 0,
            });
            await loadSources();
        } catch (err) {
            console.error("Failed to import file:", err);
        }
    }, [createSource, loadSources]);

    // 监听菜单事件：打开创建 Source 对话框和导入书籍
    useEffect(() => {
        const handleOpenCreateSourceDialog = () => {
            setShowCreateDialog(true);
        };

        const handleOpenImportBookDialog = async () => {
            // 直接触发文件选择并导入
            try {
                const file = await pickReadableFile();
                if (file) {
                    await handleFileImport(file);
                }
            } catch (err) {
                console.error("Failed to import book:", err);
            }
        };

        window.addEventListener('openCreateSourceDialog', handleOpenCreateSourceDialog);
        window.addEventListener('openImportBookDialog', handleOpenImportBookDialog);

        return () => {
            window.removeEventListener('openCreateSourceDialog', handleOpenCreateSourceDialog);
            window.removeEventListener('openImportBookDialog', handleOpenImportBookDialog);
        };
    }, [handleFileImport]);

    // 处理文件拖放
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            const ext = file.name.toLowerCase().split('.').pop();
            if (ext === 'epub' || ext === 'pdf') {
                const url = URL.createObjectURL(file);
                await handleFileImport({ path: url, name: file.name });
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

    const handleQuickImport = async () => {
        const result = await pickReadableFile();
        if (result) {
            await handleFileImport(result);
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

        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase();
            result = result.filter(source =>
                source.title.toLowerCase().includes(query) ||
                source.author?.toLowerCase().includes(query) ||
                source.description?.toLowerCase().includes(query) ||
                source.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        if (typeFilter !== 'all') {
            result = result.filter(s => s.type === typeFilter);
        }

        if (tagFilter) {
            result = result.filter(s => s.tags.includes(tagFilter));
        }

        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'title': comparison = a.title.localeCompare(b.title); break;
                case 'progress': comparison = a.progress - b.progress; break;
                case 'created': comparison = a.createdAt - b.createdAt; break;
                case 'updated':
                default: comparison = a.updatedAt - b.updatedAt; break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [sources, debouncedSearchQuery, typeFilter, tagFilter, sortBy, sortOrder]);

    // 统计信息
    const stats = useMemo(() => {
        const total = sources.length;
        const avgProgress = total > 0
            ? Math.round(sources.reduce((sum, s) => sum + s.progress, 0) / total)
            : 0;
        const completed = sources.filter(s => s.progress === 100).length;
        const inProgress = sources.filter(s => s.progress > 0 && s.progress < 100).length;
        const notStarted = sources.filter(s => s.progress === 0).length;

        return { total, avgProgress, completed, inProgress, notStarted };
    }, [sources]);

    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setTypeFilter('all');
        setTagFilter('');
        setSortBy('updated');
        setSortOrder('desc');
    }, []);

    const handleDelete = useCallback((source: Source, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDeleteConfirm({ open: true, source });
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteConfirm.source) return;
        try {
            await deleteSource(deleteConfirm.source.id);
            setDeleteConfirm({ open: false, source: null });
            await loadSources();
        } catch (err) {
            console.error("Failed to delete source:", err);
        }
    }, [deleteConfirm.source, deleteSource, loadSources]);

    const handleSort = useCallback((newSortBy: SortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('desc');
        }
    }, [sortBy]);

    return (
        <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in duration-300">
            {/* Toolbar */}
            <LibraryToolbar
                viewMode={viewMode}
                setViewMode={setViewMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                tagFilter={tagFilter}
                setTagFilter={setTagFilter}
                allTags={allTags}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                stats={stats}
                filteredCount={processedSources.length}
                totalCount={sources.length}
                onImportClick={() => setShowCreateDialog(true)}
                onClearFilters={clearFilters}
            />

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[#f8f9fa] p-6">
                {/* Loading State */}
                {isLoading && sources.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-sm text-zinc-500">正在加载书籍...</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {loadError && sources.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center max-w-md">
                            <div className="text-red-500 mb-4">
                                <BookOpen size={48} className="mx-auto opacity-50" />
                            </div>
                            <p className="text-sm font-medium text-zinc-800 mb-2">加载失败</p>
                            <p className="text-xs text-zinc-500 mb-4">{loadError}</p>
                            <button
                                onClick={async () => {
                                    setIsLoading(true);
                                    setLoadError(null);
                                    try {
                                        await loadSources();
                                    } catch (err) {
                                        setLoadError(err instanceof Error ? err.message : "加载失败");
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-sm hover:bg-blue-700 transition-colors"
                            >
                                重试
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                {!isLoading && !loadError && (
                    <>
                        {/* Import Drop Zone */}
                        <ImportDropzone
                            isDragging={isDragging}
                            showDropZone={showDropZone}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onQuickImport={handleQuickImport}
                            onToggleDropZone={() => setShowDropZone(true)}
                        />

                        {/* Grid View */}
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {processedSources.length > 0 ? processedSources.map(source => (
                                    <SourceCard
                                        key={source.id}
                                        source={source}
                                        onRead={(s) => onRead?.(s)}
                                        onDelete={handleDelete}
                                    />
                                )) : (
                                    <div className="col-span-full text-center py-16">
                                        {sources.length === 0 ? (
                                            <>
                                                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <BookOpen size={32} className="text-zinc-400" />
                                                </div>
                                                <h3 className="text-base font-medium text-zinc-700 mb-2">书架是空的</h3>
                                                <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
                                                    开始构建你的知识库，导入第一本书或文档
                                                </p>
                                                <button
                                                    onClick={handleQuickImport}
                                                    className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                                                >
                                                    <Plus size={16} />
                                                    导入第一本书
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Search size={24} className="text-zinc-400" />
                                                </div>
                                                <h3 className="text-base font-medium text-zinc-700 mb-2">没有匹配的结果</h3>
                                                <p className="text-sm text-zinc-500">
                                                    尝试调整搜索条件或过滤器
                                                </p>
                                            </>
                                        )}
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
                    </>
                )}
            </div>

            {/* Dialogs */}
            <CreateSourceDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onCreated={async () => {
                    setShowCreateDialog(false);
                    await loadSources();
                }}
            />

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

// Re-export subcomponents for direct use if needed
export { SourceCard } from "./source-card";
export { LibraryToolbar } from "./library-toolbar";
export { ImportDropzone } from "./import-dropzone";

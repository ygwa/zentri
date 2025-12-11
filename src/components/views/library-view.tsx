import { useState, useEffect, useRef } from "react";
import { BookOpen, Search, Import, Grid, List, UploadCloud, Highlighter } from "lucide-react";
import { useAppStore } from "@/store";
import type { Source } from "@/types";
import { CreateSourceDialog } from "@/components/create-source-dialog";
import { pickReadableFile } from "@/lib/file-picker";

interface LibraryViewProps {
    onRead?: (source: Source) => void;
}

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
    const { sources, loadSources, createSource } = useAppStore();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dropZoneRef = useRef<HTMLDivElement>(null);

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

    // 处理文件导入
    const handleFileImport = async (file: { path: string; name: string }) => {
        try {
            // 根据文件类型创建source
            const ext = file.name.toLowerCase().split('.').pop();
            const type = ext === 'pdf' ? 'paper' : 'book';
            
            const nameWithoutExt = file.name.replace(/\.(epub|pdf)$/i, "");
            
            await createSource({
                type: type as Source['type'],
                title: nameWithoutExt,
                author: undefined,
                url: file.path,
                tags: [],
                progress: 0,
            });
        } catch (err) {
            console.error("Failed to import file:", err);
        }
    };

    // 处理Import按钮点击
    const handleImportClick = async () => {
        const result = await pickReadableFile();
        if (result) {
            await handleFileImport(result);
        } else {
            // 如果没有选择文件，打开创建对话框
            setShowCreateDialog(true);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="h-10 border-b border-zinc-200 flex items-center px-4 justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    <BookOpen size={14} className="text-zinc-500" /> 
                    Digital Bookshelf
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
                            placeholder="Filter..." 
                            className="pl-7 pr-3 py-1 bg-zinc-50 border border-zinc-200 rounded-sm text-xs w-48 focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-zinc-400" 
                        />
                        <Search size={12} className="absolute left-2 top-1.5 text-zinc-400" />
                    </div>
                    <button 
                        onClick={handleImportClick}
                        className="flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium transition-all active:translate-y-px"
                    >
                        <Import size={12} /> <span className="font-medium">Import</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[#f8f9fa] p-6">
                {/* Import Drop Zone */}
                <div 
                    ref={dropZoneRef}
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
                        {isDragging ? 'Drop files here to import' : 'Drag & Drop PDF, EPUB, or HTML files here to add to shelf'}
                    </span>
                </div>

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {sources.length > 0 ? sources.map(source => {
                            const coverColor = getCoverColor(source.type);
                            const highlights = source.noteIds?.length || 0;
                            const added = formatTimeAgo(source.createdAt);
                            
                            return (
                                <div 
                                    key={source.id} 
                                    onClick={() => onRead?.(source)} 
                                    className="group flex flex-col gap-2 cursor-pointer"
                                >
                                    {/* Book Cover */}
                                    <div className={`aspect-[3/4] rounded-sm shadow-sm relative overflow-hidden border border-zinc-200 transition-all group-hover:shadow-md group-hover:-translate-y-1 ${coverColor} flex flex-col p-4 justify-between`}>
                                        <div className="text-white/90 font-bold font-serif text-lg leading-tight drop-shadow-md">
                                            {source.title}
                                        </div>
                                        
                                        {/* Type Badge */}
                                        <div className="absolute top-2 right-2">
                                            {source.type === 'book' && (
                                                <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">PDF</div>
                                            )}
                                            {source.type === 'article' && (
                                                <div className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">EPUB</div>
                                            )}
                                            {source.type === 'webpage' && (
                                                <div className="bg-zinc-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">WEB</div>
                                            )}
                                            {source.type === 'paper' && (
                                                <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">PDF</div>
                                            )}
                                        </div>

                                        <div className="text-white/70 text-xs font-medium drop-shadow-md">
                                            {source.author || 'Unknown'}
                                        </div>
                                        
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button className="bg-white text-zinc-900 px-3 py-1.5 rounded-sm text-xs font-bold shadow-lg flex items-center gap-2">
                                                <BookOpen size={14} /> Read
                                            </button>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
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
                            );
                        }) : (
                            <div className="col-span-full text-center py-12 text-zinc-400 text-sm">
                                No books in your shelf yet. Import some files to get started.
                            </div>
                        )}
                    </div>
                ) : (
                    /* List View */
                    <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-[10px] text-zinc-500 uppercase font-bold border-b border-zinc-200 tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 font-bold w-12 text-center">#</th>
                                    <th className="px-4 py-2 font-bold">Title & Author</th>
                                    <th className="px-4 py-2 font-bold w-32">Type</th>
                                    <th className="px-4 py-2 font-bold w-24">Progress</th>
                                    <th className="px-4 py-2 font-bold w-16 text-right">Highlights</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {sources.length > 0 ? sources.map((source, i) => (
                                    <tr 
                                        key={source.id} 
                                        onClick={() => onRead?.(source)}
                                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer text-xs"
                                    >
                                        <td className="px-4 py-3 text-zinc-400 font-mono text-center">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-zinc-800">{source.title}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{source.author || "Unknown"}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-1.5 py-0.5 border border-zinc-200 bg-zinc-50 rounded text-[9px] uppercase font-bold text-zinc-500">
                                                {source.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
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
                                        <td className="px-4 py-3 text-right font-mono text-zinc-500">
                                            {source.noteIds?.length || 0}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-xs">
                                            No sources found.
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
                onCreated={() => {
                    setShowCreateDialog(false);
                    loadSources();
                }}
            />
        </div>
    );
}

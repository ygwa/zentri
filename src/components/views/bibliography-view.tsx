
import { useState, useMemo } from "react";
import { useAppStore } from "@/store";
import { Search, Plus, MoreHorizontal, Pencil, Trash2, X, BookOpen, FileText, Globe, Video, Mic, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Source, SourceType } from "@/types";

// 类型图标映射
const typeIcons: Record<SourceType, React.ElementType> = {
    book: BookOpen,
    paper: GraduationCap,
    article: FileText,
    webpage: Globe,
    video: Video,
    podcast: Mic,
};

// 解析年份
function parseYear(dateStr?: string): string {
    if (!dateStr) return "—";
    const match = dateStr.match(/\d{4}/);
    return match ? match[0] : "—";
}

// 获取阅读状态
function getReadingStatus(progress: number): { label: string; color: string } {
    if (progress === 0) return { label: "未读", color: "bg-gray-400" };
    if (progress >= 100) return { label: "已完成", color: "bg-blue-500" };
    return { label: "阅读中", color: "bg-emerald-500" };
}

// 添加/编辑文献源对话框
function SourceDialog({
    open,
    onOpenChange,
    source,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source?: Source;
    onSave: (data: Partial<Source>) => void;
}) {
    const isEdit = !!source;
    const [formData, setFormData] = useState({
        type: source?.type || "book" as SourceType,
        title: source?.title || "",
        author: source?.author || "",
        url: source?.url || "",
        description: source?.description || "",
        tags: source?.tags?.join(", ") || "",
    });

    const handleSubmit = () => {
        if (!formData.title.trim()) return;
        onSave({
            type: formData.type,
            title: formData.title.trim(),
            author: formData.author.trim() || undefined,
            url: formData.url.trim() || undefined,
            description: formData.description.trim() || undefined,
            tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑文献源" : "添加文献源"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* 类型选择 */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">类型</label>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(typeIcons) as SourceType[]).map((type) => {
                                const Icon = typeIcons[type];
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type }))}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${formData.type === type
                                                ? "border-[#18181b] bg-[#18181b] text-white"
                                                : "border-[#e4e4e7] hover:border-[#a1a1aa]"
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span className="capitalize">{type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 标题 */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">标题 *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]"
                            placeholder="输入文献标题"
                        />
                    </div>

                    {/* 作者 */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">作者</label>
                        <input
                            type="text"
                            value={formData.author}
                            onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]"
                            placeholder="输入作者姓名"
                        />
                    </div>

                    {/* URL */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">链接 / 路径</label>
                        <input
                            type="text"
                            value={formData.url}
                            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]"
                            placeholder="https://... 或本地文件路径"
                        />
                    </div>

                    {/* 标签 */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">标签</label>
                        <input
                            type="text"
                            value={formData.tags}
                            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]"
                            placeholder="用逗号分隔多个标签"
                        />
                    </div>

                    {/* 描述 */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">描述</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b] min-h-[80px] resize-none"
                            placeholder="简短描述这个文献"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleSubmit} disabled={!formData.title.trim()}>
                        {isEdit ? "保存" : "添加"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function BibliographyView() {
    const { sources, createSource, updateSource, deleteSource } = useAppStore();
    const [filterText, setFilterText] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<Source | undefined>();
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // 过滤后的列表
    const filteredSources = useMemo(() => {
        if (!filterText.trim()) return sources;
        const query = filterText.toLowerCase();
        return sources.filter(
            (s) =>
                s.title.toLowerCase().includes(query) ||
                s.author?.toLowerCase().includes(query) ||
                s.tags.some((t) => t.toLowerCase().includes(query))
        );
    }, [sources, filterText]);

    // 添加新文献源
    const handleAdd = async (data: Partial<Source>) => {
        await createSource({
            type: data.type || "book",
            title: data.title || "",
            author: data.author,
            url: data.url,
            description: data.description,
            tags: data.tags || [],
            progress: 0,
        });
    };

    // 编辑文献源
    const handleEdit = async (data: Partial<Source>) => {
        if (!editingSource) return;
        await updateSource(editingSource.id, data);
        setEditingSource(undefined);
    };

    // 删除文献源
    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        await deleteSource(deleteConfirmId);
        setDeleteConfirmId(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white">
            {/* 头部 */}
            <div className="h-14 border-b border-[#f4f4f5] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="font-bold text-sm text-[#3f3f46] uppercase tracking-wide">Bibliography</h2>
                    <span className="text-xs text-[#a1a1aa]">{sources.length} sources</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#a1a1aa]" />
                        <input
                            className="w-64 bg-[#f4f4f5] border-transparent rounded-md pl-9 pr-8 py-1.5 text-sm focus:bg-white focus:border-[#e4e4e7] focus:ring-0 transition-all"
                            placeholder="Filter by title, author, or tag..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                        {filterText && (
                            <button
                                onClick={() => setFilterText("")}
                                className="absolute right-2.5 top-2.5 text-[#a1a1aa] hover:text-[#3f3f46]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <Button size="sm" className="bg-[#18181b] text-white" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                </div>
            </div>

            {/* 表格 */}
            <div className="flex-1 p-6 overflow-auto">
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#fcfcfc] text-[#71717a] font-medium border-b">
                            <tr>
                                <th className="px-4 py-3 w-16 text-center">#</th>
                                <th className="px-4 py-3">Title & Author</th>
                                <th className="px-4 py-3 w-32">Type</th>
                                <th className="px-4 py-3 w-24">Year</th>
                                <th className="px-4 py-3 w-32">Status</th>
                                <th className="px-4 py-3 w-20 text-center">Notes</th>
                                <th className="px-4 py-3 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f4f4f5]">
                            {filteredSources.length > 0 ? filteredSources.map((source, i) => {
                                const status = getReadingStatus(source.progress);
                                const TypeIcon = typeIcons[source.type] || FileText;
                                return (
                                    <tr
                                        key={source.id}
                                        className="hover:bg-[#fafafa] transition-colors group cursor-pointer"
                                        onClick={() => setEditingSource(source)}
                                    >
                                        <td className="px-4 py-4 text-center text-[#d4d4d8] font-mono group-hover:text-[#a1a1aa]">
                                            {i + 1}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-[#18181b]">{source.title}</div>
                                            <div className="text-xs text-[#a1a1aa] mt-0.5">
                                                {source.author || "Unknown Author"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2 py-0.5 rounded border border-[#e4e4e7] bg-white text-[10px] uppercase font-bold text-[#71717a] inline-flex items-center gap-1">
                                                <TypeIcon className="w-3 h-3" />
                                                {source.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-[#71717a] font-mono">
                                            {parseYear(source.metadata?.publishDate)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${status.color}`}></span>
                                                <span className="text-[#3f3f46]">{status.label}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[#71717a]">
                                            {source.noteIds?.length || 0}
                                        </td>
                                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setEditingSource(source)}>
                                                        <Pencil className="w-4 h-4 mr-2" /> 编辑
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600"
                                                        onClick={() => setDeleteConfirmId(source.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> 删除
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        {filterText ? "No matching sources found." : "No sources yet. Add your first book or paper."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 添加对话框 */}
            <SourceDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onSave={handleAdd}
            />

            {/* 编辑对话框 */}
            <SourceDialog
                open={!!editingSource}
                onOpenChange={(open) => !open && setEditingSource(undefined)}
                source={editingSource}
                onSave={handleEdit}
            />

            {/* 删除确认对话框 */}
            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除这个文献源吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

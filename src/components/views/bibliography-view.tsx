
import { useAppStore } from "@/store";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BibliographyView() {
    const { sources } = useAppStore();

    return (
        <div className="flex-1 flex flex-col h-full bg-white">
            <div className="h-14 border-b border-[#f4f4f5] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="font-bold text-sm text-[#3f3f46] uppercase tracking-wide">Bibliography</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#a1a1aa]" />
                        <input
                            className="w-64 bg-[#f4f4f5] border-transparent rounded-md pl-9 pr-3 py-1.5 text-sm focus:bg-white focus:border-[#e4e4e7] focus:ring-0 transition-all"
                            placeholder="Filter sources..."
                        />
                    </div>
                    <Button size="sm" className="bg-[#18181b] text-white">
                        <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-6">
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#fcfcfc] text-[#71717a] font-medium border-b">
                            <tr>
                                <th className="px-4 py-3 w-16 text-center">#</th>
                                <th className="px-4 py-3">Title & Author</th>
                                <th className="px-4 py-3 w-32">Type</th>
                                <th className="px-4 py-3 w-24">Year</th>
                                <th className="px-4 py-3 w-32">Status</th>
                                <th className="px-4 py-3 w-20 text-center">Cites</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f4f4f5]">
                            {sources.length > 0 ? sources.map((source, i) => (
                                <tr key={source.id} className="hover:bg-[#fafafa] transition-colors group">
                                    <td className="px-4 py-4 text-center text-[#d4d4d8] font-mono group-hover:text-[#a1a1aa]">{i + 1}</td>
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-[#18181b]">{source.title}</div>
                                        <div className="text-xs text-[#a1a1aa] mt-0.5">Unknown Author</div> {/* Author not on type yet */}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="px-2 py-0.5 rounded border border-[#e4e4e7] bg-white text-[10px] uppercase font-bold text-[#71717a]">
                                            {source.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-[#71717a] font-mono">2023</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            <span className="text-[#3f3f46]">Reading</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center text-[#71717a]">
                                        {/* Mock data for now */}
                                        Math.floor(Math.random() * 20)
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        No sources found. Add your first book or paper.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

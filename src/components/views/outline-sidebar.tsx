import { Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface OutlineSection {
    id: string;
    title: string;
    connectedCard?: string;
}

interface OutlineSidebarProps {
    sections: OutlineSection[];
    activeSectionId: string | null;
    onSelectSection: (id: string) => void;
    onAddSection: () => void;
    className?: string;
}

export function OutlineSidebar({
    sections,
    activeSectionId,
    onSelectSection,
    onAddSection,
    className
}: OutlineSidebarProps) {
    return (
        <div className={cn("flex flex-col bg-zinc-50 border-r border-zinc-200 h-full", className)}>
            <div className="h-12 flex items-center px-4 font-bold text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-200 shrink-0">
                Outline
            </div>

            <div className="flex-1 overflow-y-auto py-2">
                {sections.length === 0 ? (
                    <div className="px-4 py-8 text-center text-zinc-400 text-xs">
                        No chapters yet. Start by adding one.
                    </div>
                ) : (
                    <div className="space-y-0.5 px-2">
                        {sections.map((section, index) => {
                            const isActive = section.id === activeSectionId;
                            return (
                                <div
                                    key={section.id}
                                    onClick={() => onSelectSection(section.id)}
                                    className={cn(
                                        "group flex items-center gap-2 px-2 py-2 rounded-sm cursor-pointer text-sm transition-colors",
                                        isActive
                                            ? "bg-white text-zinc-900 shadow-sm border border-zinc-200 font-medium"
                                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent"
                                    )}
                                >
                                    <span className="text-zinc-300 group-hover:text-zinc-400 cursor-grab active:cursor-grabbing">
                                        <GripVertical size={12} />
                                    </span>
                                    <span className="w-5 h-5 flex items-center justify-center rounded-sm bg-zinc-100 text-[10px] text-zinc-500 font-mono shrink-0">
                                        {index + 1}
                                    </span>
                                    <span className="truncate flex-1">
                                        {section.title || "Untitled Chapter"}
                                    </span>
                                    {isActive && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-zinc-200 bg-zinc-50/50">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-zinc-600 h-8 text-xs border-dashed"
                    onClick={onAddSection}
                >
                    <Plus size={14} className="mr-2" /> Add Chapter
                </Button>
            </div>
        </div>
    );
}

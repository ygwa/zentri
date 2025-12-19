import { useState } from "react";
import { GraphView } from "@/components/graph-view";
import { Plus, Maximize2, Filter, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function GraphViewFull() {
    const [showFilters, setShowFilters] = useState(false);
    const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);

    const toggleType = (type: string) => {
        setHiddenTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const cardTypes = [
        { id: 'fleeting', label: 'Fleeting', color: 'bg-amber-500' },
        { id: 'literature', label: 'Literature', color: 'bg-sky-500' },
        { id: 'permanent', label: 'Permanent', color: 'bg-emerald-500' },
        { id: 'project', label: 'Project', color: 'bg-purple-500' },
    ];

    return (
        <div className="flex-1 h-full bg-[#f4f4f5] relative overflow-hidden flex flex-col">
            {/* Graph Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-white border border-zinc-200 rounded-sm shadow-sm flex flex-col p-1">
                    <button className="p-1.5 hover:bg-zinc-100 rounded-sm text-zinc-600"><Plus size={16} /></button>
                    <div className="h-px bg-zinc-100 my-0.5"></div>
                    <button className="p-1.5 hover:bg-zinc-100 rounded-sm text-zinc-600"><Maximize2 size={16} /></button>
                </div>

                <div className="bg-white border border-zinc-200 rounded-sm shadow-sm flex flex-col p-1">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn("p-1.5 rounded-sm transition-colors", showFilters ? "bg-blue-50 text-blue-600" : "hover:bg-zinc-100 text-zinc-600")}
                    >
                        <Filter size={16} />
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="absolute top-0 left-12 bg-white border border-zinc-200 rounded-sm shadow-md p-3 w-48 animate-in fade-in slide-in-from-left-2 z-20">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Filter by Type</div>
                        <div className="space-y-1">
                            {cardTypes.map(type => {
                                const isVisible = !hiddenTypes.includes(type.id);
                                return (
                                    <div
                                        key={type.id}
                                        onClick={() => toggleType(type.id)}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 rounded-sm cursor-pointer text-xs"
                                    >
                                        <div className={cn("w-3 h-3 border rounded-sm flex items-center justify-center transition-colors", isVisible ? "bg-blue-500 border-blue-600" : "border-zinc-300")}>
                                            {isVisible && <Check size={8} className="text-white" />}
                                        </div>
                                        <div className={cn("w-2 h-2 rounded-full", type.color)}></div>
                                        <span className={cn(isVisible ? "text-zinc-700" : "text-zinc-400")}>{type.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Engineering Grid Background */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.05]"
                style={{
                    backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Main Graph */}
            <div className="flex-1 flex items-center justify-center cursor-move relative z-0">
                <GraphView filters={{ hiddenTypes }} />
            </div>

            {/* Graph Legend */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-zinc-200 p-2 rounded-sm shadow-sm text-[10px] z-10">
                <div className="flex gap-4">
                    {cardTypes.map(type => (
                        <div key={type.id} className="flex items-center gap-1.5">
                            <div className={cn("w-2 h-2 rounded-sm", type.color)}></div>
                            <span>{type.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

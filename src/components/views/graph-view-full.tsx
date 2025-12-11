import { GraphView } from "@/components/graph-view";
import { Plus, Maximize2 } from "lucide-react";

export function GraphViewFull() {
    return (
        <div className="flex-1 h-full bg-[#f4f4f5] relative overflow-hidden flex flex-col">
            {/* Graph Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-white border border-zinc-200 rounded-sm shadow-sm flex flex-col p-1">
                    <button className="p-1.5 hover:bg-zinc-100 rounded-sm text-zinc-600"><Plus size={16} /></button>
                    <div className="h-px bg-zinc-100 my-0.5"></div>
                    <button className="p-1.5 hover:bg-zinc-100 rounded-sm text-zinc-600"><Maximize2 size={16} /></button>
                </div>
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
                <GraphView />
            </div>
            
            {/* Graph Legend */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-zinc-200 p-2 rounded-sm shadow-sm text-[10px] z-10">
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 border border-blue-500 bg-blue-50 rounded-sm"></div>
                        <span>Concept</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 border border-rose-500 bg-rose-50 rounded-sm border-dashed"></div>
                        <span>Orphan</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

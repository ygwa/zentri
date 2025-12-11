import { useState, useEffect } from "react";
import {
    Layout,
    BookOpen,
    GitGraph,
    Settings,
    Plus,
    Search,
    Command,
    Repeat,
    Hash
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";

// Views
import { DashboardView } from "@/components/views/dashboard-view";
import { LibraryView } from "@/components/views/library-view";
import { GraphViewFull } from "@/components/views/graph-view-full";
import { ReaderView } from "@/components/views/reader-view";
import { ProjectEditorView } from "@/components/views/project-editor-view";
import { NoteEditorView } from "@/components/views/note-editor-view";
import { SettingsView } from "@/components/views/settings-view";
import { TagsView } from "@/components/views/tags-view";
import { ReviewView } from "@/components/views/review-view";

type ViewMode = "dashboard" | "library" | "graph" | "review" | "tags" | "settings";

export function MainLayout() {
    const [activeView, setActiveView] = useState<ViewMode>("dashboard");
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [readingSource, setReadingSource] = useState<string | null>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const { getSourceById } = useAppStore();

    // 键盘快捷键监听
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleOpenCard = (id: string) => {
        setEditingCardId(id);
    };

    const handleOpenProject = (id: string) => {
        setEditingProjectId(id);
        setActiveView("dashboard"); // 确保在dashboard视图
    };

    const handleReadSource = (source: { id: string }) => {
        setReadingSource(source.id);
    };

    const renderContent = () => {
        switch (activeView) {
            case "library":
                return <LibraryView onRead={handleReadSource} />;
            case "graph":
                return <GraphViewFull />;
            case "review":
                return <ReviewView />;
            case "tags":
                return <TagsView />;
            case "settings":
                return <SettingsView />;
            case "dashboard":
            default:
                return (
                    <DashboardView
                        onOpenCard={handleOpenCard}
                        onOpenProject={handleOpenProject}
                    />
                );
        }
    };

    return (
        <div className="flex flex-col h-screen w-screen bg-[#18181b] text-zinc-900 font-sans overflow-hidden">

            {/* Top Main Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Sidebar */}
                <aside className="w-14 h-full bg-[#111113] flex flex-col items-center py-4 border-r border-[#27272a] shrink-0 z-50 text-gray-400">
                    <div className="w-8 h-8 bg-blue-700 rounded-sm flex items-center justify-center text-white font-bold mb-6 cursor-pointer hover:bg-blue-600 transition-colors font-mono tracking-tighter" onClick={() => setActiveView("dashboard")}>
                        Z_
                    </div>
                    <div className="flex flex-col space-y-4 w-full items-center">
                        <NavIcon 
                            icon={Layout} 
                            active={activeView === "dashboard"} 
                            onClick={() => setActiveView("dashboard")} 
                            tooltip="工作台 (Cmd+1)" 
                        />
                        <NavIcon 
                            icon={BookOpen} 
                            active={activeView === "library"} 
                            onClick={() => setActiveView("library")} 
                            tooltip="书架 (Cmd+2)" 
                        />
                        <NavIcon
                            icon={GitGraph}
                            active={activeView === "graph"}
                            onClick={() => setActiveView("graph")}
                            tooltip="图谱 (Cmd+3)"
                        />
                        <NavIcon
                            icon={Repeat}
                            active={activeView === "review"}
                            onClick={() => setActiveView("review")}
                            tooltip="回顾 (Cmd+4)"
                        />
                        <NavIcon
                            icon={Hash}
                            active={activeView === "tags"}
                            onClick={() => setActiveView("tags")}
                            tooltip="标签 (Cmd+5)"
                        />
                    </div>
                    <div className="mt-auto flex flex-col space-y-4 w-full items-center pb-2">
                        <NavIcon
                            icon={Command}
                            onClick={() => setIsCommandPaletteOpen(true)}
                            tooltip="命令面板 (Cmd+K)"
                        />
                        <NavIcon 
                            icon={Settings} 
                            active={activeView === "settings"}
                            onClick={() => setActiveView("settings")}
                            tooltip="设置" 
                        />
                        <div className="w-6 h-6 rounded-sm bg-zinc-800 border border-zinc-700 text-[9px] flex items-center justify-center text-zinc-400 font-mono">JS</div>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                    {/* Header */}
                    <header className="h-10 bg-white border-b border-zinc-200 flex items-center px-4 justify-between shrink-0 select-none">
                        <div className="flex items-center space-x-2 text-xs">
                            <span className="font-bold text-zinc-800 tracking-tight">KNOWLEDGE_BASE</span>
                            <span className="text-zinc-300">/</span>
                            <span className="text-zinc-600 flex items-center gap-1 font-medium">
                                RUST_LEARNING
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div
                                onClick={() => setIsCommandPaletteOpen(true)}
                                className="flex items-center px-2 py-1 bg-zinc-50 rounded-sm border border-zinc-200 w-64 group focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all cursor-pointer hover:bg-zinc-100 text-zinc-500"
                            >
                                <Search size={12} className="mr-2" />
                                <span className="bg-transparent border-none text-xs flex-1 placeholder-zinc-400 font-medium select-none">
                                    Search knowledge graph...
                                </span>
                                <span className="text-[9px] text-zinc-400 border border-zinc-300 rounded-sm px-1 font-mono bg-zinc-100 flex items-center">
                                    <Command size={8} className="mr-0.5" />K
                                </span>
                            </div>
                            <button className="flex items-center gap-1 px-2 py-1 bg-zinc-900 text-white rounded-sm text-xs hover:bg-zinc-800 shadow-sm border border-zinc-900 font-medium transition-all active:translate-y-px">
                                <Plus size={12} /> <span className="font-medium">New Node</span>
                            </button>
                        </div>
                    </header>

                    {/* Viewport */}
                    <div className="flex-1 overflow-hidden relative bg-[#f8f9fa]">
                        {renderContent()}
                    </div>

                    {/* Project Editor Overlay */}
                    {editingProjectId && (
                        <ProjectEditorView 
                            projectId={editingProjectId} 
                            onClose={() => setEditingProjectId(null)} 
                        />
                    )}

                    {/* Note Editor Overlay (for permanent/literature notes) */}
                    {editingCardId && (
                        <NoteEditorView 
                            cardId={editingCardId} 
                            onClose={() => setEditingCardId(null)}
                            onNavigate={handleOpenCard}
                        />
                    )}

                    {/* Reader Overlay */}
                    {readingSource && (() => {
                        const source = getSourceById(readingSource);
                        return source ? (
                            <ReaderView
                                source={source}
                                onClose={() => setReadingSource(null)}
                            />
                        ) : null;
                    })()}

                    {/* Command Palette Overlay */}
                    <CommandPalette
                        isOpen={isCommandPaletteOpen}
                        onClose={() => setIsCommandPaletteOpen(false)}
                        onViewChange={(view) => setActiveView(view as ViewMode)}
                    />
                </div>
            </div>

            {/* Hardcore Status Bar */}
            <div className="h-5 bg-[#007acc] text-white flex items-center justify-between px-3 text-[9px] font-mono shrink-0 select-none cursor-default">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1"><GitGraph size={8} /> main*</span>
                    <span>SYNC: OK</span>
                </div>
                <div className="flex gap-4">
                    <span>UTF-8</span>
                    <span>Ln 12, Col 84</span>
                </div>
            </div>
        </div>
    );
}

function NavIcon({ icon: Icon, active, onClick, tooltip }: { icon: any, active?: boolean, onClick?: () => void, tooltip?: string }) {
    return (
        <button 
            onClick={onClick}
            title={tooltip}
            className={cn(
                "p-2 rounded-sm transition-all relative group w-full flex items-center justify-center",
                active 
                    ? 'bg-white/10 text-white border-l-2 border-blue-500' 
                    : 'hover:text-zinc-100 hover:bg-white/5 border-l-2 border-transparent'
            )}
        >
            <Icon size={18} />
        </button>
    );
}

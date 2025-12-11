import { useState } from "react";
import { Settings, Monitor, Edit3, GitGraph, UploadCloud, Download, Import } from "lucide-react";

export function SettingsView() {
    const tabs = [
        { id: 'general', icon: Monitor, label: 'General' },
        { id: 'editor', icon: Edit3, label: 'Editor' },
        { id: 'graph', icon: GitGraph, label: 'Knowledge Graph' },
        { id: 'sync', icon: UploadCloud, label: 'Sync & Backup' }
    ];
    
    const [activeTab, setActiveTab] = useState('general');

    return (
        <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in duration-200">
            {/* Header */}
            <div className="h-12 border-b border-zinc-200 flex items-center px-6 shrink-0">
                <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
                    <Settings size={14} className="text-zinc-500" /> Settings
                </h2>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-56 bg-zinc-50 border-r border-zinc-200 py-4 flex flex-col gap-1 px-2">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-white border border-zinc-200 text-zinc-900 shadow-sm'
                                        : 'text-zinc-500 hover:bg-zinc-100'
                                }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            <section>
                                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">
                                    Appearance
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-medium text-zinc-800">Theme Mode</div>
                                            <div className="text-[10px] text-zinc-500">
                                                Choose your preferred visual theme
                                            </div>
                                        </div>
                                        <div className="flex bg-zinc-100 rounded-sm p-0.5 border border-zinc-200">
                                            <button className="px-3 py-1 bg-white border border-zinc-200 shadow-sm rounded-sm text-[10px] font-bold">
                                                Light
                                            </button>
                                            <button className="px-3 py-1 text-zinc-500 hover:text-zinc-900 text-[10px] font-medium">
                                                Dark
                                            </button>
                                            <button className="px-3 py-1 text-zinc-500 hover:text-zinc-900 text-[10px] font-medium">
                                                Auto
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">
                                    Localization
                                </h3>
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-medium text-zinc-800">Language</div>
                                    <select className="text-xs border border-zinc-300 rounded-sm bg-white px-2 py-1">
                                        <option>English</option>
                                        <option>简体中文</option>
                                        <option>日本語</option>
                                    </select>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'editor' && (
                        <div className="space-y-8">
                            <section>
                                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">
                                    Typography
                                </h3>
                                <div className="grid gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-medium text-zinc-800">
                                            Font Family (Monospace)
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue="JetBrains Mono, Menlo, Courier New"
                                            className="w-full text-xs border border-zinc-300 rounded-sm p-2 font-mono text-zinc-600 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-medium text-zinc-800">Line Numbers</div>
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="rounded-sm border-zinc-300 text-blue-600 focus:ring-0"
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'sync' && (
                        <div className="space-y-8">
                            <section>
                                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">
                                    Cloud Sync
                                </h3>
                                <div className="bg-blue-50 border border-blue-100 rounded-sm p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                            <UploadCloud size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-blue-900">Zentri Cloud Sync</div>
                                            <div className="text-[10px] text-blue-700">Last synced: 2 minutes ago</div>
                                        </div>
                                    </div>
                                    <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-sm hover:bg-blue-700">
                                        Sync Now
                                    </button>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">
                                    Local Backup
                                </h3>
                                <div className="flex items-center gap-4">
                                    <button className="flex items-center gap-2 px-3 py-2 border border-zinc-300 rounded-sm text-xs font-medium hover:bg-zinc-50">
                                        <Download size={14} /> Export All (.zip)
                                    </button>
                                    <button className="flex items-center gap-2 px-3 py-2 border border-zinc-300 rounded-sm text-xs font-medium hover:bg-zinc-50">
                                        <Import size={14} /> Import Data
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'graph' && (
                        <div className="space-y-8">
                            <section>
                                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">
                                    Graph Visualization
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-medium text-zinc-800">Node Size</div>
                                            <div className="text-[10px] text-zinc-500">
                                                Adjust the size of nodes in the graph
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            defaultValue="5"
                                            className="w-32"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-medium text-zinc-800">Link Distance</div>
                                            <div className="text-[10px] text-zinc-500">
                                                Control the spacing between connected nodes
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="50"
                                            max="300"
                                            defaultValue="150"
                                            className="w-32"
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


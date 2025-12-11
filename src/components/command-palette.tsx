import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Layout, BookOpen, GitGraph, Settings, Repeat, Hash,
  Command, FolderKanban, Sparkles, Monitor
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action?: () => void;
  category?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: string) => void;
}

export function CommandPalette({ isOpen, onClose, onViewChange }: CommandPaletteProps) {
  const { createCard, selectCard } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = [
    // 导航命令
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: Layout, shortcut: 'G D', category: 'Navigation', action: () => onViewChange('dashboard') },
    { id: 'nav-library', label: 'Open Library', icon: BookOpen, shortcut: 'G L', category: 'Navigation', action: () => onViewChange('library') },
    { id: 'nav-graph', label: 'Open Knowledge Graph', icon: GitGraph, shortcut: 'G G', category: 'Navigation', action: () => onViewChange('graph') },
    { id: 'nav-review', label: 'Start Daily Review', icon: Repeat, shortcut: 'G R', category: 'Navigation', action: () => onViewChange('review') },
    { id: 'nav-tags', label: 'Browse Tags', icon: Hash, shortcut: 'G T', category: 'Navigation', action: () => onViewChange('tags') },
    { id: 'nav-settings', label: 'Open Settings', icon: Settings, shortcut: 'G S', category: 'Navigation', action: () => onViewChange('settings') },

    // 创建命令
    { id: 'create-note', label: 'Create New Note', icon: Plus, shortcut: 'N', category: 'Create', action: async () => {
      const card = await createCard('permanent', 'Untitled Note');
      if (card) selectCard(card.id);
      onClose();
    }},
    { id: 'create-fleeting', label: 'Create Fleeting Note', icon: Sparkles, shortcut: 'F', category: 'Create', action: async () => {
      const card = await createCard('fleeting', 'Quick Note');
      if (card) selectCard(card.id);
      onClose();
    }},
    { id: 'create-literature', label: 'Create Literature Note', icon: BookOpen, shortcut: 'L', category: 'Create', action: async () => {
      const card = await createCard('literature', 'Literature Note');
      if (card) selectCard(card.id);
      onClose();
    }},
    { id: 'create-project', label: 'Create Project', icon: FolderKanban, shortcut: 'P', category: 'Create', action: async () => {
      const card = await createCard('project', 'New Project');
      if (card) selectCard(card.id);
      onClose();
    }},

    // 系统命令
    { id: 'theme-toggle', label: 'Toggle Dark Mode', icon: Monitor, shortcut: 'Cmd+Shift+L', category: 'System' },
    { id: 'command-palette', label: 'Show Command Palette', icon: Command, shortcut: 'Cmd+K', category: 'System', action: () => {} },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          const cmd = filteredCommands[selectedIndex];
          if (cmd.action) cmd.action();
          onClose();
          setSearch('');
        }
        break;
      case 'Escape':
        onClose();
        setSearch('');
        break;
    }
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const categoryGroups = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-[20vh] animate-in fade-in duration-100">
      <div className="bg-white w-[600px] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100 ring-1 ring-zinc-900/10">
        {/* 搜索输入 */}
        <div className="h-14 border-b border-zinc-100 flex items-center px-4 gap-3">
          <Search size={18} className="text-zinc-400" />
          <input
            autoFocus
            placeholder="Type a command or search..."
            className="flex-1 h-full text-lg outline-none placeholder-zinc-300 text-zinc-800 bg-transparent"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="text-[10px] font-bold text-zinc-300 bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded-sm">ESC</div>
        </div>

        {/* 命令列表 */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {Object.entries(categoryGroups).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {category}
              </div>
              {cmds.map((cmd) => {
                const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                const isSelected = globalIndex === selectedIndex;
                const Icon = cmd.icon;
                return (
                  <div
                    key={cmd.id}
                    onClick={() => {
                      if (cmd.action) cmd.action();
                      onClose();
                      setSearch('');
                    }}
                    className={cn(
                      "px-4 py-2.5 flex items-center justify-between cursor-pointer group",
                      isSelected ? "bg-blue-50" : "hover:bg-zinc-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-1 rounded-sm",
                        isSelected ? "text-blue-600" : "text-zinc-400 group-hover:text-zinc-600"
                      )}>
                        <Icon size={14} />
                      </div>
                      <span className={cn(
                        "text-sm",
                        isSelected ? "text-blue-900 font-medium" : "text-zinc-700"
                      )}>{cmd.label}</span>
                    </div>
                    {cmd.shortcut && (
                      <span className="text-[10px] font-mono text-zinc-400">{cmd.shortcut}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground bg-zinc-50">
          <div className="flex gap-4">
            <span><kbd className="rounded border px-1">↑</kbd> <kbd className="rounded border px-1">↓</kbd> Navigate</span>
            <span><kbd className="rounded border px-1">Enter</kbd> Select</span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>

      {/* 点击关闭 */}
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
  );
}

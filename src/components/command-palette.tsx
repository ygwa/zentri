import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Plus, Layout, BookOpen, GitGraph, Settings, Repeat, Hash,
  Command, FolderKanban, Sparkles, Monitor, FileText, Loader2
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import * as api from "@/services/api";
import type { SearchResult } from "@/services/api/types";

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
  onOpenCard?: (id: string) => void;
}

export function CommandPalette({ isOpen, onClose, onViewChange, onOpenCard }: CommandPaletteProps) {
  const { createCard, selectCard } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'commands' | 'cards'>('commands');

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

  // 判断是否应该进入搜索模式 (输入超过2个字符且不是命令关键词)
  const shouldSearch = useMemo(() => {
    if (search.length < 2) return false;
    const commandKeywords = ['go', 'open', 'create', 'new', 'toggle', 'show'];
    const searchLower = search.toLowerCase();
    return !commandKeywords.some(kw => searchLower.startsWith(kw));
  }, [search]);

  // 搜索卡片
  useEffect(() => {
    if (!isOpen || !shouldSearch) {
      setSearchResults([]);
      setSearchMode('commands');
      return;
    }

    const searchCards = async () => {
      setIsSearching(true);
      setSearchMode('cards');
      try {
        const results = await api.search.search(search);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchCards, 200);
    return () => clearTimeout(debounceTimer);
  }, [search, isOpen, shouldSearch]);

  // 合并后的项目列表
  const totalItems = searchMode === 'cards' && searchResults.length > 0 
    ? searchResults.length 
    : filteredCommands.length;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (searchMode === 'cards' && searchResults[selectedIndex]) {
          const result = searchResults[selectedIndex];
          if (onOpenCard) {
            onOpenCard(result.id);
          } else {
            selectCard(result.id);
          }
          onClose();
          setSearch('');
        } else if (filteredCommands[selectedIndex]) {
          const cmd = filteredCommands[selectedIndex];
          if (cmd.action) cmd.action();
          onClose();
          setSearch('');
        }
        break;
      case 'Escape':
        onClose();
        setSearch('');
        setSearchResults([]);
        setSearchMode('commands');
        break;
    }
  }, [isOpen, selectedIndex, filteredCommands, searchResults, searchMode, onClose, onOpenCard, selectCard, totalItems]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [search, searchMode]);

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

        {/* 命令/搜索结果列表 */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {/* 搜索中状态 */}
          {isSearching && (
            <div className="flex items-center justify-center py-6 text-zinc-400">
              <Loader2 size={16} className="animate-spin mr-2" />
              <span className="text-sm">搜索中...</span>
            </div>
          )}

          {/* 卡片搜索结果 */}
          {!isSearching && searchMode === 'cards' && searchResults.length > 0 && (
            <>
              <div className="px-4 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <FileText size={10} />
                搜索结果 ({searchResults.length})
              </div>
              {searchResults.map((result, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={result.id}
                    onClick={() => {
                      if (onOpenCard) {
                        onOpenCard(result.id);
                      } else {
                        selectCard(result.id);
                      }
                      onClose();
                      setSearch('');
                    }}
                    className={cn(
                      "px-4 py-2.5 cursor-pointer group",
                      isSelected ? "bg-blue-50" : "hover:bg-zinc-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-1 rounded-sm shrink-0",
                        isSelected ? "text-blue-600" : "text-zinc-400"
                      )}>
                        <FileText size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm truncate",
                          isSelected ? "text-blue-900 font-medium" : "text-zinc-700"
                        )}>
                          {result.title || 'Untitled'}
                        </div>
                        {result.snippet && (
                          <div 
                            className="text-xs text-zinc-400 truncate mt-0.5"
                            dangerouslySetInnerHTML={{ 
                              __html: result.snippet.replace(/<mark>/g, '<span class="bg-yellow-200 text-yellow-900 rounded px-0.5">').replace(/<\/mark>/g, '</span>')
                            }}
                          />
                        )}
                      </div>
                      <div className="shrink-0 flex gap-1">
                        {result.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[9px] text-zinc-500 bg-zinc-100 px-1 rounded">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* 命令列表 (当没有搜索结果或未搜索时) */}
          {!isSearching && (searchMode === 'commands' || searchResults.length === 0) && (
            <>
              {Object.entries(categoryGroups).map(([category, cmds]) => (
                <div key={category}>
                  <div className="px-4 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {cmds.map((cmd) => {
                    const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                    const isSelected = globalIndex === selectedIndex && searchMode === 'commands';
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

              {filteredCommands.length === 0 && !shouldSearch && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  未找到命令
                </div>
              )}

              {shouldSearch && searchResults.length === 0 && !isSearching && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  未找到匹配的卡片
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground bg-zinc-50">
          <div className="flex gap-4">
            <span><kbd className="rounded border px-1">↑</kbd> <kbd className="rounded border px-1">↓</kbd> 导航</span>
            <span><kbd className="rounded border px-1">Enter</kbd> 选择</span>
          </div>
          <div className="flex items-center gap-2">
            {searchMode === 'cards' ? (
              <span className="text-blue-600">{searchResults.length} 个卡片</span>
            ) : (
              <span>{filteredCommands.length} 个命令</span>
            )}
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-400">输入关键词搜索卡片</span>
          </div>
        </div>
      </div>

      {/* 点击关闭 */}
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
  );
}

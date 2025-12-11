import { useState, useMemo } from "react";
import { Hash, Activity, TrendingUp, MoreHorizontal, Pencil, Trash2, Filter, ArrowLeft, FileText, Book, Lightbulb, FolderKanban } from "lucide-react";
import { useAppStore } from "@/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


export function TagsView() {
  const { cards, renameTag, deleteTag, setCurrentView, setSearchQuery, selectCard } = useAppStore();
  const [editingTag, setEditingTag] = useState<{ oldName: string; newName: string } | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tagStats = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const tagTypes: Record<string, Set<string>> = {};
    const tagHealth: Record<string, { healthy: number; orphan: number; hub: number }> = {};

    cards.forEach(card => {
      card.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;

        if (!tagTypes[tag]) {
          tagTypes[tag] = new Set();
        }
        tagTypes[tag].add(card.type);

        if (!tagHealth[tag]) {
          tagHealth[tag] = { healthy: 0, orphan: 0, hub: 0 };
        }

        const linksCount = card.links?.length || 0;
        if (linksCount > 5) {
          tagHealth[tag].hub++;
        } else if (linksCount === 0) {
          tagHealth[tag].orphan++;
        } else {
          tagHealth[tag].healthy++;
        }
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => {
        const types = Array.from(tagTypes[tag]);
        const health = tagHealth[tag];
        const totalHealth = health.healthy + health.orphan + health.hub;
        const healthScore = totalHealth > 0 ? (health.healthy + health.hub * 2) / totalHealth : 0;

        return {
          tag,
          count,
          types,
          health,
          healthScore,
          connections: cards.filter(c => c.tags.includes(tag))
            .reduce((sum, c) => sum + (c.links?.length || 0), 0)
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [cards]);

  const totalCards = cards.length;
  const totalTags = tagStats.length;
  const avgTagsPerCard = totalCards > 0 ? (tagStats.reduce((sum, t) => sum + t.count, 0) / totalCards).toFixed(1) : '0';

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag);
  };

  const initRename = (tag: string) => {
    setEditingTag({ oldName: tag, newName: tag });
    setIsRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!editingTag || !editingTag.newName.trim()) return;
    if (editingTag.newName !== editingTag.oldName) {
      await renameTag(editingTag.oldName, editingTag.newName);
      if (selectedTag === editingTag.oldName) {
        setSelectedTag(editingTag.newName);
      }
    }
    setIsRenameDialogOpen(false);
    setEditingTag(null);
  };

  const handleDelete = async (tag: string) => {
    if (window.confirm(`Are you sure you want to delete tag #${tag}? This will remove it from all notes.`)) {
      await deleteTag(tag);
      if (selectedTag === tag) {
        setSelectedTag(null);
      }
    }
  };

  if (selectedTag) {
    return (
      <TagDetailView
        tag={selectedTag}
        onBack={() => setSelectedTag(null)}
        onOpenCard={selectCard}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in duration-300">
      <div className="h-12 border-b border-zinc-200 flex items-center px-6 shrink-0 justify-between">
        <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
          <Hash size={14} className="text-zinc-500" /> Tag Taxonomy
        </h2>
        <div className="text-xs text-zinc-400">
          Manage and organize your knowledge tags
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatsCard
              label="Total Tags"
              value={totalTags.toString()}
              subValue="Active taxonomy"
              subIcon={<TrendingUp size={10} />}
              subColor="text-emerald-500"
            />
            <StatsCard
              label="Avg Tags/Card"
              value={avgTagsPerCard}
              subValue="Per note"
            />
            <StatsCard
              label="Tag Density"
              value={`${totalCards > 0 ? ((totalTags / totalCards) * 100).toFixed(0) : 0}%`}
              subValue="Coverage"
            />
            <StatsCard
              label="Network Density"
              value={`${tagStats.length > 0 ? (tagStats.reduce((sum, t) => sum + t.connections, 0) / tagStats.length).toFixed(1) : 0}`}
              subValue="Avg connections"
            />
          </div>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tagStats.map(({ tag, count, types, health, healthScore, connections }) => (
              <div
                key={tag}
                className="border border-zinc-200 rounded-sm p-4 hover:border-blue-400 hover:shadow-md transition-all group bg-white relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    onClick={() => handleTagClick(tag)}
                    className="text-sm font-bold text-zinc-800 group-hover:text-blue-600 cursor-pointer flex items-center gap-1"
                  >
                    <Hash size={12} className="opacity-50" />
                    {tag}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 px-1.5 rounded-sm">
                      {count}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-zinc-400 hover:text-zinc-600">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSearchQuery(tag);
                          setCurrentView("all");
                        }}>
                          <Filter className="mr-2 h-4 w-4" /> Filter Notes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => initRename(tag)}>
                          <Pencil className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(tag)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Tag Metadata Types */}
                <div className="flex gap-1 mb-3 flex-wrap cursor-default">
                  {types.map(type => (
                    <Badge key={type} variant="secondary" className="text-[9px] capitalize px-1.5 py-0 h-4">
                      {type}
                    </Badge>
                  ))}
                </div>

                {/* Health Bar */}
                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden mb-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-yellow-500 to-rose-500 h-full"
                    style={{ width: `${healthScore * 100}%` }}
                  />
                </div>

                {/* Connection Stats */}
                <div className="flex justify-between items-center text-[10px] text-zinc-500 cursor-default">
                  <span className="flex items-center gap-1">
                    <Activity size={10} />
                    {connections} connections
                  </span>
                  <span className="text-zinc-400">
                    {health.orphan > 0 && `${health.orphan} orphans`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {tagStats.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Hash size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No tags yet</p>
              <p className="text-sm">Start adding tags to your notes to build your taxonomy</p>
            </div>
          )}
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Tag</DialogTitle>
            <DialogDescription>
              Enter a new name for the tag. This will update all {tagStats.find(t => t.tag === editingTag?.oldName)?.count} occurrences.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={editingTag?.newName || ""}
                onChange={(e) => setEditingTag(prev => prev ? { ...prev, newName: e.target.value } : null)}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRename}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsCard({ label, value, subValue, subIcon, subColor }: {
  label: string;
  value: string;
  subValue: string;
  subIcon?: React.ReactNode;
  subColor?: string;
}) {
  return (
    <div className="bg-white p-4 rounded-sm border border-zinc-200 shadow-sm">
      <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
      <div className={`text-[10px] flex items-center gap-1 mt-1 ${subColor || 'text-zinc-400'}`}>
        {subIcon} {subValue}
      </div>
    </div>
  );
}

function TagDetailView({ tag, onBack, onOpenCard }: { tag: string; onBack: () => void; onOpenCard: (id: string) => void }) {
  const { cards } = useAppStore();

  const taggedCards = useMemo(() => cards.filter(c => c.tags.includes(tag)), [cards, tag]);

  // Group cards by type
  const groupedCards = useMemo(() => {
    return {
      fleeting: taggedCards.filter(c => c.type === 'fleeting'),
      literature: taggedCards.filter(c => c.type === 'literature'),
      permanent: taggedCards.filter(c => c.type === 'permanent'),
      project: taggedCards.filter(c => c.type === 'project'),
    };
  }, [taggedCards]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="h-14 border-b border-zinc-200 flex items-center px-6 shrink-0 bg-white shadow-sm z-10 sticky top-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="mr-4 text-zinc-500 hover:text-zinc-800 -ml-2">
          <ArrowLeft size={16} className="mr-1" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
            <span className="text-zinc-400">#</span>{tag}
          </h2>
          <Badge variant="secondary" className="font-mono text-xs">{taggedCards.length} notes</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-12 pb-20">

          <Section
            title="Fleeting Notes"
            description="Quick captures, sparks, and unrefined ideas from your inbox."
            icon={Lightbulb}
            iconColor="text-amber-500"
            cards={groupedCards.fleeting}
            onOpenCard={onOpenCard}
          />

          <Section
            title="Literature Notes"
            description="Content derived from reading, observing, and external sources."
            icon={Book}
            iconColor="text-blue-500"
            cards={groupedCards.literature}
            onOpenCard={onOpenCard}
          />

          <Section
            title="Permanent Notes"
            description="Developed thoughts, evergreen concepts, and core knowledge."
            icon={FileText}
            iconColor="text-emerald-500"
            cards={groupedCards.permanent}
            onOpenCard={onOpenCard}
          />

          <Section
            title="Projects"
            description="Active efforts, goals, and structured output."
            icon={FolderKanban}
            iconColor="text-purple-500"
            cards={groupedCards.project}
            onOpenCard={onOpenCard}
          />

        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  iconColor,
  cards,
  onOpenCard
}: {
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  cards: any[];
  onOpenCard: (id: string) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 border-b border-zinc-200 pb-3">
        <div className={`p-2 rounded-md bg-white border border-zinc-100 shadow-sm ${iconColor}`}>
          <Icon size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-zinc-800">{title}</h3>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map(card => (
          <div
            key={card.id}
            onClick={() => onOpenCard(card.id)}
            className="group bg-white p-4 rounded-sm border border-zinc-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
          >
            <div className="font-bold text-zinc-800 group-hover:text-blue-600 line-clamp-1">{card.title}</div>
            <div className="text-xs text-zinc-400 font-mono flex items-center gap-2">
              <span>{new Date(card.updatedAt).toLocaleDateString()}</span>
              {card.links.length > 0 && <span>• {card.links.length} links</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

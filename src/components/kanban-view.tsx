import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card as CardData } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";

type Status = "todo" | "doing" | "done";

const COLUMNS: { id: Status; title: string; color: string }[] = [
  { id: "todo", title: "待办", color: "bg-slate-100 border-slate-200" },
  { id: "doing", title: "进行中", color: "bg-blue-50 border-blue-100" },
  { id: "done", title: "已完成", color: "bg-emerald-50 border-emerald-100" },
];

interface KanbanViewProps {
  cards: CardData[];
  onCardClick: (id: string) => void;
}

// Helper to determine status from tags
function getStatus(card: CardData): Status {
  if (card.tags.includes("done") || card.tags.includes("已完成")) return "done";
  if (card.tags.includes("doing") || card.tags.includes("进行中")) return "doing";
  return "todo";
}

function SortableItem({ card, onClick }: { card: CardData; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "Card", card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-50 h-[100px] border-2 border-dashed border-primary/50 rounded-lg bg-muted"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="group relative bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm line-clamp-2 leading-tight">
          {card.title || "无标题"}
        </h4>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {card.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function KanbanView({ cards, onCardClick }: KanbanViewProps) {
  const { updateCard } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const cols: Record<Status, CardData[]> = { todo: [], doing: [], done: [] };
    cards.forEach((card) => {
      const status = getStatus(card);
      cols[status].push(card);
    });
    return cols;
  }, [cards]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;

    const overId = over.id as string;
    
    // If over a container (column) directly
    if (COLUMNS.some(c => c.id === overId)) {
        // Handled in dragEnd
        return;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeCard = cards.find((c) => c.id === active.id);
    if (!activeCard) return;

    const overId = over.id as string;
    
    // Determine new status
    let newStatus: Status | null = null;

    if (COLUMNS.some((c) => c.id === overId)) {
      newStatus = overId as Status;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (overCard) {
        newStatus = getStatus(overCard);
      }
    }

    if (newStatus && newStatus !== getStatus(activeCard)) {
      // Update tags
      const newTags = activeCard.tags.filter(
        (t) => !["todo", "doing", "done", "待办", "进行中", "已完成"].includes(t)
      );
      newTags.push(newStatus);
      await updateCard(activeCard.id, { tags: newTags });
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className={cn(
              "flex-shrink-0 w-72 rounded-xl flex flex-col max-h-full",
              col.color
            )}
          >
            {/* Header */}
            <div className="p-3 flex items-center justify-between border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{col.title}</span>
                <Badge variant="secondary" className="text-xs bg-white/50">
                  {columns[col.id].length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Column Content */}
            <div className="flex-1 p-2 overflow-y-auto">
              <SortableContext
                id={col.id}
                items={columns[col.id].map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 min-h-[100px]" ref={null} id={col.id}> 
                   {/* We need a Droppable container, SortableContext doesn't render one automatically 
                       Wait, SortableContext just provides context. We need a droppable area.
                       However, individual items are sortable. To drop into an empty column, 
                       we need the column itself to be a drop target.
                       
                       Actually, dnd-kit is flexible. If I use the column ID as a container ID 
                       and handle over detection, it works.
                   */}
                   {columns[col.id].map((card) => (
                    <SortableItem
                      key={card.id}
                      card={card}
                      onClick={() => onCardClick(card.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard ? (
            <div className="bg-card border rounded-lg p-3 shadow-lg cursor-grabbing w-72">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm line-clamp-2 leading-tight">
                  {activeCard.title || "无标题"}
                </h4>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {activeCard.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}




/**
 * Canvas Toolbar - Floating dock for adding nodes
 */
import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CreditCard, StickyNote, FileText, Link2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  className?: string; // Allow custom classNames
}

const nodeTypeConfig = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    description: 'Add text',
  },
  {
    type: 'card',
    label: 'Card',
    icon: CreditCard,
    description: 'Add existing card',
  },
  {
    type: 'note',
    label: 'Note',
    icon: StickyNote,
    description: 'Add sticky note',
  },
  {
    type: 'document',
    label: 'Doc',
    icon: FileText,
    description: 'Add document',
  },
  {
    type: 'link',
    label: 'Link',
    icon: Link2,
    description: 'Add link',
  },
];

export function CanvasToolbar({ onAddNode, className }: CanvasToolbarProps) {
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = useCallback(
    (type: string) => {
      // Get center of viewport
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const position = screenToFlowPosition({
        x: centerX,
        y: centerY,
      });

      // Add small random offset to prevent perfect stacking if user clicks multiple times fast
      const randomOffset = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
      };

      onAddNode(type, { x: position.x + randomOffset.x, y: position.y + randomOffset.y });
    },
    [screenToFlowPosition, onAddNode]
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        "absolute bottom-8 left-1/2 -translate-x-1/2 z-20",
        "flex items-center gap-2 p-2 rounded-full",
        "bg-white/80 backdrop-blur-xl border border-zinc-200/60 shadow-xl shadow-zinc-200/20",
        "transition-all duration-300 hover:scale-[1.02]",
        className
      )}>
        {nodeTypeConfig.map((config) => {
          const Icon = config.icon;
          return (
            <Tooltip key={config.type}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 transition-all",
                    "hover:bg-zinc-100 hover:text-zinc-900 text-zinc-500"
                  )}
                  onClick={() => handleAddNode(config.type)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{config.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="mb-2">
                <p>{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

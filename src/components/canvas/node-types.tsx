/**
 * React Flow Custom Node Types
 */
import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { CreditCard, StickyNote, FileText, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper for updating node data
const useNodeDataUpdate = (id: string) => {
  const { setNodes } = useReactFlow();
  return useCallback((key: string, value: any) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, [key]: value } };
        }
        return node;
      })
    );
  }, [id, setNodes]);
};

// --- Text Node ---
export const TextNode = memo(({ id, data, selected }: NodeProps) => {
  const updateData = useNodeDataUpdate(id);
  const label = (data as { label?: string })?.label || '';

  return (
    <div className={cn(
      "relative group min-w-[50px] min-h-[30px]",
    )}>
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={40}
        lineStyle={{ border: '1px solid #3b82f6' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />

      <div className={cn(
        "h-full w-full px-4 py-2 bg-white rounded-lg border shadow-sm transition-all",
        selected ? "border-blue-500 ring-2 ring-blue-500/10" : "border-zinc-200 hover:border-zinc-300"
      )}>
        <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2" />
        <textarea
          className="w-full h-full resize-none bg-transparent border-none outline-none text-sm font-medium text-zinc-800 placeholder:text-zinc-400 overflow-hidden"
          placeholder="Enter text..."
          value={label}
          onChange={(e) => updateData('label', e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2 !h-2" />
      </div>
    </div>
  );
});

// --- Card Node (Reference to a Z-Card) ---
export const CardNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as { cardId?: string; cardTitle?: string };

  return (
    <div className={cn(
      "w-[240px] bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
      selected ? "border-blue-500 ring-2 ring-blue-500/10 shadow-md" : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2" />

      <div className="h-1.5 w-full bg-blue-500/80" />

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-blue-50 rounded-md shrink-0 text-blue-600">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-800 truncate leading-tight">
              {nodeData.cardTitle || 'Untitled Card'}
            </div>
            {nodeData.cardId && (
              <div className="text-[10px] uppercase font-mono text-zinc-400 mt-1 truncate">
                {nodeData.cardId}
              </div>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2 !h-2" />
    </div>
  );
});

// --- Note Node (Sticky Note) ---
export const NoteNode = memo(({ id, data, selected }: NodeProps) => {
  const updateData = useNodeDataUpdate(id);
  const content = (data as { content?: string })?.content || '';

  return (
    <div className="relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineStyle={{ border: '1px solid #eab308' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />

      <div className={cn(
        "h-full w-full flex flex-col bg-yellow-50 rounded-lg border shadow-sm transition-all",
        selected ? "border-yellow-400 ring-2 ring-yellow-400/10" : "border-yellow-200 hover:border-yellow-300"
      )}>
        <Handle type="target" position={Position.Top} className="!bg-yellow-400/50 !w-2 !h-2" />

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-yellow-100/50 text-yellow-700/80 bg-yellow-100/30 rounded-t-lg">
          <StickyNote className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Note</span>
        </div>

        {/* Content */}
        <textarea
          className="flex-1 w-full p-3 bg-transparent resize-none border-none outline-none text-xs leading-relaxed text-yellow-900 placeholder:text-yellow-700/30"
          placeholder="Type your note here..."
          value={content}
          onChange={(e) => updateData('content', e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />

        <Handle type="source" position={Position.Bottom} className="!bg-yellow-400/50 !w-2 !h-2" />
      </div>
    </div>
  );
});

// --- Document Node ---
export const DocumentNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as { title?: string; content?: string };

  return (
    <div className={cn(
      "w-[220px] bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
      selected ? "border-green-500 ring-2 ring-green-500/10" : "border-zinc-200 hover:border-zinc-300"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2" />

      <div className="h-1.5 w-full bg-green-500/80" />

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-green-50 rounded-md shrink-0 text-green-600">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-800 truncate leading-tight">
              {nodeData.title || 'Untitled Doc'}
            </div>
            {nodeData.content && (
              <div className="text-xs text-zinc-500 mt-1.5 line-clamp-3 leading-snug">
                {nodeData.content}
              </div>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2 !h-2" />
    </div>
  );
});

// --- Link Node ---
export const LinkNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as { url?: string; linkLabel?: string };
  const updateData = useNodeDataUpdate(id);

  return (
    <div className={cn(
      "w-[260px] bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
      selected ? "border-purple-500 ring-2 ring-purple-500/10" : "border-zinc-200 hover:border-zinc-300"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2" />

      <div className="flex items-center p-3 gap-3">
        <div className="p-2 bg-purple-50 rounded-lg shrink-0 text-purple-600">
          <Link2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <input
            className="text-sm font-medium text-zinc-800 bg-transparent border-none outline-none placeholder:text-zinc-400"
            placeholder="Link Title"
            value={nodeData.linkLabel || ''}
            onChange={(e) => updateData('linkLabel', e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <input
            className="text-xs text-blue-500 bg-transparent border-none outline-none placeholder:text-zinc-300 truncate hover:underline cursor-pointer"
            placeholder="https://..."
            value={nodeData.url || ''}
            onChange={(e) => updateData('url', e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              if (e.metaKey && nodeData.url) {
                window.open(nodeData.url, '_blank');
              }
            }}
          />
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2 !h-2" />
    </div>
  );
});

export const nodeTypes = {
  text: TextNode,
  card: CardNode,
  note: NoteNode,
  document: DocumentNode,
  link: LinkNode,
};

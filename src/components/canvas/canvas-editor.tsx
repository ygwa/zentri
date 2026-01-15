import { useCallback, useEffect, useState, useRef } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    ReactFlowProvider,
    useReactFlow,

} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import { Canvas } from '@/types/canvas';
import { useDebounce } from '@/hooks/use-debounce';
import { nodeTypes } from './node-types';
import { CanvasToolbar } from './canvas-toolbar';
import { Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteList } from '@/components/views/note-list';
import { Button } from '@/components/ui/button';

interface CanvasEditorProps {
    canvasId: string;
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function CanvasEditorInner({ canvasId }: CanvasEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [title, setTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { screenToFlowPosition } = useReactFlow();
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Load Canvas
    useEffect(() => {
        setIsLoading(true);
        invoke<Canvas | null>('get_canvases') // Inefficient, but get_canvas needs to be checked
        invoke<Canvas | null>('get_canvas', { id: canvasId })
            .then((data: Canvas | null) => {
                if (data) {
                    setNodes((data.nodes as Node[]) || []);
                    setEdges((data.edges as Edge[]) || []);
                    setTitle(data.title);
                }
            })
            .catch((err: unknown) => {
                console.error('Failed to load canvas:', err);
                setSaveStatus('error');
            })
            .finally(() => setIsLoading(false));
    }, [canvasId, setNodes, setEdges]);

    // Debounced Save
    const debouncedNodes = useDebounce(nodes, 1000);
    const debouncedEdges = useDebounce(edges, 1000);
    const debouncedTitle = useDebounce(title, 1000);

    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (isLoading) return;
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        setSaveStatus('saving');

        invoke('update_canvas', {
            id: canvasId,
            title: debouncedTitle || undefined,
            nodes: debouncedNodes,
            edges: debouncedEdges,
        })
            .then(() => {
                setSaveStatus('saved');
            })
            .catch((err: unknown) => {
                console.error('Failed to save canvas:', err);
                setSaveStatus('error');
            });
    }, [debouncedNodes, debouncedEdges, debouncedTitle, canvasId, isLoading]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const handleAddNode = useCallback(
        (type: string, position: { x: number; y: number }, data?: any) => {
            const getNodeData = (nodeType: string) => {
                switch (nodeType) {
                    case 'text':
                        return { label: 'Double click to edit' };
                    case 'card':
                        return {
                            cardTitle: data?.title || 'New Card',
                            cardId: data?.id
                        };
                    case 'note':
                        return { content: '' };
                    case 'document':
                        return { title: 'New Document', content: 'Empty document_ content' };
                    case 'link':
                        return { url: '', linkLabel: '' };
                    default:
                        return {};
                }
            };

            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: getNodeData(type),
            };
            setNodes((nds) => [...nds, newNode]);
        },
        [setNodes]
    );

    const onPaneClick = useCallback(
        (event: React.MouseEvent) => {
            if (event.detail === 2) {
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                handleAddNode('text', position);
            }
        },
        [screenToFlowPosition, handleAddNode]
    );

    // Drag & Drop Handlers
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            let type = event.dataTransfer.getData('application/reactflow/type');
            let cardId = event.dataTransfer.getData('application/zentri/card-id');
            let cardTitle = event.dataTransfer.getData('application/zentri/card-title');

            // Fallback for missing custom types (browser security restrictions)
            if (!type) {
                try {
                    const jsonData = event.dataTransfer.getData('text/plain');
                    if (jsonData) {
                        const data = JSON.parse(jsonData);
                        if (data.type) {
                            type = data.type;
                            cardId = data.cardId;
                            cardTitle = data.cardTitle;
                        }
                    }
                } catch (e) {
                    // Not JSON
                }
            }

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Handle drops from sidebar
            if (type === 'card') {
                handleAddNode('card', position, { id: cardId, title: cardTitle });
                return;
            }

            handleAddNode(type, position);
        },
        [screenToFlowPosition, handleAddNode],
    );

    if (isLoading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Loading Canvas...</span>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full relative overflow-hidden">
            {/* Library Sidebar */}
            <div className={cn(
                "h-full bg-[#fcfcfc] border-r border-zinc-200 transition-all duration-300 ease-in-out overflow-hidden flex flex-col relative z-20",
                isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0"
            )}>
                <NoteList
                    viewMode="all"
                    selectedId={null}
                    onSelect={() => { }}
                />
            </div>

            {/* Canvas Area */}
            <div className="flex-1 h-full relative bg-zinc-50" ref={wrapperRef}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onPaneClick={onPaneClick}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    fitView
                    deleteKeyCode={['Backspace', 'Delete']}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#94a3b8', strokeWidth: 2 },
                    }}
                    proOptions={{ hideAttribution: true }}
                >
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                        {/* Sidebar Toggle */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="bg-white border-zinc-200 h-8 w-8 rounded-sm shadow-sm"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        >
                            {isSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                        </Button>

                        <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-sm border shadow-sm flex items-center gap-2">
                            <h1 className="text-sm font-semibold text-zinc-700 max-w-[200px] truncate">
                                {title || 'Untitled Canvas'}
                            </h1>
                            <div className="w-px h-3 bg-zinc-200" />
                            <div className="flex items-center gap-1.5">
                                {saveStatus === 'saving' && (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                                        <span className="text-xs text-zinc-500">Saving...</span>
                                    </>
                                )}
                                {saveStatus === 'saved' && (
                                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                                        Saved
                                    </span>
                                )}
                                {saveStatus === 'error' && (
                                    <span className="text-xs text-red-500 flex items-center gap-1">
                                        Error
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <Controls className="!bg-white !border-zinc-200 !shadow-sm !fill-zinc-600 !rounded-sm" />
                    <MiniMap
                        className="!bg-white !border-zinc-200 !shadow-sm !rounded-sm"
                        maskColor="rgba(240, 240, 240, 0.6)"
                        nodeColor={(n) => {
                            if (n.type === 'card') return '#3b82f6';
                            if (n.type === 'note') return '#eab308';
                            if (n.type === 'document') return '#22c55e';
                            return '#94a3b8';
                        }}
                    />
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />

                    <CanvasToolbar onAddNode={handleAddNode} />
                </ReactFlow>
            </div>
        </div>
    );
}

export function CanvasEditor({ canvasId }: CanvasEditorProps) {
    return (
        <ReactFlowProvider>
            <CanvasEditorInner canvasId={canvasId} />
        </ReactFlowProvider>
    );
}

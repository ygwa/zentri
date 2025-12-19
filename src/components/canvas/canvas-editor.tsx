import { useCallback, useEffect, useState } from 'react';
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
// 暂时直接使用 invoke，等 Store 迁移完成后再使用
// import { useAppStore } from '@/store';
import { invoke } from '@tauri-apps/api/core';
import { Canvas } from '@/types/canvas';
import { useDebounce } from '@/hooks/use-debounce';
import { nodeTypes } from './node-types';
import { CanvasToolbar } from './canvas-toolbar';

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
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { screenToFlowPosition } = useReactFlow();

    // Load Canvas
    useEffect(() => {
        setIsLoading(true);
        invoke<Canvas | null>('get_canvas', { id: canvasId })
            .then((data: Canvas | null) => {
                if (data) {
                    // React Flow expects exact Node/Edge types. 
                    // We assume stored JSON is compatible or fallback to empty.
                    setNodes((data.nodes as Node[]) || []);
                    setEdges((data.edges as Edge[]) || []);
                    setTitle(data.title);
                }
            })
            .catch((err: unknown) => {
                console.error('Failed to load canvas:', err);
                setSaveError('加载白板失败');
            })
            .finally(() => setIsLoading(false));
    }, [canvasId, setNodes, setEdges]);

    // Debounced Save
    const debouncedNodes = useDebounce(nodes, 1000);
    const debouncedEdges = useDebounce(edges, 1000);
    const debouncedTitle = useDebounce(title, 1000);

    useEffect(() => {
        if (isLoading) return;
        // 初始加载时不需要保存
        if (debouncedNodes.length === 0 && debouncedEdges.length === 0 && debouncedTitle === '') return;

        console.log('Saving canvas...', canvasId);
        setIsSaving(true);
        invoke('update_canvas', {
            id: canvasId,
            title: debouncedTitle || undefined,
            nodes: debouncedNodes,
            edges: debouncedEdges,
        })
        .then(() => {
            setIsSaving(false);
            setSaveError(null);
        })
        .catch((err: unknown) => {
            console.error('Failed to save canvas:', err);
            setSaveError('保存失败，请重试');
            setIsSaving(false);
            setTimeout(() => setSaveError(null), 3000);
        });
    }, [debouncedNodes, debouncedEdges, debouncedTitle, canvasId, isLoading]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    // 添加节点
    const handleAddNode = useCallback(
        (type: string, position: { x: number; y: number }) => {
            const getNodeData = (nodeType: string) => {
                switch (nodeType) {
                    case 'text':
                        return { label: '新文本节点' };
                    case 'card':
                        return { cardTitle: '新卡片' };
                    case 'note':
                        return { content: '点击编辑笔记...' };
                    case 'document':
                        return { title: '新文档' };
                    case 'link':
                        return { url: '', linkLabel: '新链接' };
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

    // 双击画布添加文本节点
    const onPaneClick = useCallback(
        (event: React.MouseEvent) => {
            if (event.detail === 2) {
                // 双击
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                handleAddNode('text', position);
            }
        },
        [screenToFlowPosition, handleAddNode]
    );

    if (isLoading) {
        return <div className="h-full w-full flex items-center justify-center">Loading Canvas...</div>;
    }

    return (
        <div className="h-full w-full bg-slate-50 relative">
            <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur p-2 rounded shadow-sm border flex items-center gap-2">
                <h1 className="text-lg font-bold">{title}</h1>
                {isSaving && (
                    <span className="text-xs text-muted-foreground">保存中...</span>
                )}
            </div>
            {saveError && (
                <div className="absolute top-4 right-4 z-10 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
                    {saveError}
                </div>
            )}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneClick={onPaneClick}
                fitView
                deleteKeyCode={['Backspace', 'Delete']}
            >
                <Controls />
                <MiniMap />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
            <CanvasToolbar onAddNode={handleAddNode} />
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

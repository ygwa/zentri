import { Node, Edge } from '@xyflow/react';

export interface Canvas {
    id: string;
    title: string;
    nodes: Node[];
    edges: Edge[];
    createdAt: number;
    updatedAt: number;
}

export interface CanvasListItem {
    id: string;
    title: string;
    updatedAt: number;
}

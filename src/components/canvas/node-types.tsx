/**
 * React Flow 自定义节点类型
 */
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CreditCard, StickyNote, FileText, Link2 } from 'lucide-react';

// 文本节点
export function TextNode({ data, selected }: NodeProps) {
  const label = (data as { label?: string })?.label || '文本节点';
  return (
    <div
      className={`px-4 py-3 bg-white border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-blue-500' : 'border-gray-200'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="text-sm font-medium">{label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// 卡片节点
export function CardNode({ data, selected }: NodeProps) {
  const nodeData = data as { cardId?: string; cardTitle?: string };
  return (
    <div
      className={`px-4 py-3 bg-blue-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-blue-500' : 'border-blue-200'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-blue-600" />
        <div className="text-sm font-medium text-blue-900">
          {nodeData.cardTitle || '卡片节点'}
        </div>
      </div>
      {nodeData.cardId && (
        <div className="text-xs text-blue-600 mt-1">ID: {nodeData.cardId}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// 笔记节点
export function NoteNode({ data, selected }: NodeProps) {
  const nodeData = data as { content?: string };
  return (
    <div
      className={`px-4 py-3 bg-yellow-50 border-2 rounded-lg shadow-sm min-w-[200px] max-w-[300px] ${
        selected ? 'border-yellow-500' : 'border-yellow-200'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="h-4 w-4 text-yellow-600" />
        <div className="text-xs font-semibold text-yellow-800">笔记</div>
      </div>
      <div className="text-sm text-yellow-900">{nodeData.content || '点击编辑...'}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// 文档节点
export function DocumentNode({ data, selected }: NodeProps) {
  const nodeData = data as { title?: string; content?: string };
  return (
    <div
      className={`px-4 py-3 bg-green-50 border-2 rounded-lg shadow-sm min-w-[200px] max-w-[300px] ${
        selected ? 'border-green-500' : 'border-green-200'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-green-600" />
        <div className="text-sm font-medium text-green-900">{nodeData.title || '文档'}</div>
      </div>
      {nodeData.content && (
        <div className="text-xs text-green-700 line-clamp-2">{nodeData.content}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// 链接节点
export function LinkNode({ data, selected }: NodeProps) {
  const nodeData = data as { url?: string; linkLabel?: string };
  return (
    <div
      className={`px-4 py-3 bg-purple-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-purple-500' : 'border-purple-200'
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-purple-600" />
        <div className="text-sm font-medium text-purple-900">
          {nodeData.linkLabel || '链接'}
        </div>
      </div>
      {nodeData.url && (
        <div className="text-xs text-purple-600 mt-1 truncate">{nodeData.url}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// 节点类型映射
export const nodeTypes = {
  text: TextNode as React.ComponentType<NodeProps>,
  card: CardNode as React.ComponentType<NodeProps>,
  note: NoteNode as React.ComponentType<NodeProps>,
  document: DocumentNode as React.ComponentType<NodeProps>,
  link: LinkNode as React.ComponentType<NodeProps>,
};

// 节点类型定义
export type NodeType = keyof typeof nodeTypes;


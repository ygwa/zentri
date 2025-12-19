/**
 * 白板工具栏 - 用于添加不同类型的节点
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

interface CanvasToolbarProps {
  onAddNode: (type: string, position: { x: number; y: number }) => void;
}

const nodeTypeConfig = [
  {
    type: 'text',
    label: '文本',
    icon: Type,
    color: 'bg-gray-100 hover:bg-gray-200 border-gray-300',
    description: '添加文本节点',
  },
  {
    type: 'card',
    label: '卡片',
    icon: CreditCard,
    color: 'bg-blue-100 hover:bg-blue-200 border-blue-300',
    description: '添加卡片节点',
  },
  {
    type: 'note',
    label: '笔记',
    icon: StickyNote,
    color: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300',
    description: '添加笔记节点',
  },
  {
    type: 'document',
    label: '文档',
    icon: FileText,
    color: 'bg-green-100 hover:bg-green-200 border-green-300',
    description: '添加文档节点',
  },
  {
    type: 'link',
    label: '链接',
    icon: Link2,
    color: 'bg-purple-100 hover:bg-purple-200 border-purple-300',
    description: '添加链接节点',
  },
];

export function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = useCallback(
    (type: string) => {
      // 获取视口中心位置
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      // 转换为流程坐标
      const position = screenToFlowPosition({
        x: centerX,
        y: centerY,
      });

      onAddNode(type, position);
    },
    [screenToFlowPosition, onAddNode]
  );

  return (
    <TooltipProvider>
      <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-2 flex flex-col gap-2">
        <div className="text-xs font-semibold text-gray-500 px-2 py-1 border-b border-gray-200">
          添加节点
        </div>
        {nodeTypeConfig.map((config) => {
          const Icon = config.icon;
          return (
            <Tooltip key={config.type}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start gap-2 ${config.color}`}
                  onClick={() => handleAddNode(config.type)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{config.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}


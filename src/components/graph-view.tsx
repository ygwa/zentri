import { useEffect, useState, useRef, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import * as api from "@/services/api";

// 节点颜色配置 - 与盒子颜色一致但更沉稳
const nodeColors: Record<string, { light: string; dark: string }> = {
  fleeting: { light: "#d97706", dark: "#fbbf24" },   // 琥珀
  literature: { light: "#0284c7", dark: "#38bdf8" }, // 天蓝
  permanent: { light: "#059669", dark: "#34d399" },  // 翠绿
  project: { light: "#7c3aed", dark: "#a78bfa" },    // 紫罗兰
};

// 集群颜色调色板 (用于区分不同知识集群)
const clusterColors = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
];

// Simple hook for container dimensions
function useDimensions(ref: React.RefObject<HTMLDivElement | null>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return dimensions;
}

export interface GraphFilters {
  hiddenTypes?: string[];
  /** 是否按集群着色 (默认按卡片类型) */
  colorByCluster?: boolean;
  /** 节点大小是否基于 PageRank (默认基于链接数) */
  sizeByImportance?: boolean;
}

export interface GraphStats {
  nodeCount: number;
  linkCount: number;
  clusterCount: number;
  orphanCount: number;
}

export function GraphView({ 
  onNodeClick, 
  filters,
  onStatsChange,
}: { 
  onNodeClick?: (id: string) => void;
  filters?: GraphFilters;
  onStatsChange?: (stats: GraphStats) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const { width, height } = useDimensions(containerRef);
  const [graphData, setGraphData] = useState<{ nodes: unknown[]; links: unknown[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rawData, setRawData] = useState<api.GraphData | null>(null);

  // Theme handling (basic)
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const loadGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      // Call Rust to get layout (now includes PageRank and cluster info)
      const data = await api.graph.getData();
      setRawData(data);
      
      // Report stats
      onStatsChange?.({
        nodeCount: data.nodes.length,
        linkCount: data.links.length,
        clusterCount: data.clusterCount || 0,
        orphanCount: data.orphanCount || 0,
      });
    } catch (e) {
      console.error("Failed to load graph", e);
    } finally {
      setIsLoading(false);
    }
  }, [onStatsChange]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Apply filters and transform data
  useEffect(() => {
    if (!rawData) return;

    const filteredNodes = rawData.nodes.filter(n =>
      !filters?.hiddenTypes?.includes(n.cardType || 'permanent')
    );

    const nodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredLinks = rawData.links.filter(l => {
      const sourceId = typeof l === 'object' && 'source' in l ? (l as any).source : l[0];
      const targetId = typeof l === 'object' && 'target' in l ? (l as any).target : l[1];
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    // Transform nodes with PageRank and cluster info
    const nodes = filteredNodes.map(n => {
      // 节点大小: 基于 PageRank 或链接数
      let nodeVal: number;
      if (filters?.sizeByImportance && n.importance) {
        // PageRank 范围通常是 0.001 - 0.1，映射到 2-20
        nodeVal = Math.max(2, Math.min(20, n.importance * 200));
      } else {
        nodeVal = Math.max(n.linkCount + 1, 2);
      }

      return {
        id: n.id,
        title: n.title || n.id.slice(0, 8),
        cardType: n.cardType || "permanent",
        val: nodeVal,
        linkCount: n.linkCount,
        importance: n.importance || 0,
        clusterId: n.clusterId || 0,
      };
    });

    // Transform links to the format ForceGraph2D expects
    const links = filteredLinks.map(l => {
      if (Array.isArray(l)) {
        return { source: l[0], target: l[1] };
      }
      return l;
    });

    setGraphData({ nodes, links });

  }, [rawData, filters]);

  // 获取节点颜色 (基于类型或集群)
  const getNodeColor = useCallback((node: any) => {
    if (filters?.colorByCluster) {
      // 按集群着色
      const clusterIndex = (node.clusterId || 0) % clusterColors.length;
      return clusterColors[clusterIndex];
    } else {
      // 按卡片类型着色
      const colors = nodeColors[node.cardType] || nodeColors.permanent;
      return isDark ? colors.dark : colors.light;
    }
  }, [filters?.colorByCluster, isDark]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-background">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm">
          <span className="text-sm text-muted-foreground">加载图谱...</span>
        </div>
      )}

      {graphData && (width > 0 && height > 0) && (
        <ForceGraph2D
          ref={fgRef}
          width={width}
          height={height}
          graphData={graphData as any}
          nodeLabel={(node: any) => {
            const importance = node.importance ? `\n重要性: ${(node.importance * 100).toFixed(1)}%` : '';
            const cluster = filters?.colorByCluster ? `\n集群: #${node.clusterId}` : '';
            return `${node.title}\n链接: ${node.linkCount}${importance}${cluster}`;
          }}
          nodeColor={getNodeColor}
          linkColor={() => isDark ? "#ffffff15" : "#cbd5e1"}
          linkWidth={1}
          backgroundColor="transparent"
          onNodeClick={(node: any) => onNodeClick?.(node.id)}
          // Custom painting for professional look with PageRank/Cluster visualization
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.title || "无标题";
            const nodeColor = getNodeColor(node);

            // 节点大小基于 val (已在数据转换时计算好)
            const baseR = Math.sqrt(node.val) * 2.5;
            const r = Math.max(4, Math.min(baseR, 16));

            // 重要节点 (PageRank 高或链接多) 绘制光晕
            const isImportant = node.importance > 0.02 || node.linkCount > 3;
            if (isImportant) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
              ctx.fillStyle = `${nodeColor}25`;
              ctx.fill();
            }

            // 绘制节点
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = nodeColor;
            ctx.fill();

            // 高重要性节点绘制金色边框
            if (node.importance > 0.03) {
              ctx.strokeStyle = isDark ? "#fbbf24" : "#d97706";
              ctx.lineWidth = 2;
              ctx.stroke();
            } else {
              ctx.strokeStyle = isDark ? "#ffffff30" : "#00000015";
              ctx.lineWidth = 1;
              ctx.stroke();
            }

            // 标签显示逻辑：
            // - 缩放 > 1.2 时显示所有标签
            // - 缩放 > 0.8 时显示有链接的节点标签
            // - 高重要性节点始终显示
            const showLabel = globalScale > 1.2 || 
              (globalScale > 0.8 && node.linkCount > 0) ||
              (globalScale > 0.5 && node.importance > 0.03);

            if (showLabel) {
              const maxLen = globalScale > 2 ? 20 : 12;
              const displayLabel = label.length > maxLen
                ? label.slice(0, maxLen) + "…"
                : label;

              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';

              const textWidth = ctx.measureText(displayLabel).width;
              const padding = 3;
              const bgY = node.y + r + 4;

              ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.9)";
              ctx.beginPath();
              ctx.roundRect(
                node.x - textWidth / 2 - padding,
                bgY - 1,
                textWidth + padding * 2,
                fontSize + 4,
                3
              );
              ctx.fill();

              ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.85)';
              ctx.fillText(displayLabel, node.x, bgY + 1);
            }
          }}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
    </div>
  );
}


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

export function GraphView({ onNodeClick }: { onNodeClick?: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const { width, height } = useDimensions(containerRef);
  const [graphData, setGraphData] = useState<{ nodes: unknown[]; links: unknown[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Theme handling (basic)
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  const loadGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      // Call Rust to get layout
      const data = await api.graph.getData();
      
      // Transform for react-force-graph
      const nodes = data.nodes.map(n => ({ 
        id: n.id,
        title: n.title || n.id.slice(0, 8),  // 使用标题，无标题时用短ID
        cardType: n.cardType || "permanent",
        val: Math.max(n.linkCount + 1, 2),   // 节点大小基于链接数
        linkCount: n.linkCount,
      }));
      
      // Links are already in { source, target } format from the API
      const links = data.links;
      
      setGraphData({ nodes, links } as any);
    } catch (e) {
      console.error("Failed to load graph", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

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
          nodeLabel={(node: any) => `${node.title}\n链接: ${node.linkCount}`}
          nodeColor={(node: any) => {
            const colors = nodeColors[node.cardType] || nodeColors.permanent;
            return isDark ? colors.dark : colors.light;
          }}
          linkColor={() => isDark ? "#ffffff15" : "#cbd5e1"} // 更明显的连接线
          linkWidth={1}
          backgroundColor="transparent" // 透明背景，让网格显示
          onNodeClick={(node: any) => onNodeClick?.(node.id)}
          // Custom painting for professional look
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.title || "无标题";
            const colors = nodeColors[node.cardType] || nodeColors.permanent;
            const nodeColor = isDark ? colors.dark : colors.light;
            
            // 节点大小基于链接数，但有上下限
            const baseR = Math.sqrt(node.val) * 2.5;
            const r = Math.max(4, Math.min(baseR, 16));
            
            // 绘制节点光晕（hover 或重要节点）
            if (node.linkCount > 3) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI, false);
              ctx.fillStyle = isDark 
                ? `${nodeColor}20` 
                : `${nodeColor}15`;
              ctx.fill();
            }
            
            // 绘制节点
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = nodeColor;
            ctx.fill();
            
            // 绘制节点边框
            ctx.strokeStyle = isDark ? "#ffffff30" : "#00000015";
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // 标签显示逻辑：
            // - 缩放 > 1.2 时显示所有标签
            // - 缩放 > 0.8 时显示有链接的节点标签
            // - 否则不显示
            const showLabel = globalScale > 1.2 || (globalScale > 0.8 && node.linkCount > 0);
            
            if (showLabel) {
              // 截断过长的标题
              const maxLen = globalScale > 2 ? 20 : 12;
              const displayLabel = label.length > maxLen 
                ? label.slice(0, maxLen) + "…" 
                : label;
              
              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              
              // 文字阴影/背景
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
              
              // 绘制文字
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


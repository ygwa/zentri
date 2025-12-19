import { useEffect, useState, useRef, useMemo } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useAppStore } from "@/store";

// 节点颜色配置 - 与全局图谱保持一致
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

interface LocalGraphProps {
    centerId: string;
    onNodeClick?: (id: string) => void;
    className?: string;
}

export function LocalGraph({ centerId, onNodeClick, className }: LocalGraphProps) {
    const { cards } = useAppStore();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
    const { width, height } = useDimensions(containerRef);

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Prepare graph data based on centerId
    const graphData = useMemo(() => {
        if (!centerId || cards.length === 0) return { nodes: [], links: [] };

        const centerCard = cards.find(c => c.id === centerId);
        if (!centerCard) return { nodes: [], links: [] };

        // Find direct connections (depth 1)
        const connectedIds = new Set<string>();
        const links: { source: string; target: string }[] = [];

        // 1. Outgoing links
        (centerCard.links || []).forEach(targetId => {
            if (cards.some(c => c.id === targetId)) {
                connectedIds.add(targetId);
                links.push({ source: centerId, target: targetId });
            }
        });

        // 2. Incoming links (backlinks)
        cards.forEach(c => {
            if (c.links?.includes(centerId)) {
                connectedIds.add(c.id);
                links.push({ source: c.id, target: centerId });
            }
        });

        // Create Nodes
        const nodes = [centerCard, ...cards.filter(c => connectedIds.has(c.id))].map(c => ({
            id: c.id,
            title: c.title || c.id.slice(0, 8),
            cardType: c.type || "permanent",
            val: c.id === centerId ? 10 : 3, // Center node is larger
            isCenter: c.id === centerId
        }));

        return { nodes, links };
    }, [centerId, cards]);

    return (
        <div ref={containerRef} className={className || "w-full h-64 bg-zinc-50 border border-zinc-200 rounded-sm relative overflow-hidden"}>
            {(width > 0 && height > 0) && (
                <ForceGraph2D
                    ref={fgRef}
                    width={width}
                    height={height}
                    graphData={graphData as any}
                    nodeLabel={(node: any) => node.title}
                    nodeColor={(node: any) => {
                        const colors = nodeColors[node.cardType] || nodeColors.permanent;
                        return isDark ? colors.dark : colors.light;
                    }}
                    linkColor={() => isDark ? "#ffffff20" : "#cbd5e1"}
                    linkWidth={1.5}
                    backgroundColor="transparent"
                    onNodeClick={(node: any) => onNodeClick?.(node.id)}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                        const label = node.title || "无标题";
                        const colors = nodeColors[node.cardType] || nodeColors.permanent;
                        const nodeColor = isDark ? colors.dark : colors.light;

                        // Draw Node
                        const r = node.isCenter ? 6 : 4;

                        if (node.isCenter) {
                            // Halo for center
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
                            ctx.fillStyle = `${nodeColor}30`;
                            ctx.fill();
                        }

                        ctx.beginPath();
                        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                        ctx.fillStyle = nodeColor;
                        ctx.fill();

                        // Draw Label
                        const fontSize = 10 / globalScale; // Keep text smaller in local graph
                        if (globalScale > 0.8 || node.isCenter) {
                            ctx.font = `500 ${fontSize}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
                            ctx.fillText(label, node.x, node.y + r + 2);
                        }
                    }}
                    cooldownTicks={100}
                    d3AlphaDecay={0.05} // Stablize faster
                    d3VelocityDecay={0.4}
                />
            )}

            {graphData.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                    No connections
                </div>
            )}
        </div>
    );
}

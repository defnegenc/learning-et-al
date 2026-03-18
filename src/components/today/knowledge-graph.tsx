"use client";

import { useMemo, useState, useRef, useCallback } from "react";

interface Interest {
  id: string;
  keyword: string;
  weight: number | null;
  source: "seed" | "star" | "engagement" | "dislike";
}

interface PaperKeyword {
  keyword: string;
  paperId: string;
  paperTitle: string;
}

interface KnowledgeGraphProps {
  interests: Interest[];
  paperKeywords?: PaperKeyword[];
  onNodeClick?: (keyword: string) => void;
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

interface GraphNode {
  id: string;
  keyword: string;
  x: number;
  y: number;
  type: "interest" | "paper";
  active: boolean; // interest that connects to today's papers
  color: string;
}

interface GraphEdge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function KnowledgeGraph({ interests, paperKeywords = [], onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Build nodes: interests on left, paper keywords on right
  const { nodes, edges } = useMemo(() => {
    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];

    // Deduplicate interests
    const seenInterests = new Set<string>();
    const uniqueInterests = interests.filter(i => {
      const key = i.keyword.toLowerCase();
      if (seenInterests.has(key)) return false;
      seenInterests.add(key);
      return true;
    }).slice(0, 7);

    // Deduplicate paper keywords
    const seenPaperKw = new Set<string>();
    const uniquePaperKw = paperKeywords.filter(pk => {
      const key = pk.keyword.toLowerCase();
      if (seenPaperKw.has(key) || seenInterests.has(key)) return false;
      seenPaperKw.add(key);
      return true;
    }).slice(0, 6);

    // Check which interests connect to today's papers
    const paperText = paperKeywords.map(pk => pk.keyword.toLowerCase()).join(" ");

    // Place interest nodes on the left side (15-40% x)
    uniqueInterests.forEach((interest, i) => {
      const h = hash(interest.keyword);
      const ySpacing = 85 / Math.max(uniqueInterests.length - 1, 1);
      const y = 8 + i * ySpacing;
      const x = 10 + ((h % 20));
      const words = interest.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const active = words.some(w => paperText.includes(w));

      allNodes.push({
        id: `int-${interest.keyword}`,
        keyword: interest.keyword.length > 16 ? interest.keyword.slice(0, 15) + "…" : interest.keyword,
        x: Math.max(5, Math.min(35, x)),
        y: Math.max(8, Math.min(90, y)),
        type: "interest",
        active,
        color: active ? "#1a1a1a" : "#ccc",
      });
    });

    // Place paper keyword nodes on the right side (55-90% x)
    uniquePaperKw.forEach((pk, i) => {
      const h = hash(pk.keyword);
      const ySpacing = 85 / Math.max(uniquePaperKw.length - 1, 1);
      const y = 8 + i * ySpacing;
      const x = 58 + ((h % 25));

      allNodes.push({
        id: `pk-${pk.keyword}`,
        keyword: pk.keyword.length > 16 ? pk.keyword.slice(0, 15) + "…" : pk.keyword,
        x: Math.max(55, Math.min(92, x)),
        y: Math.max(8, Math.min(90, y)),
        type: "paper",
        active: true,
        color: PASTEL_COLORS[i % 5],
      });
    });

    // Draw edges: connect paper keywords to interests that share words
    for (const intNode of allNodes.filter(n => n.type === "interest")) {
      const intWords = intNode.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const pkNode of allNodes.filter(n => n.type === "paper")) {
        const pkWords = pkNode.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlap = intWords.some(w => pkWords.some(pw => pw.includes(w) || w.includes(pw)));
        if (overlap) {
          allEdges.push({
            from: intNode.id,
            to: pkNode.id,
            x1: intNode.x, y1: intNode.y,
            x2: pkNode.x, y2: pkNode.y,
          });
        }
      }
    }

    // If no cross-connections, connect nearest interest to nearest paper keyword
    if (allEdges.length === 0 && allNodes.some(n => n.type === "interest") && allNodes.some(n => n.type === "paper")) {
      const ints = allNodes.filter(n => n.type === "interest");
      const pks = allNodes.filter(n => n.type === "paper");
      if (ints.length > 0 && pks.length > 0) {
        allEdges.push({
          from: ints[0].id, to: pks[0].id,
          x1: ints[0].x, y1: ints[0].y,
          x2: pks[0].x, y2: pks[0].y,
        });
      }
    }

    return { nodes: allNodes, edges: allEdges };
  }, [interests, paperKeywords]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.5, Math.min(2.5, z - e.deltaY * 0.002)));
  }, []);

  // Highlight connected edges when hovering a node
  const connectedEdges = hoveredNode
    ? new Set(edges.filter(e => e.from === hoveredNode || e.to === hoveredNode).map((_, i) => i))
    : null;

  if (nodes.length === 0) {
    return (
      <div
        className="w-full md:w-[360px] h-[200px] md:h-[260px]"
        style={{ border: "1.5px solid #1a1a1a", background: "rgba(245,245,245,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: "0.65rem", color: "#999" }}>No data yet</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full md:w-[360px] h-[200px] md:h-[260px]"
      style={{
        position: "relative",
        border: "1.5px solid #1a1a1a",
        background: "rgba(250,250,250,0.97)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Column labels */}
      <div style={{ position: "absolute", top: "4px", left: "8px", zIndex: 10, pointerEvents: "none" }}>
        <span style={{ fontSize: "0.45rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace" }}>
          Your interests
        </span>
      </div>
      <div style={{ position: "absolute", top: "4px", right: "8px", zIndex: 10, pointerEvents: "none" }}>
        <span style={{ fontSize: "0.45rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace" }}>
          Today's topics
        </span>
      </div>

      {/* Center divider line */}
      <div style={{ position: "absolute", left: "47%", top: "16px", bottom: "4px", width: "1px", background: "rgba(0,0,0,0.06)", zIndex: 1 }} />

      {/* Pannable content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: dragging ? "none" : "transform 0.1s ease-out",
        }}
      >
        {/* Edges */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }}>
          {edges.map((edge, i) => (
            <line
              key={i}
              x1={`${edge.x1}%`} y1={`${edge.y1}%`}
              x2={`${edge.x2}%`} y2={`${edge.y2}%`}
              stroke={connectedEdges?.has(i) ? "#1a1a1a" : "rgba(26,26,26,0.15)"}
              strokeWidth={connectedEdges?.has(i) ? "1.5" : "0.8"}
              strokeDasharray={connectedEdges?.has(i) ? "none" : "3,3"}
            />
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          const isConnectedToHovered = hoveredNode && edges.some(
            e => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id)
          );
          const dimmed = hoveredNode && !isHovered && !isConnectedToHovered;

          return (
            <div
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => { e.stopPropagation(); onNodeClick?.(node.keyword); }}
              style={{
                position: "absolute",
                top: `${node.y}%`,
                left: `${node.x}%`,
                transform: "translate(-50%, -50%)",
                zIndex: isHovered ? 10 : 5,
                cursor: "pointer",
                transition: "opacity 0.15s ease, transform 0.1s ease",
                opacity: dimmed ? 0.3 : 1,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: node.type === "paper" ? "3px 8px" : "2px 7px",
                  background: node.type === "paper"
                    ? (isHovered ? "#1a1a1a" : node.color)
                    : (node.active
                      ? (isHovered ? "#1a1a1a" : "white")
                      : (isHovered ? "#1a1a1a" : "#f5f5f5")),
                  color: isHovered ? "white" : "#1a1a1a",
                  border: `1px solid ${node.active || node.type === "paper" ? "#1a1a1a" : "rgba(26,26,26,0.25)"}`,
                  fontSize: node.type === "paper" ? "0.5rem" : "0.48rem",
                  fontWeight: node.active || node.type === "paper" ? 600 : 400,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  whiteSpace: "nowrap",
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                }}
              >
                {node.keyword}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <span style={{ position: "absolute", bottom: "3px", right: "6px", fontSize: "0.4rem", color: "#ccc", fontFamily: "var(--font-mono), monospace", zIndex: 10, pointerEvents: "none" }}>
        scroll to zoom / drag to pan
      </span>
    </div>
  );
}

"use client";

import { useMemo, useState, useRef, useCallback } from "react";

interface Interest {
  id: string;
  keyword: string;
  weight: number | null;
  source: "seed" | "star" | "engagement" | "dislike";
}

interface KnowledgeGraphProps {
  interests: Interest[];
  onNodeClick?: (keyword: string) => void;
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

// Deterministic spread based on keyword hash
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const nodes = useMemo(() => {
    const items = interests.slice(0, 12);
    if (items.length === 0) return [];

    // Spread nodes in a wider space for panning
    return items.map((interest, i) => {
      const h = hash(interest.keyword);
      // Distribute in a 200x150 virtual space
      const cols = Math.ceil(Math.sqrt(items.length));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const totalRows = Math.ceil(items.length / cols);

      const baseX = 15 + (col / Math.max(cols - 1, 1)) * 70;
      const baseY = 15 + (row / Math.max(totalRows - 1, 1)) * 60;
      const offsetX = ((h % 16) - 8) * 0.6;
      const offsetY = (((h >> 3) % 16) - 8) * 0.5;

      return {
        keyword: interest.keyword.length > 20 ? interest.keyword.slice(0, 19) + "\u2026" : interest.keyword,
        fullKeyword: interest.keyword,
        x: Math.max(8, Math.min(92, baseX + offsetX)),
        y: Math.max(8, Math.min(88, baseY + offsetY)),
        color: PASTEL_COLORS[i % 5],
        isNew: interest.source === "star",
      };
    });
  }, [interests]);

  // Connect each node to 1-2 nearest neighbors
  const connections = useMemo(() => {
    if (nodes.length < 2) return [];
    const edges = new Set<string>();
    const result: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const sorted = nodes
        .map((n, j) => ({ j, d: distance(nodes[i].x, nodes[i].y, n.x, n.y) }))
        .filter(o => o.j !== i)
        .sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(2, sorted.length); k++) {
        const j = sorted[k].j;
        const key = [Math.min(i, j), Math.max(i, j)].join("-");
        if (!edges.has(key)) {
          edges.add(key);
          result.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y });
        }
      }
    }
    return result;
  }, [nodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.5, Math.min(2.5, z - e.deltaY * 0.002)));
  }, []);

  if (interests.length === 0) {
    return (
      <div
        className="w-full md:w-[320px] h-[180px] md:h-[240px]"
        style={{ border: "1.5px solid #1a1a1a", background: "rgba(245,245,245,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "1px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
          No data
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full md:w-[320px] h-[180px] md:h-[240px]"
      style={{
        position: "relative",
        border: "1.5px solid #1a1a1a",
        background: "rgba(245,245,245,0.95)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Blobs */}
      <div style={{ position: "absolute", width: "140px", height: "140px", background: "#7700ff", borderRadius: "50%", filter: "blur(60px)", opacity: 0.15, top: "-20px", right: "-10px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "120px", height: "120px", background: "#38b000", borderRadius: "50%", filter: "blur(50px)", opacity: 0.12, bottom: "-10px", left: "10px", pointerEvents: "none" }} />

      {/* Pannable/zoomable content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: dragging ? "none" : "transform 0.1s ease-out",
        }}
      >
        {/* Connection lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }}>
          {connections.map((c, i) => (
            <line key={i} x1={`${c.x1}%`} y1={`${c.y1}%`} x2={`${c.x2}%`} y2={`${c.y2}%`} stroke="#1a1a1a" strokeWidth="1" opacity="0.6" />
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.fullKeyword}
            onClick={(e) => { e.stopPropagation(); onNodeClick?.(node.fullKeyword); }}
            style={{
              position: "absolute",
              background: node.isNew ? node.color : "#f5f5f5",
              border: `1px solid ${node.isNew ? "#1a1a1a" : "rgba(26,26,26,0.6)"}`,
              padding: "3px 8px",
              fontSize: "0.5rem",
              fontWeight: node.isNew ? 600 : 400,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              zIndex: 5,
              whiteSpace: "nowrap",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              top: `${node.y}%`,
              left: `${node.x}%`,
              transform: "translate(-50%, -50%)",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = node.isNew ? node.color : "#f5f5f5"; (e.currentTarget as HTMLElement).style.color = "#1a1a1a"; }}
          >
            {node.keyword}
          </div>
        ))}
      </div>

      {/* Zoom hint */}
      <span
        style={{
          position: "absolute",
          bottom: "4px",
          right: "6px",
          fontSize: "0.45rem",
          color: "#bbb",
          fontFamily: "var(--font-mono), monospace",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        scroll to zoom / drag to pan
      </span>
    </div>
  );
}

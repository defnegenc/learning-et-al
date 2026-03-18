"use client";

import { useMemo, useState } from "react";

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

export function KnowledgeGraph({ interests, paperKeywords = [], onNodeClick }: KnowledgeGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Deduplicate interests
  const uniqueInterests = useMemo(() => {
    const seen = new Set<string>();
    return interests.filter(i => {
      const key = i.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [interests]);

  // Which interests are "active" (connected to today's papers)
  const activeInterests = useMemo(() => {
    const active = new Set<string>();
    const pkText = paperKeywords.map(pk => pk.keyword.toLowerCase()).join(" ");
    for (const interest of uniqueInterests) {
      const words = interest.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.some(w => pkText.includes(w))) {
        active.add(interest.keyword);
      }
    }
    return active;
  }, [uniqueInterests, paperKeywords]);

  // Position interest nodes spread across the box
  const nodes = useMemo(() => {
    return uniqueInterests.map((interest, i) => {
      const h = hash(interest.keyword);
      const cols = Math.ceil(Math.sqrt(uniqueInterests.length));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const totalRows = Math.ceil(uniqueInterests.length / cols);

      const baseX = 12 + (col / Math.max(cols - 1, 1)) * 76;
      const baseY = 14 + (row / Math.max(totalRows - 1, 1)) * 68;
      const ox = ((h % 12) - 6) * 0.6;
      const oy = (((h >> 3) % 12) - 6) * 0.5;

      return {
        keyword: interest.keyword,
        label: interest.keyword.length > 18 ? interest.keyword.slice(0, 17) + "…" : interest.keyword,
        x: Math.max(8, Math.min(92, baseX + ox)),
        y: Math.max(10, Math.min(88, baseY + oy)),
        active: activeInterests.has(interest.keyword),
      };
    });
  }, [uniqueInterests, activeInterests]);

  // Edges: connect active interests to each other
  const edges = useMemo(() => {
    const activeNodes = nodes.filter(n => n.active);
    const result: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        result.push({
          x1: activeNodes[i].x, y1: activeNodes[i].y,
          x2: activeNodes[j].x, y2: activeNodes[j].y,
        });
      }
    }
    return result;
  }, [nodes]);

  // Which edges connect to hovered node
  const hoveredEdges = hoveredNode
    ? new Set(edges.map((e, i) => {
        const hNode = nodes.find(n => n.keyword === hoveredNode);
        if (!hNode) return -1;
        if (Math.abs(e.x1 - hNode.x) < 1 && Math.abs(e.y1 - hNode.y) < 1) return i;
        if (Math.abs(e.x2 - hNode.x) < 1 && Math.abs(e.y2 - hNode.y) < 1) return i;
        return -1;
      }).filter(i => i >= 0))
    : null;

  if (nodes.length === 0) {
    return (
      <div
        className="w-full md:w-[360px] h-[200px] md:h-[260px]"
        style={{ border: "1.5px solid rgba(26,26,26,0.15)", background: "rgba(250,250,250,0.97)", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: "0.65rem", color: "#ccc" }}>No data yet</span>
      </div>
    );
  }

  return (
    <div
      className="w-full md:w-[360px] h-[200px] md:h-[260px]"
      style={{
        position: "relative",
        border: "1.5px solid rgba(26,26,26,0.15)",
        background: "rgba(250,250,250,0.97)",
        overflow: "hidden",
      }}
    >
      {/* Edges between active nodes */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={`${edge.x1}%`} y1={`${edge.y1}%`}
            x2={`${edge.x2}%`} y2={`${edge.y2}%`}
            stroke={hoveredEdges?.has(i) ? "#1a1a1a" : "rgba(26,26,26,0.1)"}
            strokeWidth={hoveredEdges?.has(i) ? "1.5" : "0.8"}
          />
        ))}
      </svg>

      {/* Interest nodes */}
      {nodes.map((node, i) => {
        const isHovered = hoveredNode === node.keyword;
        const dimmed = hoveredNode && !isHovered && !node.active;

        return (
          <div
            key={node.keyword}
            onMouseEnter={() => setHoveredNode(node.keyword)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => onNodeClick?.(node.keyword)}
            style={{
              position: "absolute",
              top: `${node.y}%`,
              left: `${node.x}%`,
              transform: "translate(-50%, -50%)",
              zIndex: isHovered ? 10 : 5,
              cursor: "pointer",
              opacity: dimmed ? 0.25 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "3px 9px",
                background: isHovered ? "#1a1a1a"
                  : node.active ? PASTEL_COLORS[i % 5]
                  : "#f5f5f5",
                color: isHovered ? "white" : node.active ? "#1a1a1a" : "#bbb",
                border: `1px solid ${node.active ? "rgba(26,26,26,0.4)" : "rgba(26,26,26,0.1)"}`,
                fontSize: "0.5rem",
                fontWeight: node.active ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
              }}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

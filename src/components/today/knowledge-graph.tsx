"use client";

import { useMemo } from "react";

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

// Predefined positions as percentages
const POSITIONS = [
  { xPct: 15, yPct: 20 },
  { xPct: 55, yPct: 45 },
  { xPct: 65, yPct: 15 },
  { xPct: 25, yPct: 65 },
  { xPct: 10, yPct: 80 },
  { xPct: 70, yPct: 78 },
];

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

function angleDeg(ax: number, ay: number, bx: number, by: number) {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  // Use percentage-based positions for responsive layout
  const nodes = useMemo(() => {
    const items = interests.slice(0, 6);
    if (items.length === 0) return [];

    return items.map((interest, i) => {
      const pos = POSITIONS[i % POSITIONS.length];
      return {
        keyword:
          interest.keyword.length > 18
            ? interest.keyword.slice(0, 17) + "\u2026"
            : interest.keyword,
        fullKeyword: interest.keyword,
        xPct: pos.xPct,
        yPct: pos.yPct,
      };
    });
  }, [interests]);

  if (interests.length === 0) {
    return (
      <div
        className="w-full md:w-[320px] h-[180px] md:h-[240px]"
        style={{
          border: "1.5px solid #1a1a1a",
          background: "rgba(245, 245, 245, 0.95)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontSize: "0.55rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "#888",
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          No data
        </span>
      </div>
    );
  }

  return (
    <div
      className="w-full md:w-[320px] h-[180px] md:h-[240px]"
      style={{
        position: "relative",
        border: "1.5px solid #1a1a1a",
        background: "rgba(245, 245, 245, 0.95)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      {/* Blobs */}
      <div
        style={{
          position: "absolute",
          width: "140px",
          height: "140px",
          background: "#7700ff",
          borderRadius: "50%",
          filter: "blur(60px)",
          opacity: 0.15,
          top: "-20px",
          right: "-10px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "120px",
          height: "120px",
          background: "#38b000",
          borderRadius: "50%",
          filter: "blur(50px)",
          opacity: 0.12,
          bottom: "-10px",
          left: "10px",
          pointerEvents: "none",
        }}
      />

      {/* Connection lines using SVG for responsive sizing */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {nodes.length >= 2 && (() => {
          const edges = new Set<string>();
          const lines: { ax: number; ay: number; bx: number; by: number }[] = [];
          for (let i = 0; i < nodes.length; i++) {
            const others = nodes
              .map((n, j) => ({
                j,
                dist: distance(nodes[i].xPct, nodes[i].yPct, n.xPct, n.yPct),
              }))
              .filter((o) => o.j !== i)
              .sort((a, b) => a.dist - b.dist);
            const connectCount = Math.min(2, others.length);
            for (let k = 0; k < connectCount; k++) {
              const j = others[k].j;
              const key = [Math.min(i, j), Math.max(i, j)].join("-");
              if (!edges.has(key)) {
                edges.add(key);
                lines.push({
                  ax: nodes[i].xPct,
                  ay: nodes[i].yPct,
                  bx: nodes[j].xPct,
                  by: nodes[j].yPct,
                });
              }
            }
          }
          return lines.map((conn, idx) => (
            <line
              key={`line-${idx}`}
              x1={`${conn.ax}%`}
              y1={`${conn.ay}%`}
              x2={`${conn.bx}%`}
              y2={`${conn.by}%`}
              stroke="#1a1a1a"
              strokeWidth="1.5"
              opacity="0.8"
            />
          ));
        })()}
      </svg>

      {/* Keyword nodes */}
      {nodes.map((node) => (
        <div
          key={node.fullKeyword}
          onClick={() => onNodeClick?.(node.fullKeyword)}
          style={{
            position: "absolute",
            background: "#f5f5f5",
            border: "1px solid #1a1a1a",
            padding: "2px 8px",
            fontSize: "0.55rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            zIndex: 5,
            whiteSpace: "nowrap",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            top: `${node.yPct}%`,
            left: `${node.xPct}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {node.keyword}
        </div>
      ))}
    </div>
  );
}

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

const CONTAINER_W = 320;
const CONTAINER_H = 240;

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
        cx: (pos.xPct / 100) * CONTAINER_W,
        cy: (pos.yPct / 100) * CONTAINER_H,
      };
    });
  }, [interests]);

  // Build connections: each node connects to its 1-2 nearest neighbors
  const connections = useMemo(() => {
    if (nodes.length < 2) return [];
    const edges = new Set<string>();
    const result: { ax: number; ay: number; bx: number; by: number }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      // Sort other nodes by distance
      const others = nodes
        .map((n, j) => ({ j, dist: distance(nodes[i].cx, nodes[i].cy, n.cx, n.cy) }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.dist - b.dist);

      // Connect to nearest 1-2
      const connectCount = Math.min(2, others.length);
      for (let k = 0; k < connectCount; k++) {
        const j = others[k].j;
        const key = [Math.min(i, j), Math.max(i, j)].join("-");
        if (!edges.has(key)) {
          edges.add(key);
          result.push({
            ax: nodes[i].cx,
            ay: nodes[i].cy,
            bx: nodes[j].cx,
            by: nodes[j].cy,
          });
        }
      }
    }
    return result;
  }, [nodes]);

  if (interests.length === 0) {
    return (
      <div
        style={{
          width: `${CONTAINER_W}px`,
          height: `${CONTAINER_H}px`,
          border: "1.5px solid #1a1a1a",
          background: "rgba(232, 232, 232, 0.9)",
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
          NO_DATA
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: `${CONTAINER_W}px`,
        height: `${CONTAINER_H}px`,
        border: "1.5px solid #1a1a1a",
        background: "rgba(232, 232, 232, 0.9)",
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

      {/* Connection lines between nodes */}
      {connections.map((conn, idx) => {
        const dist = distance(conn.ax, conn.ay, conn.bx, conn.by);
        const angle = angleDeg(conn.ax, conn.ay, conn.bx, conn.by);
        return (
          <div
            key={`line-${idx}`}
            style={{
              position: "absolute",
              borderTop: "1.5px solid #1a1a1a",
              transformOrigin: "0 0",
              zIndex: 2,
              opacity: 0.8,
              top: `${conn.ay}px`,
              left: `${conn.ax}px`,
              width: `${dist}px`,
              transform: `rotate(${angle}deg)`,
            }}
          />
        );
      })}

      {/* Keyword nodes */}
      {nodes.map((node) => (
        <div
          key={node.fullKeyword}
          onClick={() => onNodeClick?.(node.fullKeyword)}
          style={{
            position: "absolute",
            background: "#e8e8e8",
            border: "1px solid #1a1a1a",
            padding: "2px 8px",
            fontSize: "0.55rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            zIndex: 5,
            whiteSpace: "nowrap",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            cursor: "crosshair",
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

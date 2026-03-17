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

// Deterministic position from keyword string
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  const nodes = useMemo(() => {
    const items = interests.slice(0, 8);
    if (items.length === 0) return [];

    // Spread nodes evenly across the space with deterministic offsets
    return items.map((interest, i) => {
      const cols = Math.ceil(Math.sqrt(items.length));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const totalRows = Math.ceil(items.length / cols);

      // Base grid position (15-85% range)
      const baseX = 15 + (col / Math.max(cols - 1, 1)) * 70;
      const baseY = 15 + (row / Math.max(totalRows - 1, 1)) * 60;

      // Small deterministic offset so it doesn't look like a rigid grid
      const h = hash(interest.keyword);
      const offsetX = ((h % 20) - 10) * 0.8;
      const offsetY = (((h >> 4) % 20) - 10) * 0.6;

      return {
        x: Math.max(12, Math.min(88, baseX + offsetX)),
        y: Math.max(12, Math.min(78, baseY + offsetY)),
        keyword: interest.keyword,
      };
    });
  }, [interests]);

  // Connect every node to its nearest 1-2 neighbors
  const connections = useMemo(() => {
    const conns: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      // Find nearest neighbor
      let minDist = Infinity;
      let nearest = -1;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearest = j;
        }
      }
      if (nearest >= 0 && nearest > i) {
        conns.push({
          x1: nodes[i].x,
          y1: nodes[i].y,
          x2: nodes[nearest].x,
          y2: nodes[nearest].y,
        });
      }
    }
    return conns;
  }, [nodes]);

  if (interests.length === 0) {
    return (
      <div
        className="border border-[#1a1a1a] overflow-hidden"
        style={{
          borderWidth: "1.5px",
          width: "320px",
          height: "240px",
          background: "rgba(232, 232, 232, 0.9)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <div className="flex items-center justify-center h-full">
          <span
            className="text-[0.55rem] uppercase tracking-[2px] text-[#555]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            NO_DATA
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative border border-[#1a1a1a] overflow-hidden"
      style={{
        borderWidth: "1.5px",
        width: "320px",
        height: "240px",
        background: "rgba(232, 232, 232, 0.9)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      {/* Blobs — contained inside this box only */}
      <div className="absolute pointer-events-none" style={{ width: "140px", height: "140px", background: "#7700ff", borderRadius: "50%", filter: "blur(60px)", opacity: 0.12, top: "-20px", right: "-10px" }} />
      <div className="absolute pointer-events-none" style={{ width: "120px", height: "120px", background: "#38b000", borderRadius: "50%", filter: "blur(50px)", opacity: 0.1, bottom: "-10px", left: "10px" }} />
      <svg
        viewBox="0 0 100 90"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Connection lines */}
        {connections.map((conn, idx) => (
          <line
            key={idx}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke="#1a1a1a"
            strokeWidth="0.3"
            opacity={0.8}
          />
        ))}

        {/* Keyword nodes — just a bordered label, nothing else */}
        {nodes.map((node) => {
          const label = node.keyword.length > 16
            ? node.keyword.slice(0, 15) + "\u2026"
            : node.keyword;
          const boxW = label.length * 1.3 + 3;

          return (
            <g
              key={node.keyword}
              onClick={() => onNodeClick?.(node.keyword)}
              style={{ cursor: "crosshair" }}
            >
              <rect
                x={node.x - boxW / 2}
                y={node.y - 1.8}
                width={boxW}
                height={3.6}
                fill="#e8e8e8"
                stroke="#1a1a1a"
                strokeWidth="0.15"
              />
              <text
                x={node.x}
                y={node.y + 0.8}
                textAnchor="middle"
                fontSize={1.4}
                fontFamily="Courier New, Courier, monospace"
                fill="#1a1a1a"
                letterSpacing="0.3"
                style={{ textTransform: "uppercase" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

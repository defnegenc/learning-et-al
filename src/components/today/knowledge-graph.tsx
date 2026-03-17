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

const SOURCE_COLORS: Record<string, string> = {
  seed: "#7700ff",
  star: "#ffcc00",
  engagement: "#38b000",
  dislike: "#555555",
};

interface NodePosition {
  x: number;
  y: number;
  keyword: string;
  color: string;
  size: number;
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  const nodes = useMemo(() => {
    if (interests.length === 0) return [];

    const maxWeight = Math.max(...interests.map((i) => i.weight ?? 1));
    const cx = 50;
    const cy = 45;
    const layoutRadius = 32;

    return interests.slice(0, 12).map((interest, idx, arr): NodePosition => {
      const angle = (2 * Math.PI * idx) / arr.length - Math.PI / 2;
      const w = interest.weight ?? 1;
      const size = 0.5 + (w / maxWeight) * 0.5;
      return {
        x: cx + layoutRadius * Math.cos(angle),
        y: cy + layoutRadius * Math.sin(angle),
        keyword: interest.keyword,
        color: SOURCE_COLORS[interest.source] ?? SOURCE_COLORS.dislike,
        size,
      };
    });
  }, [interests]);

  // Generate connections between nearby nodes
  const connections = useMemo(() => {
    const conns: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 50) {
          conns.push({
            x1: nodes[i].x,
            y1: nodes[i].y,
            x2: nodes[j].x,
            y2: nodes[j].y,
          });
        }
      }
    }
    return conns;
  }, [nodes]);

  return (
    <div
      className="border border-[#1a1a1a] relative overflow-hidden"
      style={{ borderWidth: "1.5px", height: "100%", width: "100%", background: "#f0f0f0" }}
    >
      {/* Header */}
      <div
        className="border-b border-[#1a1a1a] px-3 py-1.5"
        style={{ borderBottomWidth: "1.5px" }}
      >
        <h3
          className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          KNOWLEDGE_GRAPH // NODE_MAP
        </h3>
      </div>

      {/* Graph area */}
      <div className="relative" style={{ height: "calc(100% - 30px)" }}>
        {/* Aura blobs - ONLY place these appear */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "180px",
            height: "180px",
            background: "#38b000",
            borderRadius: "50%",
            filter: "blur(60px)",
            opacity: 0.15,
            top: "5%",
            left: "8%",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: "150px",
            height: "150px",
            background: "#ff007f",
            borderRadius: "50%",
            filter: "blur(55px)",
            opacity: 0.12,
            bottom: "8%",
            right: "8%",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: "120px",
            height: "120px",
            background: "#7700ff",
            borderRadius: "50%",
            filter: "blur(45px)",
            opacity: 0.1,
            top: "45%",
            left: "45%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {interests.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-[0.65rem] uppercase tracking-[2px] text-[#555]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              NO_INTERESTS_FOUND
            </span>
          </div>
        ) : (
          <svg
            viewBox="0 0 100 90"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Connection lines - dashed */}
            {connections.map((conn, idx) => (
              <line
                key={idx}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke="#1a1a1a"
                strokeWidth="0.15"
                strokeDasharray="0.8,0.8"
                opacity="0.3"
              />
            ))}

            {/* Nodes */}
            {nodes.map((node) => (
              <g
                key={node.keyword}
                onClick={() => onNodeClick?.(node.keyword)}
                style={{ cursor: "crosshair" }}
              >
                {/* Node dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={1.5 * node.size + 1}
                  fill={node.color}
                  opacity={0.7}
                />
                {/* Node label box */}
                <rect
                  x={node.x - 9}
                  y={node.y + 2}
                  width={18}
                  height={4.5}
                  fill="#f0f0f0"
                  stroke="#1a1a1a"
                  strokeWidth="0.15"
                />
                {/* Label text */}
                <text
                  x={node.x}
                  y={node.y + 5.2}
                  textAnchor="middle"
                  fontSize="1.8"
                  fontFamily="Courier New, Courier, monospace"
                  fill="#1a1a1a"
                  letterSpacing="0.5"
                  style={{ textTransform: "uppercase" }}
                >
                  {node.keyword.length > 12
                    ? node.keyword.slice(0, 11) + "\u2026"
                    : node.keyword}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

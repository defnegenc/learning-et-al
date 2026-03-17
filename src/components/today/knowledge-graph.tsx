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

// Deterministic hash for consistent positioning based on keyword text
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Group keywords into semantic clusters by first letter ranges for a rough grouping
function getClusterIndex(keyword: string): number {
  const first = keyword.toLowerCase().charCodeAt(0);
  if (first < 103) return 0; // a-f
  if (first < 110) return 1; // g-m
  if (first < 116) return 2; // n-s
  return 3; // t-z
}

interface NodePosition {
  x: number;
  y: number;
  keyword: string;
  color: string;
  size: number;
  weight: number;
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  const nodes = useMemo(() => {
    if (interests.length === 0) return [];

    const maxWeight = Math.max(...interests.map((i) => i.weight ?? 1));
    const minWeight = Math.min(...interests.map((i) => i.weight ?? 1));
    const weightRange = maxWeight - minWeight || 1;

    // Define cluster centers in the viewBox (100x90)
    const clusterCenters = [
      { x: 25, y: 25 },  // top-left
      { x: 75, y: 25 },  // top-right
      { x: 25, y: 65 },  // bottom-left
      { x: 75, y: 65 },  // bottom-right
    ];

    return interests.slice(0, 12).map((interest): NodePosition => {
      const w = interest.weight ?? 1;
      const normalizedWeight = (w - minWeight) / weightRange;
      // Size scales from 0.5 to 1.0 based on weight
      const size = 0.5 + normalizedWeight * 0.5;

      // Position based on keyword cluster + deterministic offset from hash
      const cluster = getClusterIndex(interest.keyword);
      const center = clusterCenters[cluster];
      const h = hashString(interest.keyword);
      // Spread within cluster: heavier nodes closer to center
      const spreadRadius = 12 * (1 - normalizedWeight * 0.4);
      const angle = ((h % 360) * Math.PI) / 180;
      const dist = (h % 100) / 100 * spreadRadius;

      const x = Math.max(12, Math.min(88, center.x + dist * Math.cos(angle)));
      const y = Math.max(10, Math.min(80, center.y + dist * Math.sin(angle)));

      return {
        x,
        y,
        keyword: interest.keyword,
        color: SOURCE_COLORS[interest.source] ?? SOURCE_COLORS.dislike,
        size,
        weight: w,
      };
    });
  }, [interests]);

  // Generate connections between nodes that share similar keywords (same cluster)
  const connections = useMemo(() => {
    const conns: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        // Connect nodes in the same cluster (they likely share papers)
        const clusterI = getClusterIndex(nodes[i].keyword);
        const clusterJ = getClusterIndex(nodes[j].keyword);
        if (clusterI === clusterJ) {
          conns.push({
            x1: nodes[i].x,
            y1: nodes[i].y,
            x2: nodes[j].x,
            y2: nodes[j].y,
            opacity: 0.8,
          });
        }
        // Also connect adjacent clusters for cross-links
        else if (Math.abs(clusterI - clusterJ) === 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 35) {
            conns.push({
              x1: nodes[i].x,
              y1: nodes[i].y,
              x2: nodes[j].x,
              y2: nodes[j].y,
              opacity: 0.8,
            });
          }
        }
      }
    }
    return conns;
  }, [nodes]);

  return (
    <div
      className="border border-[#1a1a1a] overflow-hidden"
      style={{
        borderWidth: "1.5px",
        width: "320px",
        height: "240px",
        background: "rgba(232, 232, 232, 0.9)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* Header */}
      <div
        className="border-b border-[#1a1a1a] px-3 py-1.5"
        style={{ borderBottomWidth: "1.5px" }}
      >
        <h3
          className="text-[0.55rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          KNOWLEDGE_GRAPH // NODE_MAP
        </h3>
      </div>

      {/* Graph area */}
      <div className="relative" style={{ height: "calc(100% - 30px)" }}>
        {interests.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-[0.55rem] uppercase tracking-[2px] text-[#555]"
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
            {/* Connection lines - solid 1.5px */}
            {connections.map((conn, idx) => (
              <line
                key={idx}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke="#1a1a1a"
                strokeWidth="0.3"
                opacity={conn.opacity}
              />
            ))}

            {/* Nodes */}
            {nodes.map((node) => {
              const labelLen = Math.min(node.keyword.length, 14);
              const boxWidth = labelLen * 1.4 + 3;
              const fontSize = 1.2 + node.size * 0.4;
              const dotRadius = 1.0 * node.size + 0.6;

              return (
                <g
                  key={node.keyword}
                  onClick={() => onNodeClick?.(node.keyword)}
                  style={{ cursor: "crosshair" }}
                >
                  {/* Node dot - sized by weight */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={dotRadius}
                    fill={node.color}
                    opacity={0.7 + node.size * 0.2}
                  />
                  {/* Node label box - sized to content */}
                  <rect
                    x={node.x - boxWidth / 2}
                    y={node.y + dotRadius + 0.5}
                    width={boxWidth}
                    height={3.5}
                    fill="rgba(232,232,232,0.9)"
                    stroke="#1a1a1a"
                    strokeWidth="0.15"
                  />
                  {/* Label text - small 0.55rem equivalent */}
                  <text
                    x={node.x}
                    y={node.y + dotRadius + 3.2}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontFamily="Courier New, Courier, monospace"
                    fill="#1a1a1a"
                    letterSpacing="0.4"
                    style={{ textTransform: "uppercase" }}
                  >
                    {node.keyword.length > 14
                      ? node.keyword.slice(0, 13) + "\u2026"
                      : node.keyword}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

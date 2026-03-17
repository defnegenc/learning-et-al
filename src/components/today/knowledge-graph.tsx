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
    const items = interests.slice(0, 6);
    if (items.length === 0) return [];

    // Predefined positions that look good in a 320x240 box
    // Spread across the space, avoiding edges
    const positions = [
      { top: "20%", left: "15%" },
      { top: "45%", left: "55%" },
      { top: "15%", left: "65%" },
      { bottom: "25%", left: "25%" },
      { top: "65%", left: "10%" },
      { bottom: "15%", left: "65%" },
    ];

    return items.map((interest, i) => ({
      keyword: interest.keyword.length > 18
        ? interest.keyword.slice(0, 17) + "…"
        : interest.keyword,
      fullKeyword: interest.keyword,
      position: positions[i % positions.length],
    }));
  }, [interests]);

  // Predefined connection lines that create a natural-looking graph
  const lines = useMemo(() => {
    if (nodes.length < 2) return [];
    const conns = [
      { top: "24%", left: "28%", width: "100px", rotate: "25deg" },
      { top: "48%", left: "58%", width: "80px", rotate: "145deg" },
      { top: "68%", left: "22%", width: "90px", rotate: "-10deg" },
      { top: "22%", left: "35%", width: "90px", rotate: "-5deg" },
    ];
    return conns.slice(0, Math.min(nodes.length - 1, conns.length));
  }, [nodes]);

  if (interests.length === 0) {
    return (
      <div
        style={{
          width: "320px",
          height: "240px",
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
        width: "320px",
        height: "240px",
        border: "1.5px solid #1a1a1a",
        background: "rgba(232, 232, 232, 0.9)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      {/* Blobs — inside this box only */}
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

      {/* Connection lines */}
      {lines.map((line, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            borderTop: "1.5px solid #1a1a1a",
            transformOrigin: "0 0",
            zIndex: 2,
            opacity: 0.8,
            top: line.top,
            left: line.left,
            width: line.width,
            transform: `rotate(${line.rotate})`,
          }}
        />
      ))}

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
            ...node.position,
          }}
        >
          {node.keyword}
        </div>
      ))}
    </div>
  );
}

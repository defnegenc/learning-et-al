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

const PASTEL_COLORS = ["#bbf7d0", "#fbcfe8", "#e9d5ff", "#bfdbfe", "#fef08a"];

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

  // Which interests connect to today's papers, and what paper keywords they connect to
  const connections = useMemo(() => {
    const map = new Map<string, string[]>(); // interest keyword -> paper keywords that match
    const pkWords = paperKeywords.map(pk => ({
      keyword: pk.keyword,
      words: pk.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3),
    }));

    for (const interest of uniqueInterests) {
      const intWords = interest.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matched: string[] = [];
      for (const pk of pkWords) {
        const overlap = intWords.some(w => pk.words.some(pw => pw.includes(w) || w.includes(pw)));
        if (overlap && !matched.includes(pk.keyword)) {
          matched.push(pk.keyword);
        }
      }
      if (matched.length > 0) {
        map.set(interest.keyword, matched);
      }
    }
    return map;
  }, [uniqueInterests, paperKeywords]);

  // Position nodes tightly
  const nodes = useMemo(() => {
    return uniqueInterests.map((interest, i) => {
      const h = hash(interest.keyword);
      const cols = Math.min(3, Math.ceil(Math.sqrt(uniqueInterests.length)));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const totalRows = Math.ceil(uniqueInterests.length / cols);

      const baseX = 20 + (col / Math.max(cols - 1, 1)) * 55;
      const baseY = 20 + (row / Math.max(totalRows - 1, 1)) * 50;
      const ox = ((h % 6) - 3) * 0.5;
      const oy = (((h >> 3) % 6) - 3) * 0.4;

      return {
        keyword: interest.keyword,
        label: interest.keyword.length > 16 ? interest.keyword.slice(0, 15) + "\u2026" : interest.keyword,
        x: Math.max(10, Math.min(90, baseX + ox)),
        y: Math.max(12, Math.min(85, baseY + oy)),
        active: connections.has(interest.keyword),
        paperTopics: connections.get(interest.keyword) || [],
      };
    });
  }, [uniqueInterests, connections]);

  // Edges — connect each node to its nearest neighbor
  const edges = useMemo(() => {
    if (nodes.length < 2) return [];
    const result: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const used = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      let minDist = Infinity;
      let nearest = -1;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) { minDist = d; nearest = j; }
      }
      if (nearest >= 0) {
        const key = [Math.min(i, nearest), Math.max(i, nearest)].join("-");
        if (!used.has(key)) {
          used.add(key);
          result.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[nearest].x, y2: nodes[nearest].y });
        }
      }
    }
    return result;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div
        className="w-full md:w-[360px] h-[200px] md:h-[260px]"
        style={{
          border: "4px solid #1a1a1a",
          background: "white",
          backgroundImage: "radial-gradient(#e5e7eb 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span style={{ fontSize: "0.65rem", color: "#ccc", fontFamily: "var(--font-mono), monospace" }}>No data yet</span>
      </div>
    );
  }

  return (
    <div
      className="w-full md:w-[360px] h-[200px] md:h-[260px]"
      style={{
        position: "relative",
        border: "4px solid #1a1a1a",
        background: "white",
        backgroundImage: "radial-gradient(#e5e7eb 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
        overflow: "hidden",
      }}
    >
      {/* Blobs — subtle behind the dot grid */}
      <div style={{ position: "absolute", width: "180px", height: "180px", background: "#7700ff", borderRadius: "50%", filter: "blur(70px)", opacity: 0.15, top: "-30px", right: "-20px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "150px", height: "150px", background: "#38b000", borderRadius: "50%", filter: "blur(55px)", opacity: 0.12, bottom: "-20px", left: "5px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "120px", height: "120px", background: "#ff007f", borderRadius: "50%", filter: "blur(50px)", opacity: 0.08, top: "40%", left: "40%", pointerEvents: "none" }} />

      {/* Edges — curved dashed SVG paths */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
        {edges.map((e, i) => {
          // Calculate curved path using a quadratic bezier
          const midX = (e.x1 + e.x2) / 2;
          const midY = (e.y1 + e.y2) / 2;
          // Offset the control point perpendicular to the line
          const dx = e.x2 - e.x1;
          const dy = e.y2 - e.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const curvature = len * 0.15;
          const cpX = midX + (dy / len) * curvature;
          const cpY = midY - (dx / len) * curvature;
          return (
            <path
              key={i}
              d={`M ${e.x1}% ${e.y1}% Q ${cpX}% ${cpY}% ${e.x2}% ${e.y2}%`}
              stroke="rgba(26,26,26,0.2)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
            />
          );
        })}
      </svg>

      {/* Interest nodes */}
      {nodes.map((node) => {
        const isHovered = hoveredNode === node.keyword;
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
              transform: isHovered ? "translate(-50%, -50%) translateY(-3px)" : "translate(-50%, -50%)",
              zIndex: isHovered ? 20 : 5,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {/* Interest label */}
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                background: isHovered ? "#1a1a1a" : node.active ? "white" : "white",
                color: isHovered ? "white" : node.active ? "#1a1a1a" : "#bbb",
                border: `2px solid ${node.active ? "#1a1a1a" : "rgba(26,26,26,0.2)"}`,
                boxShadow: isHovered
                  ? "4px 4px 0px 0px rgba(0,0,0,1)"
                  : node.active
                    ? "2px 2px 0px 0px rgba(0,0,0,1)"
                    : "none",
                fontSize: "0.6rem",
                fontWeight: node.active ? 700 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono), monospace",
                transition: "all 0.15s ease",
              }}
            >
              {node.label}
            </span>

            {/* Paper topics dropdown on hover */}
            {isHovered && node.paperTopics.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginTop: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  zIndex: 30,
                }}
              >
                {node.paperTopics.slice(0, 4).map((topic, ti) => (
                  <span
                    key={topic}
                    style={{
                      display: "inline-block",
                      padding: "2px 6px",
                      background: PASTEL_COLORS[ti % 5],
                      border: "2px solid #1a1a1a",
                      boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
                      fontSize: "0.5rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.3px",
                      whiteSpace: "nowrap",
                      color: "#1a1a1a",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {topic.length > 20 ? topic.slice(0, 19) + "\u2026" : topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "#1a1a1a" }} />
    </div>
  );
}

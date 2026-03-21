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

  const uniqueInterests = useMemo(() => {
    const seen = new Set<string>();
    return interests.filter(i => {
      const key = i.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [interests]);

  // Map each interest to the paper titles it connects to
  const interestPapers = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const interest of uniqueInterests) {
      const intWords = interest.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const seenTitles = new Set<string>();
      const titles: string[] = [];
      for (const pk of paperKeywords) {
        if (seenTitles.has(pk.paperTitle)) continue;
        const pkWords = pk.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlap = intWords.some(w => pkWords.some(pw => pw.includes(w) || w.includes(pw)));
        if (overlap) {
          titles.push(pk.paperTitle);
          seenTitles.add(pk.paperTitle);
        }
      }
      map.set(interest.keyword, titles);
    }
    return map;
  }, [uniqueInterests, paperKeywords]);

  const nodes = useMemo(() => {
    return uniqueInterests.map((interest, i) => {
      const h = hash(interest.keyword);
      const cols = Math.min(3, Math.ceil(Math.sqrt(uniqueInterests.length)));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const totalRows = Math.ceil(uniqueInterests.length / cols);

      const baseX = 12 + (col / Math.max(cols - 1, 1)) * 72;
      const baseY = 14 + (row / Math.max(totalRows - 1, 1)) * 64;
      const ox = ((h % 8) - 4) * 0.5;
      const oy = (((h >> 3) % 8) - 4) * 0.4;

      return {
        keyword: interest.keyword,
        label: interest.keyword.length > 18 ? interest.keyword.slice(0, 17) + "\u2026" : interest.keyword,
        x: Math.max(8, Math.min(86, baseX + ox)),
        y: Math.max(10, Math.min(82, baseY + oy)),
        color: PASTEL_COLORS[i % PASTEL_COLORS.length],
        paperTitles: interestPapers.get(interest.keyword) ?? [],
      };
    });
  }, [uniqueInterests, interestPapers]);

  // Edges only between nodes that share a paper
  const edges = useMemo(() => {
    if (nodes.length < 2) return [];
    const result: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const used = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const shared = nodes[i].paperTitles.some(t => nodes[j].paperTitles.includes(t));
        if (shared) {
          const key = `${i}-${j}`;
          if (!used.has(key)) {
            used.add(key);
            result.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y });
          }
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span style={{ fontSize: "0.65rem", color: "#ccc", fontFamily: "var(--font-mono), monospace" }}>
          No matching interests
        </span>
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
        overflow: "hidden",
      }}
    >
      {/* Blobs */}
      <div style={{ position: "absolute", width: "180px", height: "180px", background: "#7700ff", borderRadius: "50%", filter: "blur(70px)", opacity: 0.12, top: "-30px", right: "-20px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "140px", height: "140px", background: "#38b000", borderRadius: "50%", filter: "blur(55px)", opacity: 0.1, bottom: "-20px", left: "5px", pointerEvents: "none" }} />

      {/* Edges — shared paper connections */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
        {edges.map((e, i) => {
          const midX = (e.x1 + e.x2) / 2;
          const midY = (e.y1 + e.y2) / 2;
          const dx = e.x2 - e.x1;
          const dy = e.y2 - e.y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const cpX = midX + (dy / len) * len * 0.1;
          const cpY = midY - (dx / len) * len * 0.1;
          return (
            <path
              key={i}
              d={`M ${e.x1}% ${e.y1}% Q ${cpX}% ${cpY}% ${e.x2}% ${e.y2}%`}
              stroke="rgba(26,26,26,0.15)"
              strokeWidth="1"
              strokeDasharray="3 4"
              fill="none"
            />
          );
        })}
      </svg>

      {/* Nodes */}
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
              transform: isHovered ? "translate(-50%, -50%) translateY(-2px)" : "translate(-50%, -50%)",
              zIndex: isHovered ? 20 : 5,
              cursor: "pointer",
              transition: "transform 0.15s ease",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                background: isHovered ? "#1a1a1a" : node.color,
                color: isHovered ? "white" : "#1a1a1a",
                border: "2px solid #1a1a1a",
                boxShadow: isHovered ? "2px 2px 0px 0px rgba(0,0,0,0.6)" : "none",
                fontSize: "0.55rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono), monospace",
                transition: "all 0.15s ease",
              }}
            >
              {node.label}
            </span>

            {/* Paper titles on hover */}
            {isHovered && node.paperTitles.length > 0 && (
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
                  minWidth: "140px",
                  maxWidth: "220px",
                }}
              >
                {node.paperTitles.map((title, ti) => (
                  <span
                    key={ti}
                    style={{
                      display: "block",
                      padding: "3px 7px",
                      background: "white",
                      border: "1.5px solid #1a1a1a",
                      fontSize: "0.5rem",
                      fontWeight: 500,
                      color: "#1a1a1a",
                      fontFamily: "var(--font-mono), monospace",
                      lineHeight: 1.4,
                    }}
                  >
                    {title.length > 45 ? title.slice(0, 44) + "\u2026" : title}
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

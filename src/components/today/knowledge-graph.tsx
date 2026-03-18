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
        label: interest.keyword.length > 16 ? interest.keyword.slice(0, 15) + "…" : interest.keyword,
        x: Math.max(10, Math.min(90, baseX + ox)),
        y: Math.max(12, Math.min(85, baseY + oy)),
        active: connections.has(interest.keyword),
        paperTopics: connections.get(interest.keyword) || [],
      };
    });
  }, [uniqueInterests, connections]);

  // Edges between active nodes
  const edges = useMemo(() => {
    const active = nodes.filter(n => n.active);
    const result: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        result.push({ x1: active[i].x, y1: active[i].y, x2: active[j].x, y2: active[j].y });
      }
    }
    return result;
  }, [nodes]);

  // What to show on hover
  const hoveredPaperTopics = hoveredNode ? (connections.get(hoveredNode) || []) : [];

  if (nodes.length === 0) {
    return (
      <div
        className="w-full md:w-[360px] h-[200px] md:h-[260px]"
        style={{ border: "1.5px solid #1a1a1a", background: "rgba(245,245,245,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
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
        border: "1.5px solid #1a1a1a",
        background: "rgba(245,245,245,0.95)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Blobs */}
      <div style={{ position: "absolute", width: "160px", height: "160px", background: "#7700ff", borderRadius: "50%", filter: "blur(70px)", opacity: 0.12, top: "-30px", right: "-20px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "130px", height: "130px", background: "#38b000", borderRadius: "50%", filter: "blur(55px)", opacity: 0.1, bottom: "-20px", left: "5px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "100px", height: "100px", background: "#ff007f", borderRadius: "50%", filter: "blur(50px)", opacity: 0.07, top: "40%", left: "40%", pointerEvents: "none" }} />

      {/* Edges */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
        {edges.map((e, i) => (
          <line key={i} x1={`${e.x1}%`} y1={`${e.y1}%`} x2={`${e.x2}%`} y2={`${e.y2}%`}
            stroke="rgba(26,26,26,0.12)" strokeWidth="0.8" />
        ))}
      </svg>

      {/* Interest nodes */}
      {nodes.map((node, i) => {
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
              transform: "translate(-50%, -50%)",
              zIndex: isHovered ? 20 : 5,
              cursor: "pointer",
            }}
          >
            {/* Interest label */}
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                background: isHovered ? "#1a1a1a" : node.active ? "white" : "rgba(245,245,245,0.8)",
                color: isHovered ? "white" : node.active ? "#1a1a1a" : "#bbb",
                border: `1.5px solid ${node.active ? "#1a1a1a" : "rgba(26,26,26,0.15)"}`,
                fontSize: "0.55rem",
                fontWeight: node.active ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono), monospace",
                transition: "all 0.12s ease",
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
                      border: "1px solid rgba(26,26,26,0.2)",
                      fontSize: "0.45rem",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.3px",
                      whiteSpace: "nowrap",
                      color: "#1a1a1a",
                    }}
                  >
                    {topic.length > 20 ? topic.slice(0, 19) + "…" : topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

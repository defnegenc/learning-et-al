"use client";

import { useState } from "react";
import { Star, ThumbsDown, Bookmark } from "lucide-react";
import { KeywordTag } from "@/components/keyword-tag";

export interface PaperItem {
  id: string;
  title: string;
  summary: string | null;
  source: "arxiv" | "rss" | "semantic_scholar";
  sourceUrl: string | null;
  keywords: string[];
  authors: string[];
  year?: number | null;
  abstract?: string | null;
  fullText?: string | null;
  category?: "foundational" | "recent" | "news" | null;
  keyFindings?: string[];
  connectionReason?: string | null;
}

interface PaperCardProps {
  paper: PaperItem;
  index?: number;
  compact?: boolean;
  highlighted?: boolean;
  compareMode?: boolean;
  isCompareSelected?: boolean;
  conceptDefs?: Record<string, string>;
  onSelect: (paper: PaperItem) => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
}

// Each card: white bg, two small blobs in contrasting colors, matching tag colors
const CARD_STYLES = [
  {
    blobs: [
      { color: "#f9a8d4", w: 100, h: 100, top: "-30px", right: "-20px", left: "auto", bottom: "auto" },
      { color: "#86efac", w: 80, h: 80, top: "auto", right: "auto", left: "-20px", bottom: "-15px" },
    ],
    tags: ["#fce7f3", "#dcfce7"],  // pink tint, green tint
  },
  {
    blobs: [
      { color: "#93c5fd", w: 90, h: 90, top: "auto", right: "auto", left: "-25px", bottom: "-20px" },
      { color: "#fde68a", w: 85, h: 85, top: "-25px", right: "auto", left: "60%", bottom: "auto" },
    ],
    tags: ["#dbeafe", "#fef9c3"],  // blue tint, yellow tint
  },
  {
    blobs: [
      { color: "#c4b5fd", w: 95, h: 95, top: "-20px", right: "auto", left: "-15px", bottom: "auto" },
      { color: "#fca5a5", w: 75, h: 75, top: "auto", right: "-20px", left: "auto", bottom: "-15px" },
    ],
    tags: ["#ede9fe", "#fee2e2"],  // purple tint, red tint
  },
];

const PASTEL_COLORS = ["#fef3c7", "#bae6fd", "#d8b4fe", "#fed7aa", "#a5f3fc"];

function getSourceLabel(source: PaperItem["source"], year?: number | null) {
  const yearStr = year ? ` · ${year}` : "";
  if (source === "rss") return `NEWS${yearStr}`;
  if (source === "arxiv") return `ARXIV${yearStr}`;
  return `PAPER${yearStr}`;
}

function idToColorIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % PASTEL_COLORS.length;
}

export function PaperCard({
  paper,
  index = 0,
  compact = false,
  highlighted = false,
  compareMode = false,
  isCompareSelected = false,
  conceptDefs,
  onSelect,
  onStar,
  onDislike,
}: PaperCardProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const cardStyle = CARD_STYLES[index % CARD_STYLES.length];
  const borderStyle = isCompareSelected ? "4px solid #1a1a1a" : highlighted ? "4px solid #1a1a1a" : "3px solid #1a1a1a";
  const shadowStyle = isCompareSelected || highlighted
    ? "4px 4px 0px 0px rgba(0,0,0,1)"
    : "6px 6px 0px 0px rgba(0,0,0,1)";

  return (
    <article
      className="group relative md:aspect-square"
      style={{
        background: "white",
        border: borderStyle,
        boxShadow: shadowStyle,
        padding: compact ? "12px" : "16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translate(-2px, -2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = (isCompareSelected || highlighted)
          ? "6px 6px 0px 0px rgba(255,0,127,1)" : "8px 8px 0px 0px rgba(0,0,0,1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translate(0, 0)";
        (e.currentTarget as HTMLElement).style.boxShadow = shadowStyle;
      }}
      onClick={() => onSelect(paper)}
    >
      {/* Bookmark — top right, no overlap */}
      <button
        className={`absolute z-10 transition-colors ${bookmarked ? "text-[#1a1a1a]" : "text-transparent md:group-hover:text-[#ccc]"}`}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", top: compact ? "6px" : "8px", right: compact ? "6px" : "8px" }}
        onClick={(e) => { e.stopPropagation(); setBookmarked(!bookmarked); onStar(paper.id); }}
      >
        <Bookmark size={compact ? 12 : 14} className={bookmarked ? "fill-current" : ""} />
      </button>
      {/* Aura blobs — unique position per card */}
      {cardStyle.blobs.map((blob, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: `${blob.w}px`,
            height: `${blob.h}px`,
            background: blob.color,
            borderRadius: "50%",
            filter: "blur(40px)",
            opacity: 0.7,
            top: blob.top,
            right: blob.right,
            bottom: blob.bottom,
            left: blob.left,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Top: source label + compare badge */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: compact ? "0.55rem" : "0.65rem",
            fontWeight: 700,
            color: "#666",
            border: "1px solid #d1d5db",
            padding: "2px 6px",
            display: "inline-block",
          }}
        >
          {getSourceLabel(paper.source, paper.year)}
        </span>
        {compareMode && (
          <span style={{
            padding: "3px 8px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "1px", border: `2px solid #1a1a1a`,
            background: isCompareSelected ? "#1a1a1a" : "transparent",
            color: isCompareSelected ? "#fff" : "#1a1a1a", fontFamily: "var(--font-mono), monospace",
          }}>
            {isCompareSelected ? "✓" : "+"}
          </span>
        )}
      </div>

      {/* Bottom: connection reason + title + summary snippet + keywords */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <h2
          style={{
            fontSize: compact ? "0.8rem" : "1rem",
            fontWeight: 800,
            textTransform: "uppercase",
            lineHeight: 1.15,
            fontFamily: "var(--font-display), sans-serif",
            margin: "0 0 4px 0",
            display: "-webkit-box",
            WebkitLineClamp: compact ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          className="group-hover:underline"
        >
          {paper.title}
        </h2>
        {/* Citation */}
        {(paper.authors.length > 0 || paper.year) && (
          <p style={{
            fontSize: "0.6rem",
            color: "#888",
            fontFamily: "var(--font-mono), monospace",
            fontStyle: "italic",
            marginBottom: "6px",
            lineHeight: 1.3,
          }}>
            {paper.authors.length === 1
              ? paper.authors[0]
              : paper.authors.length > 1
                ? `${paper.authors[0].split(" ").pop()} et al.`
                : ""}
            {paper.authors.length > 0 && paper.year ? ", " : ""}
            {paper.year ?? ""}
          </p>
        )}
        {/* Plain-English summary — hidden in compact mode */}
        {paper.summary && !compact && (
          <p style={{
            fontSize: "0.72rem",
            color: "#333",
            fontFamily: "inherit",
            lineHeight: 1.5,
            marginBottom: "8px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {paper.summary}
          </p>
        )}
        {paper.keywords.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {paper.keywords.slice(0, 2).map((kw, idx) => (
              <KeywordTag
                key={kw}
                keyword={kw}
                color={cardStyle.tags[idx % cardStyle.tags.length]}
                definition={conceptDefs?.[kw.toLowerCase()]}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

"use client";

import { Star, ThumbsDown } from "lucide-react";
import { KeywordTag } from "@/components/keyword-tag";

export interface PaperItem {
  id: string;
  title: string;
  summary: string | null;
  source: "arxiv" | "rss" | "semantic_scholar";
  sourceUrl: string | null;
  keywords: string[];
  authors: string[];
}

interface PaperCardProps {
  paper: PaperItem;
  highlighted?: boolean;
  onSelect: (paper: PaperItem) => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

export function PaperCard({
  paper,
  highlighted = false,
  onSelect,
  onStar,
  onDislike,
}: PaperCardProps) {
  const sourceLabel = paper.source === "semantic_scholar" ? "S2" : paper.source === "arxiv" ? "ARXIV" : "RSS";

  return (
    <article
      className="group relative p-5 space-y-2"
      style={{
        background: highlighted ? "#f0f0f0" : "#e8e8e8",
        border: "1.5px solid #1a1a1a",
        cursor: "crosshair",
        transition: "transform 0.2s ease, background 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.background = "#f0f0f0";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.background = highlighted ? "#f0f0f0" : "#e8e8e8";
      }}
      onClick={() => onSelect(paper)}
    >
      {/* Source — plain text, no box */}
      <div className="flex items-start justify-between">
        <span
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "0.65rem",
            color: "#666",
          }}
        >
          {sourceLabel}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="p-0.5 hover:text-[#38b000] transition-colors"
            onClick={(e) => { e.stopPropagation(); onStar(paper.id); }}
            style={{ cursor: "crosshair" }}
          >
            <Star className="size-3" />
          </button>
          <button
            className="p-0.5 hover:text-[#ff007f] transition-colors"
            onClick={(e) => { e.stopPropagation(); onDislike(paper.id); }}
            style={{ cursor: "crosshair" }}
          >
            <ThumbsDown className="size-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: "1.1rem",
          fontWeight: "bold",
          textTransform: "uppercase",
          lineHeight: 1.2,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
        className="line-clamp-2"
      >
        {paper.title}
      </h2>

      {/* Authors */}
      {paper.authors.length > 0 && (
        <p
          style={{
            fontSize: "0.75rem",
            fontStyle: "italic",
            opacity: 0.8,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}
        >
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Summary */}
      {paper.summary && (
        <p
          style={{
            fontSize: "0.8rem",
            lineHeight: 1.5,
            color: "#444",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}
        >
          {paper.summary}
        </p>
      )}

      {/* Keywords — pastel boxes */}
      {paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {paper.keywords.slice(0, 4).map((kw, idx) => (
            <KeywordTag
              key={kw}
              keyword={kw}
              color={PASTEL_COLORS[idx % PASTEL_COLORS.length]}
            />
          ))}
        </div>
      )}
    </article>
  );
}

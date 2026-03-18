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
  year?: number | null;
  abstract?: string | null;
  category?: "foundational" | "recent" | "news" | null;
}

interface PaperCardProps {
  paper: PaperItem;
  highlighted?: boolean;
  onSelect: (paper: PaperItem) => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
}

const PASTEL_COLORS = ["#bbf7d0", "#fbcfe8", "#e9d5ff", "#bfdbfe", "#fef08a"];

export function PaperCard({
  paper,
  highlighted = false,
  onSelect,
  onStar,
  onDislike,
}: PaperCardProps) {
  const typeLabel = paper.source === "rss" ? "NEWS" : "PAPER";
  const yearLabel = paper.year ? ` \u00b7 ${paper.year}` : "";

  return (
    <article
      className="group relative p-6 space-y-3"
      style={{
        background: "white",
        borderBottom: "4px solid #1a1a1a",
        transition: "transform 0.2s ease, background 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
      onClick={() => onSelect(paper)}
    >
      {/* Source label */}
      <div className="flex items-start justify-between">
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.7rem",
            color: "#666",
            border: "1px solid #d1d5db",
            padding: "2px 6px",
            display: "inline-block",
          }}
        >
          {typeLabel}{yearLabel}
        </span>
        {/* Always visible on mobile, hover on desktop */}
        <div className="flex gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
          <button
            className="p-1.5 md:p-0.5 hover:text-[#38b000] transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); onStar(paper.id); }}
          >
            <Star className="size-4 md:size-3" />
          </button>
          <button
            className="p-1.5 md:p-0.5 hover:text-[#ff007f] transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); onDislike(paper.id); }}
          >
            <ThumbsDown className="size-4 md:size-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: "1.15rem",
          fontWeight: "bold",
          textTransform: "uppercase",
          lineHeight: 1.2,
          fontFamily: "var(--font-display), sans-serif",
        }}
        className="line-clamp-2 group-hover:underline"
      >
        {paper.title}
      </h2>

      {/* Authors */}
      {paper.authors.length > 0 && (
        <p
          style={{
            fontSize: "11px",
            fontStyle: "italic",
            color: "#4b5563",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Summary */}
      {paper.summary && (
        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.5,
            color: "#374151",
            display: "-webkit-box",
            WebkitLineClamp: 5,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          {paper.summary}
        </p>
      )}

      {/* Keywords — pastel boxes with brutal shadows */}
      {paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
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

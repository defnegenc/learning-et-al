"use client";

import { Star, ThumbsDown } from "lucide-react";

export interface PaperItem {
  id: string;
  title: string;
  summary: string | null;
  source: "arxiv" | "rss";
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

const ACCENT_COLORS = ["#38b000", "#ff007f", "#7700ff", "#0077ff", "#ff8800"];

export function PaperCard({
  paper,
  highlighted = false,
  onSelect,
  onStar,
  onDislike,
}: PaperCardProps) {
  return (
    <div
      className={`group relative border border-[#1a1a1a] p-3 space-y-2 transition-all duration-150 ${
        highlighted ? "bg-[#d8d8d8]" : "bg-[#e8e8e8] hover:bg-[#f0f0f0]"
      }`}
      style={{
        borderWidth: "1.5px",
        cursor: "crosshair",
        transition: "transform 150ms ease, background 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
      onClick={() => onSelect(paper)}
    >
      {/* Source label + action buttons */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[0.7rem] uppercase tracking-[2px] text-[#555]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          {paper.source === "arxiv" ? "ARXIV" : "RSS"} // {new Date().getFullYear()}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="p-1 hover:text-[#38b000] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onStar(paper.id);
            }}
            style={{ cursor: "crosshair" }}
          >
            <Star className="size-3" />
          </button>
          <button
            className="p-1 hover:text-[#ff007f] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDislike(paper.id);
            }}
            style={{ cursor: "crosshair" }}
          >
            <ThumbsDown className="size-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-[1.15rem] font-bold uppercase leading-snug line-clamp-2 text-[#1a1a1a]"
        style={{ fontFamily: '"Courier New", Courier, monospace' }}
      >
        {paper.title}
      </h3>

      {/* Summary */}
      {paper.summary && (
        <p className="text-[0.9rem] text-[#444] line-clamp-3 leading-relaxed">
          {paper.summary}
        </p>
      )}

      {/* Keywords */}
      {paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {paper.keywords.slice(0, 4).map((kw, idx) => {
            const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
            return (
              <span
                key={kw}
                className="px-1.5 py-0 text-[0.7rem] uppercase tracking-[1px]"
                style={{
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: color,
                  color: color,
                  fontFamily: '"Courier New", Courier, monospace',
                }}
              >
                {kw}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

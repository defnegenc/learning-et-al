"use client";

import React, { useState } from "react";
import { Bookmark } from "lucide-react";
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
  plainName?: string | null;
  dinnerLine?: string | null;
  relatesLine?: string | null;
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

const CARD_PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
];

const CARD_TAGS = [
  ["#fce7f3", "#dcfce7"],
  ["#dbeafe", "#fef9c3"],
  ["#ede9fe", "#fee2e2"],
  ["#fef9c3", "#fce7f3"],
];

function dispersedWashCard(palette: [string, string], intensity = 0.5): React.CSSProperties {
  const a = Math.min(255, Math.round(intensity * 255)).toString(16).padStart(2, "0");
  const b = Math.min(255, Math.round(intensity * 0.6 * 255)).toString(16).padStart(2, "0");
  const [h1, h2] = palette;
  return {
    background: `
      radial-gradient(circle 170px at 2% 2%, ${h1}${a} 0%, transparent 62%),
      radial-gradient(circle 160px at 98% 6%, ${h2}${a} 0%, transparent 62%),
      radial-gradient(circle 150px at 96% 100%, ${h1}${b} 0%, transparent 62%),
      radial-gradient(circle 170px at 2% 98%, ${h2}${b} 0%, transparent 62%),
      #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, multiply, normal",
  } as React.CSSProperties;
}

const PASTEL_COLORS = ["#fef3c7", "#bae6fd", "#d8b4fe", "#fed7aa", "#a5f3fc"];

function getSourceLabel(source: PaperItem["source"], year?: number | null, sourceUrl?: string | null) {
  const yearStr = year ? ` · ${year}` : "";
  if (source === "rss") return `NEWS${yearStr}`;
  if (source === "arxiv") return `ARXIV${yearStr}`;
  // Try to extract venue from URL domain
  if (sourceUrl) {
    const url = sourceUrl.toLowerCase();
    if (url.includes("arxiv.org")) return `ARXIV${yearStr}`;
    if (url.includes("nature.com")) return `NATURE${yearStr}`;
    if (url.includes("sciencedirect") || url.includes("elsevier")) return `ELSEVIER${yearStr}`;
    if (url.includes("springer")) return `SPRINGER${yearStr}`;
    if (url.includes("ieee")) return `IEEE${yearStr}`;
    if (url.includes("acm.org")) return `ACM${yearStr}`;
    if (url.includes("pnas.org")) return `PNAS${yearStr}`;
    if (url.includes("frontiersin.org")) return `FRONTIERS${yearStr}`;
    if (url.includes("mdpi.com")) return `MDPI${yearStr}`;
    if (url.includes("wiley")) return `WILEY${yearStr}`;
    if (url.includes("tandfonline")) return `T&F${yearStr}`;
    if (url.includes("sagepub")) return `SAGE${yearStr}`;
    if (url.includes("cambridge.org")) return `CAMBRIDGE${yearStr}`;
    if (url.includes("oxford")) return `OXFORD${yearStr}`;
    if (url.includes("plos")) return `PLOS${yearStr}`;
    if (url.includes("biorxiv")) return `BIORXIV${yearStr}`;
    if (url.includes("medrxiv")) return `MEDRXIV${yearStr}`;
    if (url.includes("ssrn")) return `SSRN${yearStr}`;
    if (url.includes("researchgate")) return `RESEARCHGATE${yearStr}`;
    if (url.includes("mckinsey")) return `MCKINSEY${yearStr}`;
    if (url.includes("weforum")) return `WEF${yearStr}`;
    // DOI prefix detection for common publishers
    if (url.includes("doi.org/10.3389")) return `FRONTIERS${yearStr}`;
    if (url.includes("doi.org/10.1038")) return `NATURE${yearStr}`;
    if (url.includes("doi.org/10.1016")) return `ELSEVIER${yearStr}`;
    if (url.includes("doi.org/10.1007")) return `SPRINGER${yearStr}`;
    if (url.includes("doi.org/10.1109")) return `IEEE${yearStr}`;
    if (url.includes("doi.org/10.1145")) return `ACM${yearStr}`;
    if (url.includes("doi.org/10.1073")) return `PNAS${yearStr}`;
    if (url.includes("doi.org/10.3390")) return `MDPI${yearStr}`;
    if (url.includes("doi.org/10.1002")) return `WILEY${yearStr}`;
    if (url.includes("doi.org/10.1080")) return `T&F${yearStr}`;
    if (url.includes("doi.org/10.1177")) return `SAGE${yearStr}`;
    if (url.includes("doi.org/10.1371")) return `PLOS${yearStr}`;
    if (url.includes("doi.org")) return `JOURNAL${yearStr}`;
  }
  return `SOURCE${yearStr}`;
}

function idToColorIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % PASTEL_COLORS.length;
}

const SUMMARY_COLLAPSE_THRESHOLD = 180;

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
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const summaryExpandable = !compact && !!paper.summary && paper.summary.length > SUMMARY_COLLAPSE_THRESHOLD;
  const palette = CARD_PALETTES[index % CARD_PALETTES.length];
  const tags = CARD_TAGS[index % CARD_TAGS.length];
  // Match the vault card: clean 2px black border, flat (no heavy drop shadow).
  const borderStyle = "2px solid #1a1a1a";
  const shadowStyle = isCompareSelected || highlighted
    ? "3px 3px 0px 0px rgba(0,0,0,1)"
    : "none";

  return (
    <article
      className="group relative"
      style={{
        aspectRatio: compact ? "auto" : summaryExpanded ? "auto" : "1 / 1",
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
        ...dispersedWashCard(palette),
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translate(-1px, -1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translate(0, 0)";
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

      {/* Top: source label + compare badge */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: compact ? "6px" : "12px" }}>
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
          {getSourceLabel(paper.source, paper.year, paper.sourceUrl)}
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
          <div style={{ marginBottom: "8px" }}>
            <p style={{
              fontSize: "0.72rem",
              color: "#333",
              fontFamily: "inherit",
              lineHeight: 1.5,
              margin: 0,
              ...(summaryExpanded ? {} : {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
            }}>
              {paper.summary}
            </p>
            {summaryExpandable && (
              <button
                onClick={(e) => { e.stopPropagation(); setSummaryExpanded(v => !v); }}
                style={{
                  background: "none", border: "none", padding: "2px 0 0 0",
                  cursor: "pointer", fontSize: "0.6rem", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "1px",
                  fontFamily: "var(--font-mono), monospace", color: "#888",
                  textDecoration: "underline", textUnderlineOffset: "2px",
                }}
              >
                {summaryExpanded ? "See less" : "See more"}
              </button>
            )}
          </div>
        )}
        {paper.keywords.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
            {paper.keywords.slice(0, 2).map((kw, idx) => (
              <KeywordTag
                key={kw}
                keyword={kw}
                color={tags[idx % tags.length]}
                definition={conceptDefs?.[kw.toLowerCase()]}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import React from "react";
import type { PaperItem } from "./paper-card";
import { journalName } from "@/lib/venue-name";

/*
 * The paper/news card — one component for Today AND the Vault so both surfaces
 * stay pixel-identical. Blob-wash background, mono venue line, display-face
 * title, glass keyword tags. Vault passes compareMode/onSelect for selection.
 */

export const SOURCE_PALETTES: [string, string][] = [
  ["#6EE9A8", "#D4F04A"],
  ["#FF85A8", "#FFD020"],
  ["#60AAE8", "#A878E8"],
  ["#FFD020", "#FF85A8"],
];

export function hex2rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const BLOB_LAYOUTS = [
  // card 0: top-left dominant, bottom-right reach, top-right wisp
  (c1: string, c2: string) => `
    radial-gradient(circle 280px at 5% 8%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 200px at 92% 5%, ${c2} 0%, transparent 55%),
    radial-gradient(circle 260px at 96% 96%, ${c1} 0%, transparent 60%),
    #fff`,
  // card 1: bottom-left blob, top-right reach, bottom-right accent
  (c1: string, c2: string) => `
    radial-gradient(circle 270px at 2% 95%, ${c2} 0%, transparent 60%),
    radial-gradient(circle 220px at 90% 5%, ${c1} 0%, transparent 55%),
    radial-gradient(circle 200px at 98% 88%, ${c2} 0%, transparent 55%),
    #fff`,
  // card 2: top-right dominant, left-center reach, small bottom-left
  (c1: string, c2: string) => `
    radial-gradient(circle 280px at 98% 4%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 220px at 2% 45%, ${c2} 0%, transparent 55%),
    radial-gradient(circle 190px at 8% 98%, ${c1} 0%, transparent 55%),
    #fff`,
  // card 3: both bottom corners reaching up, small top-right
  (c1: string, c2: string) => `
    radial-gradient(circle 260px at 3% 98%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 250px at 97% 92%, ${c2} 0%, transparent 60%),
    radial-gradient(circle 180px at 88% 3%, ${c1} 0%, transparent 50%),
    #fff`,
];

export function dispersedWash(palette: [string, string], hover = false, idx = 0): React.CSSProperties {
  const [h1, h2] = palette;
  const a = hover ? 0.55 : 0.42;
  const c1 = hex2rgba(h1, a);
  const c2 = hex2rgba(h2, a);
  return { background: BLOB_LAYOUTS[idx % BLOB_LAYOUTS.length](c1, c2) } as React.CSSProperties;
}

export function SourceCard({ paper, index, loggedIn, initialBookmarked, compareMode, isSelected, onSelect, onOpen }: {
  paper: PaperItem;
  index: number;
  loggedIn?: boolean;
  initialBookmarked?: boolean;
  compareMode?: boolean;
  isSelected?: boolean;
  onSelect?: (p: PaperItem) => void;
  onOpen?: (p: PaperItem) => void;
}) {
  const palette = SOURCE_PALETTES[index % SOURCE_PALETTES.length];
  const url = (paper.sourceUrl || "").toLowerCase();
  const sourceType = url.includes("arxiv") ? "arXiv" : paper.source === "rss" ? "News" : "Paper";
  const journal = journalName(paper.sourceUrl, paper.authors);
  const baseWash = dispersedWash(palette, false, index);
  const hoverWash = dispersedWash(palette, true, index);
  const [bookmarked, setBookmarked] = useState(!!initialBookmarked);

  async function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await fetch(`/api/papers/${paper.id}/feedback`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ type: "star" }) : undefined,
      });
      if (next) {
        // Kick off reading prep in the background so the companion, glossary
        // and homework are ready by the time the reading list is opened.
        fetch(`/api/papers/${paper.id}/companion`, { method: "POST" }).catch(() => {});
        fetch(`/api/papers/${paper.id}/homework`, { method: "POST" }).catch(() => {});
      }
    } catch {
      setBookmarked(!next);
    }
  }

  return (
    <a
      href={paper.sourceUrl || "#"}
      onClick={e => {
        if (compareMode) { e.preventDefault(); onSelect?.(paper); return; }
        if (onOpen) { e.preventDefault(); onOpen(paper); return; }
        if (!paper.sourceUrl) e.preventDefault();
      }}
      target={!compareMode && !onOpen && paper.sourceUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      style={{
        ...baseWash,
        display: "block",
        padding: "16px 18px 18px",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        overflow: "hidden",
        border: compareMode ? "2px solid #1a1a1a" : `1.5px solid ${hex2rgba(palette[0], 0.45)}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        transition: "background 320ms, box-shadow 150ms, transform 150ms",
        height: "100%",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        Object.assign(el.style, hoverWash);
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)";
        el.style.transform = "translate(-1px,-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        Object.assign(el.style, baseWash);
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)";
        el.style.transform = "";
      }}
    >
      {/* Venue + year + bookmark / select circle / ext-link */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.625rem", letterSpacing: "0.12em", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{sourceType}</span>
          <span style={{ color: "#aaa" }}>·</span>
          <span>{paper.year || "2025"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {compareMode ? (
            <div style={{ width: 18, height: 18, border: "2px solid #1a1a1a", borderRadius: "50%", background: isSelected ? "#1a1a1a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
            </div>
          ) : (
            <>
              {loggedIn && (
                <button
                  onClick={toggleBookmark}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", lineHeight: 1 }}
                  aria-label={bookmarked ? "Remove bookmark" : "Bookmark paper"}
                >
                  <Bookmark size={12} style={{ fill: bookmarked ? "#1a1a1a" : "none", stroke: "#1a1a1a", opacity: bookmarked ? 1 : 0.4, transition: "all 0.15s" }} />
                </button>
              )}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M7 1h4v4M11 1L6 6M9 7v3.5H1.5V2H5" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display), sans-serif", fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em", color: "#1a1a1a", textTransform: "uppercase" }}>
        {paper.title}
      </h3>

      {/* Authors + journal */}
      {(paper.authors.length > 0 || journal) && (
        <div style={{ fontStyle: "italic", color: "#444", fontSize: "0.75rem", lineHeight: 1.4, marginBottom: "10px" }}>
          {paper.authors.length > 0 && (
            paper.authors.length <= 2 ? paper.authors.join(" & ") : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`
          )}
          {paper.authors.length > 0 && journal ? " — " : ""}
          {journal && <em>{journal}</em>}
        </div>
      )}

      {/* Summary — vertical accent + text */}
      {paper.summary && (
        <div style={{ display: "flex", gap: "10px", alignItems: "stretch", paddingTop: "10px", marginBottom: "12px" }}>
          <div style={{ width: 3, flexShrink: 0, borderRadius: 1, background: "#ddd" }} />
          <div style={{ fontSize: "0.8rem", lineHeight: 1.55, color: "#333" }}>
            {paper.summary.length > 160 ? paper.summary.slice(0, 157) + "..." : paper.summary}
          </div>
        </div>
      )}

      {/* Tags — clear/glass style */}
      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {paper.keywords.slice(0, 2).map((kw) => (
            <span key={kw} style={{
              background: "rgba(255,255,255,0.55)",
              color: "#1a1a1a",
              border: "1px solid rgba(26,26,26,0.35)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.6rem", fontWeight: 600,
              letterSpacing: "0.08em", padding: "4px 9px",
              textTransform: "uppercase", display: "inline-block",
              lineHeight: 1, whiteSpace: "nowrap",
              backdropFilter: "blur(6px)",
            }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

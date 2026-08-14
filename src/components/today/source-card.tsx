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

import { SOURCE_PALETTES, hex2rgba, dispersedWash } from "./palettes";

export { SOURCE_PALETTES, hex2rgba, dispersedWash };

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

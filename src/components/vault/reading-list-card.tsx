"use client";

import React, { useState } from "react";
import { Bookmark } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { washStyle } from "@/components/today/brief-threads";
import { journalName } from "@/lib/venue-name";

const DISPLAY = "var(--font-display), sans-serif";

// Reading-list card — same anatomy as the digest's PaperBlobCard (wash
// background, hard border + shadow, mono underlined name, big bold display
// line), but the hero is the paper's ACTUAL TITLE rather than its summary.
export function ReadingListCard({ paper, index, onOpen, onUnsaved }: {
  paper: PaperItem;
  index: number;
  onOpen: (p: PaperItem) => void;
  onUnsaved?: (paperId: string) => void;
}) {
  const [bookmarked, setBookmarked] = useState(true);
  const journal = journalName(paper.sourceUrl, paper.authors);

  const authors = paper.authors.length > 0
    ? paper.authors.length <= 3 ? paper.authors.join(", ") : `${paper.authors.slice(0, 3).join(", ")} et al.`
    : "";
  const byline = [authors, journal, paper.year ? String(paper.year) : ""].filter(Boolean).join(" · ");

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
      if (!next) onUnsaved?.(paper.id);
    } catch {
      setBookmarked(!next);
    }
  }

  return (
    <div
      onClick={() => onOpen(paper)}
      style={{ ...washStyle(index), border: "2px solid #1a1a1a", boxShadow: "6px 6px 0 0 rgba(0,0,0,1)", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 14, cursor: "pointer", height: "100%" }}
    >
      {/* Title first — the card is the title plus who wrote it. No mono eyebrow,
          no "from which digest" rail: see docs/design-style.md, "What a card is". */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.15rem", lineHeight: 1.32, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em", flex: 1 }}>
          {paper.title}
        </p>
        <button
          onClick={toggleBookmark}
          title={bookmarked ? "Remove from reading list" : "Save to reading list"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, color: "#1a1a1a" }}
        >
          <Bookmark size={15} fill={bookmarked ? "#1a1a1a" : "none"} />
        </button>
      </div>

      {byline && (
        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "auto" }}>{byline}</div>
      )}
    </div>
  );
}

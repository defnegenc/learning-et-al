"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaperItem } from "@/lib/types";
import { ReadingListCard } from "./reading-list-card";
import { NavTab, PageHeader, PageLoader } from "@/components/design-system";
import { ReadingPaperDetail } from "./reading-paper-detail";
import { DigestHistory } from "./digest-history";

export function VaultPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  // The vault is one place with two shelves — past digests and saved papers.
  // They're peers behind tabs, not a page plus a hidden sub-view: the old
  // bookmark-icon button read as "save this", not "go here".
  const [view, setView] = useState<"history" | "list">("history");
  const [detail, setDetail] = useState<PaperItem | null>(null);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error("Failed to fetch reading list");
      const data = await res.json();
      setPapers(data.papers ?? []);
    } catch { setPapers([]); }
    finally { setLoading(false); }
  }, []);

  // Refetch whenever the list view becomes active so un-bookmarks made in the
  // detail overlay or on Today are reflected.
  useEffect(() => { if (view === "list") fetchPapers(); }, [view, fetchPapers]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-4 md:px-8 pt-8 pb-20">
      <PageHeader
        title="Vault"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 12 }}>
            <NavTab active={view === "history"} onClick={() => setView("history")}>Digests</NavTab>
            <NavTab active={view === "list"} onClick={() => setView("list")}>Saved papers</NavTab>
          </div>
        }
      />

      {view === "history" ? (
        <DigestHistory />
      ) : loading ? (
        <PageLoader />
      ) : papers.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "80px 0" }}>
          <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a" }}>
            No saved papers yet
          </span>
          <span style={{ fontSize: "0.9rem", color: "#666" }}>
            Hit &ldquo;Read later&rdquo; on any paper in a digest and it lands here.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          {papers.map((paper, idx) => (
            <ReadingListCard
              key={paper.id}
              paper={paper}
              index={idx}
              onOpen={p => setDetail(p)}
              onUnsaved={id => setPapers(prev => prev.filter(p => p.id !== id))}
            />
          ))}
        </div>
      )}

      {detail && <ReadingPaperDetail paper={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import { BODY_STYLE, DISPLAY_SM, MUTED, NavTab, PageHeader, PageLoader } from "@/components/design-system";
import { ReadingPaperDetail } from "./reading-paper-detail";
import { DigestHistory } from "./digest-history";

export function VaultPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Two shelves, equal peers — not a page with a hidden sub-view.
  const [view, setView] = useState<"history" | "list">("history");
  const [detail, setDetail] = useState<PaperItem | null>(null);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error("Failed to fetch saved papers");
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "80px 0" }}>
          <span style={DISPLAY_SM}>No saved papers yet</span>
          <span style={{ ...BODY_STYLE, color: MUTED }}>
            Hit &ldquo;Read later&rdquo; on any paper in a digest and it lands here.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
          {papers.map((paper, idx) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              index={idx}
              size="compact"
              loggedIn
              initialBookmarked
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

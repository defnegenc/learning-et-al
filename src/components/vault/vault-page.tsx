"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { ReadingListCard } from "./reading-list-card";
import { ActionButton, PageHeader, PageLoader } from "@/components/design-system";
import { ReadingPaperDetail } from "./reading-paper-detail";
import { DigestHistory } from "./digest-history";

export function VaultPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Digest history is the vault's home; the reading list is a sub-view behind
  // the top-right button.
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
        title={view === "history" ? "Digest history" : "Reading list"}
        action={
          <ActionButton size="sm" onClick={() => setView(v => (v === "history" ? "list" : "history"))}>
            {view === "history"
              ? <><Bookmark size={13} />Reading list</>
              : <><ArrowLeft size={13} />Back to history</>}
          </ActionButton>
        }
      >
        {view === "history"
          ? "Every digest you've been sent, newest first."
          : "Papers you bookmarked. Open one to read the gist and what's happened since."}
      </PageHeader>

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
            Tap the bookmark on any paper card in your digest to save it here.
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

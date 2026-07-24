"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Bookmark, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { ReadingListCard } from "./reading-list-card";
import { PageTitle, ActionButton } from "@/components/design-system";
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
      {/* ── Header: title left, history toggle top-right ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: "12px", marginBottom: "24px" }}
      >
        <PageTitle size="sm">{view === "history" ? "Digest History" : "Reading List"}</PageTitle>
        <ActionButton size="sm" onClick={() => setView(v => (v === "history" ? "list" : "history"))}>
          {view === "history"
            ? <><Bookmark size={11} />Reading List</>
            : <><ArrowLeft size={11} />Back to History</>}
        </ActionButton>
      </div>

      {view === "history" ? (
        <DigestHistory />
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Loader2 className="size-6 animate-spin" style={{ color: "#666" }} />
        </div>
      ) : papers.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "80px 0" }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
            No saved papers yet
          </span>
          <span style={{ fontSize: "0.8rem", color: "#aaa" }}>
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

      {detail && <ReadingPaperDetail paper={detail} index={papers.findIndex(p => p.id === detail.id)} onClose={() => setDetail(null)} />}
    </div>
  );
}

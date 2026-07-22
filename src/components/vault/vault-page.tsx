"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, History, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { SourceCard } from "@/components/today/source-card";
import { PageTitle, ActionButton } from "@/components/design-system";
import { ReadingPaperDetail } from "./reading-paper-detail";
import { DigestHistory } from "./digest-history";

interface VaultPageProps {
  session: {
    userId: string | null;
    isSetUp: boolean;
  };
}

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "history">("list");
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
        <ActionButton size="sm" onClick={() => setView(v => (v === "list" ? "history" : "list"))}>
          {view === "history"
            ? <><ArrowLeft size={11} />Reading List</>
            : <><History size={11} />Digest History</>}
        </ActionButton>
      </div>

      {view === "history" ? (
        <DigestHistory loggedIn={!!session.userId} />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {papers.map((paper, idx) => (
            <SourceCard
              key={paper.id}
              paper={paper}
              index={idx}
              loggedIn={!!session.userId}
              initialBookmarked
              onOpen={p => setDetail(p)}
            />
          ))}
        </div>
      )}

      {detail && <ReadingPaperDetail paper={detail} index={papers.findIndex(p => p.id === detail.id)} onClose={() => setDetail(null)} />}
    </div>
  );
}

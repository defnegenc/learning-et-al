"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import { ActionButton, BODY_STYLE, DISPLAY_SM, MUTED, PageHeader, PageLoader } from "@/components/design-system";
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
          <ActionButton onClick={() => setView(v => (v === "history" ? "list" : "history"))}>
            {view === "history"
              ? <><Bookmark size={15} />Reading list</>
              : <><ArrowLeft size={15} />Back to history</>}
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "80px 0" }}>
          <span style={DISPLAY_SM}>No saved papers yet</span>
          <span style={{ ...BODY_STYLE, color: MUTED }}>
            Tap the bookmark on any paper card in your digest to save it here.
          </span>
        </div>
      ) : (
        /* The digest card at the compact size — the vault does not have a card
           of its own. Wash index is the position in the list. */
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

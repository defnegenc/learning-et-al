"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import { BODY_SM, BODY_STYLE, DIM, DISPLAY_SM, MUTED, NavTab, PageHeader, PageLoader } from "@/components/design-system";
import { ReadingPaperDetail } from "./reading-paper-detail";
import { DigestHistory } from "./digest-history";

/** How long between checks for prep that was still running when the list loaded. */
const PREP_POLL_MS = 10_000;

export function VaultPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Two shelves, equal peers — not a page with a hidden sub-view.
  const [view, setView] = useState<"history" | "list">("history");
  const [detail, setDetail] = useState<PaperItem | null>(null);
  const loaded = useRef(false);

  const fetchPapers = useCallback(async () => {
    if (!loaded.current) setLoading(true);
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error("Failed to fetch saved papers");
      const data = await res.json();
      setPapers(data.papers ?? []);
      loaded.current = true;
    } catch { setPapers([]); }
    finally { setLoading(false); }
  }, []);

  // Refetch whenever the list view becomes active so un-bookmarks made in the
  // detail overlay or on Today are reflected.
  useEffect(() => { if (view === "list") fetchPapers(); }, [view, fetchPapers]);

  // Reading prep is fired at bookmark time and takes a while. Rather than
  // leaving "getting it ready" on the card until the next navigation, poll
  // until every saved paper has its line — then stop.
  const pending = papers.filter(p => !p.companionRemember).length;
  useEffect(() => {
    if (view !== "list" || pending === 0) return;
    const t = setInterval(fetchPapers, PREP_POLL_MS);
    return () => clearInterval(t);
  }, [view, pending, fetchPapers]);

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
        <>
          <p style={{ ...BODY_STYLE, color: DIM, margin: "-24px 0 24px", maxWidth: 620 }}>
            {papers.length} saved. Open one for the walkthrough — the gist, what
            they did, what they found, where it&rsquo;s shaky, and what you can ask it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
            {papers.map((paper, idx) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                index={idx}
                size="compact"
                loggedIn
                initialBookmarked
                preview={paper.companionRemember}
                footnote={<ShelfFootnote paper={paper} />}
                onOpen={p => setDetail(p)}
                onUnsaved={id => setPapers(prev => prev.filter(p => p.id !== id))}
              />
            ))}
          </div>
        </>
      )}

      {detail && <ReadingPaperDetail paper={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/**
 * The quiet line at the foot of a shelf card: while prep is running, that it is
 * running; afterwards, the question this paper was pulled in to answer. Body
 * face, not mono — it names a thing rather than the machinery.
 */
function ShelfFootnote({ paper }: { paper: PaperItem }) {
  if (!paper.companionRemember) {
    return (
      <span style={{ ...BODY_SM, color: MUTED, fontStyle: "italic" }}>
        Reading it for you&hellip;
      </span>
    );
  }
  if (!paper.digestTheme) return null;
  return (
    <span style={{ ...BODY_SM, color: DIM }}>
      Saved from &ldquo;{paper.digestTheme}&rdquo;
    </span>
  );
}

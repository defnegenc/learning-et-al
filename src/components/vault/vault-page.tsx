"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PaperItem } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import { BODY_SM, BODY_STYLE, DIM, DISPLAY_SM, MUTED, NavTab, PageHeader, PageLoader } from "@/components/design-system";
import { useOpenLibrary } from "@/components/save-nux";
import { DigestHistory } from "./digest-history";

/** How long between checks for prep that was still running when the list loaded. */
const PREP_POLL_MS = 10_000;

export function VaultPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Two shelves, equal peers — not a page with a hidden sub-view.
  //
  // Digests opens by default only for a reader with nothing saved. Once there
  // is a library, the library is what "vault" means to them, and burying it one
  // tab behind the digest archive is half of why the reading view read as two
  // clicks deep.
  const [view, setView] = useState<"history" | "list">("history");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/papers/bookmarks")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && (d?.ids?.length ?? 0) > 0) setView("list"); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // "Go to library →" from the first-save confirmation lands on the shelf, not
  // on the digest archive.
  useOpenLibrary(useCallback(() => setView("list"), []));
  const router = useRouter();
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
            Hit &ldquo;Save&rdquo; on any paper in a digest and it lands here.
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
                // The reading view is a page with an address now, not an
                // overlay the shelf covers itself with — so back works, refresh
                // works, and the walkthrough is linkable from anywhere.
                onOpen={p => router.push(`/library/${p.id}`)}
                onUnsaved={id => setPapers(prev => prev.filter(p => p.id !== id))}
              />
            ))}
          </div>
        </>
      )}

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

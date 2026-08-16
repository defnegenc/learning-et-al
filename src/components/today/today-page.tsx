"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import dynamic from "next/dynamic";
import { BriefDigest } from "./brief-digest";
import { RegenerateCta } from "./regenerate-cta";
import { DigestHeader } from "./digest-header";
import { PaperCard } from "@/components/paper-card";


/*
 * Brief is the default experience; classic (?classic=1) is the only alternate
 * left. Loading it lazily keeps the banner — and its markdown renderer — out of
 * the bundle every normal visitor downloads before the page can paint.
 */
const SynthesisBanner = dynamic(() => import("./synthesis-banner").then(m => m.SynthesisBanner), { ssr: false });
import {
  ACID_GREEN, ACID_PINK, ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY, DISPLAY_LG, INK, Label,
  MUTED, PageLoader, SHADOW, SURFACE,
} from "@/components/design-system";
import React from "react";

/* ── Types ── */

/* ── Ink-fill title ── */
// The question arrives as hollow outline type and fills with ink one word at a
// time. Replaced the two-phase gradient sweep: same resting state, no colour,
// and because each word is its own box it survives line wrapping without
// measuring anything.
//
// The stroke goes to 0 as the fill arrives, so the headline you actually sit
// and read is exactly Display/LG with nothing left over. The stroke is 1px, not
// the prototype's 1.5px: the menu halved the headline, and 1.5px on 32px type
// is a heavier outline than 1.5px on 64px was. `key` on the h1 remounts it when
// the headline changes, restarting the fill.
function InkTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      <style>{`
        @keyframes inkFill {
          from { color: transparent; -webkit-text-stroke-width: 1px }
          to   { color: ${INK};      -webkit-text-stroke-width: 0px }
        }
        @keyframes inkFade {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        /* Desktop: word-by-word stroke fill; delay driven by CSS custom property set inline */
        .ink-word {
          display: inline-block;
          animation: inkFill 0.4s ease-out both;
          animation-delay: var(--ink-word-delay, 0s);
        }
        /* Mobile: word-by-word stroke fights line-wrapping and is not GPU-composited.
           A single opacity fade is smooth, clean, and works across any number of lines. */
        @media (max-width: 640px) {
          .ink-word {
            animation: inkFade 0.45s ease-out both;
            animation-delay: 0.1s;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ink-word { animation: none !important; color: ${INK} !important; -webkit-text-stroke-width: 0 !important }
        }
      `}</style>
      <h1 key={text} style={{ fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 5vw, 4rem)", lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.055em", color: INK, WebkitTextStrokeColor: INK, margin: "0 0 28px" }}>
        {words.map((w, i) => (
          <React.Fragment key={i}>
            <span
              className="ink-word"
              style={{ "--ink-word-delay": `${0.15 + i * 0.1}s` } as React.CSSProperties}
            >{w}</span>
            {i < words.length - 1 ? " " : ""}
          </React.Fragment>
        ))}
      </h1>
    </>
  );
}

/* ── Floating Notepad ── */
function NotepadFloat({ notes, onChange, onSave }: { notes: string; onChange: (v: string) => void; onSave: () => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleBlur = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 20, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
      {open && (
        <div style={{ width: 300, background: SURFACE, border: BORDER, boxShadow: SHADOW }}>
          <div style={{ borderBottom: BORDER, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>Notes</Label>
            <button onClick={() => setOpen(false)} aria-label="Close notes" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, color: MUTED }}>×</button>
          </div>
          <div style={{ padding: 14 }}>
            <textarea
              value={notes}
              onChange={e => { onChange(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              placeholder="Jot down your thoughts…"
              style={{ ...BODY_STYLE, width: "100%", minHeight: 120, background: "transparent", border: "none", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
            {saved && <span style={{ ...BODY_STYLE, fontSize: 13, color: ACID_GREEN }}>Saved</span>}
          </div>
        </div>
      )}
      {/* Square, like everything else — the 999px pill was the last capsule in
          the product and it read as a different product's button. */}
      <ActionButton onClick={() => setOpen(v => !v)} style={{ paddingLeft: 18, paddingRight: 18 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(-20deg)" : "none", transition: "transform 220ms" }}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
        {open ? "Close" : "Notes"}
      </ActionButton>
    </div>
  );
}

/* ── Interfaces ── */
interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  suggestedQuestions?: string[];
  suggestedAnswers?: string[];
  seedInterests?: { keyword: string; field: string }[];
  gist?: string | null;
  notes?: string | null;
  starred: boolean | null;
  hidden?: boolean | null;
  date: string;
}

interface Session {
  userId: string | null;
  isSetUp: boolean;
}

interface TodayPageProps {
  session?: Session;
  isAdmin?: boolean;
  onRegisterRefresh?: (fn: () => void) => void;
  onSignIn?: () => void;
}

export function TodayPage({ session, onRegisterRefresh, onSignIn }: TodayPageProps) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [interestKeywords, setInterestKeywords] = useState<{ keyword: string; field: string }[]>([]);

  // Load the reader's interests (keyword + field) so card tags can mark which are already
  // theirs vs. new topics they can add, and color them by field like the preferences picker.
  useEffect(() => {
    if (!session) return;
    fetch("/api/interests")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.interests) setInterestKeywords(d.interests.map((i: { keyword: string; field: string }) => ({ keyword: i.keyword, field: i.field }))); })
      .catch(() => {});
  }, [session]);
  const [loading, setLoading] = useState(true);
  const [publicDigestList, setPublicDigestList] = useState<{ id: string; date: string; theme: string | null }[]>([]);
  const [publicDigestIdx, setPublicDigestIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const handleGenerateRef = useRef<((force?: boolean) => void) | null>(null);

  /* ── Experience modes — brief is the DEFAULT; ?classic=1 selects the
     original synthesis + paper-rail view (also what /digest/[id] renders) ── */
  const [classicMode, setClassicMode] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setClassicMode(params.get("classic") === "1");
  }, []);
  // Brief is the default reading experience; everything but classic is single-column.
  const briefMode = !classicMode;
  const focusMode = !classicMode;

  /* ── Digest notes — DB-backed, tied to this digest's permanent history ──
     Single source of truth lives here; the floating notepad and the dig-deeper
     "add to notes" action both read/write this state, which persists to the DB. */
  const [notes, setNotes] = useState("");
  const lastPersistedNotes = useRef<string>("");
  const hydratedDigestId = useRef<string | null>(null);

  const saveNotes = useCallback(async (digestId: string, value: string) => {
    if (!session) return; // notes need an authenticated owner
    try {
      const res = await fetch("/api/digest/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, notes: value }),
      });
      if (res.ok) lastPersistedNotes.current = value;
    } catch {
      /* leave lastPersistedNotes unchanged so the next edit/blur retries */
    }
  }, [session]);

  // Hydrate notes when the digest changes; migrate any legacy localStorage notes once.
  useEffect(() => {
    if (!digest) return;
    if (hydratedDigestId.current === digest.id) return;
    hydratedDigestId.current = digest.id;
    const dbNotes = digest.notes ?? "";
    if (dbNotes) {
      setNotes(dbNotes);
      lastPersistedNotes.current = dbNotes;
      return;
    }
    const legacy = typeof window !== "undefined" ? localStorage.getItem(`digest_notes_${digest.id}`) : null;
    if (legacy && legacy.trim()) {
      setNotes(legacy);
      lastPersistedNotes.current = ""; // force the migration save below
      saveNotes(digest.id, legacy);
    } else {
      setNotes("");
      lastPersistedNotes.current = "";
    }
  }, [digest, session, saveNotes]);

  // Debounced autosave while typing (blur also saves immediately).
  useEffect(() => {
    if (!digest || !session) return;
    if (notes === lastPersistedNotes.current) return;
    const t = setTimeout(() => saveNotes(digest.id, notes), 800);
    return () => clearTimeout(t);
  }, [notes, digest, session, saveNotes]);

  // Append a block to the notes (used by dig-deeper "add to notes").
  const appendNote = useCallback((block: string) => {
    setNotes(prev => (prev.trim() ? `${prev}\n\n${block}` : block));
  }, []);

  // `fresh` bypasses the short private cache on /api/digest — required after
  // generating, otherwise the just-made digest can be masked by the cached one.
  const fetchDigest = useCallback(async (digestId?: string, fresh = false) => {
    try {
      const endpoint = session
        ? "/api/digest"
        : digestId
          ? `/api/public/digest?digestId=${digestId}`
          : "/api/public/digest";
      const res = await fetch(endpoint, fresh ? { cache: "no-store" } : undefined);
      if (!res.ok) return;
      const data = await res.json();
      setDigest(data.digest);
      setPapers(data.papers ?? []);
    } catch (err) {
      console.error("Failed to fetch digest:", err);
    }
  }, [session]);

  // Load public digest list for logged-out navigation
  useEffect(() => {
    if (session) return;
    fetch("/api/public/digests")
      .then(r => r.json())
      .then(list => setPublicDigestList(list))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    fetchDigest().finally(() => setLoading(false));
  }, [fetchDigest]);

  useEffect(() => {
    if (!session?.userId) return;
    fetch("/api/papers/bookmarks")
      .then(r => r.json())
      .then(data => setBookmarkedIds(new Set(data.ids ?? [])))
      .catch(() => {});
  }, [session?.userId]);

  useEffect(() => {
    if (!session || digest) return;
    const deadline = Date.now() + 4 * 60 * 1000;
    const id = setInterval(() => {
      if (Date.now() > deadline) { clearInterval(id); return; }
      fetchDigest(undefined, true); // polling for a digest that doesn't exist yet — must not be cached
    }, 10000);
    return () => clearInterval(id);
  }, [session, digest, fetchDigest]);

  useEffect(() => { handleGenerateRef.current = handleGenerate; });
  useEffect(() => { onRegisterRefresh?.(() => handleGenerateRef.current?.(true)); }, [onRegisterRefresh]);

  const handleGenerate = async (force = false) => {
    if (!session) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        await fetchDigest(undefined, true);
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error || `Generation failed (${res.status}). Check your API key in settings.`);
      }
    } catch (err) {
      setGenerateError("Network error. Couldn't reach the server.");
      console.error("Failed to generate digest:", err);
    } finally {
      setGenerating(false);
    }
  };

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  /* ── Loading state — the same PageLoader the auth gate shows, so the two
     waits look like one continuous load rather than two spinners ── */
  if (loading) return <PageLoader />;

  /* ── No digest state ── */
  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 px-4">
        <h1 style={{ ...DISPLAY_LG, textAlign: "center", margin: 0 }}>
          Today&apos;s digest is brewing
        </h1>
        <p style={{ ...BODY_STYLE, color: DIM, textAlign: "center", maxWidth: 440 }}>
          Check back soon. A fresh research digest is generated every day.
        </p>
        {session && generateError && (
          <p style={{ ...BODY_STYLE, color: ACID_PINK, maxWidth: 440, textAlign: "center" }}>{generateError}</p>
        )}
        {session && (
          <ActionButton onClick={() => handleGenerate(true)} disabled={generating}>
            {generating
              ? <><Loader2 className="size-3.5 animate-spin" /> Generating…</>
              : <><RefreshCw className="size-3.5" />{generateError ? "Try again" : "Generate today's digest"}</>}
          </ActionButton>
        )}
      </div>
    );
  }

  /* ── Derive display theme (same logic as SynthesisBanner) ── */
  const displayTheme = digest.theme || (() => {
    const lines = (digest.synthesisContent || "").split("\n").filter(l => l.trim());
    const first = lines[0] || "";
    const prefixMatch = first.match(/^today(?:'s\s+\w+| we're exploring):\s*/i);
    if (prefixMatch) {
      const after = first.slice(prefixMatch[0].length).trim();
      const sentenceEnd = after.match(/^(.+?[?!.])/);
      return sentenceEnd ? sentenceEnd[1] : after;
    }
    const sentenceEnd = first.match(/^(.+?[?!.])/);
    return sentenceEnd ? sentenceEnd[1] : first;
  })();


  /* ── Main render — two-column: synthesis | paper rail ── */
  return (
    <div style={{ maxWidth: classicMode ? 1380 : 760, margin: "0 auto" }} className="px-4 md:px-8 pt-5 md:pt-12 pb-20">
      <div className={focusMode ? "" : "grid grid-cols-1 md:grid-cols-[1fr_400px] items-start"} style={{ gap: "48px" }}>

        {/* ── Left: title + synthesis + dig deeper ── */}
        <main>
          {/* DigestTitleBlock — 28px below matches the tag→gist gap inside DigestHeader */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ marginBottom: "24px" }}>
              {/* Archive nav — above the label when browsing public digest history */}
              {!session && publicDigestList.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: 8 }}>
                  {publicDigestIdx < publicDigestList.length - 1 && (
                    <button
                      aria-label="See yesterday's digest"
                      onClick={() => {
                        const next = publicDigestIdx + 1;
                        setPublicDigestIdx(next);
                        fetchDigest(publicDigestList[next].id);
                      }}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...BODY_SM, color: DIM }}
                    >← see yesterday&apos;s digest</button>
                  )}
                  {publicDigestIdx > 0 && (
                    <button
                      aria-label="See newer digest"
                      onClick={() => {
                        const prev = publicDigestIdx - 1;
                        setPublicDigestIdx(prev);
                        fetchDigest(publicDigestList[prev].id);
                      }}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...BODY_SM, color: DIM }}
                    >see newer digest →</button>
                  )}
                </div>
              )}
              <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, lineHeight: "20px", color: INK }}>
                Daily digest
              </div>
              {generateError && (
                <span style={{ ...BODY_SM, color: ACID_PINK, display: "block", marginTop: 4 }} title={generateError}>
                  {generateError}
                </span>
              )}
            </div>

            <InkTitle text={displayTheme} />

            <DigestHeader
              seedInterests={digest.seedInterests}
              gist={digest.gist}
              keyConcepts={digest.keyConcepts}
              topics={(() => {
                // Digest topics beyond your interests: paper keywords first (the
                // pipeline's topic labels), then key-concept terms, deduped and
                // capped so the row stays one calm line.
                const seeded = new Set((digest.seedInterests || []).map((s) => s.keyword.toLowerCase()));
                const candidates = [
                  ...papers.flatMap((p) => p.keywords),
                  ...(digest.keyConcepts || []).map((c) => (c.includes(": ") ? c.split(": ")[0] : c).trim()),
                ];
                const out: string[] = [];
                for (const t of candidates) {
                  const k = t.toLowerCase();
                  if (!t || seeded.has(k) || out.some((o) => o.toLowerCase() === k)) continue;
                  out.push(t);
                  if (out.length >= 3) break;
                }
                return out;
              })()}
              isLoggedIn={!!session}
              onSignIn={onSignIn}
            />

          </div>

          {/* Synthesis — brief by default, classic banner behind ?classic=1 */}
          {digest.synthesisContent && briefMode && digest.id ? (
            <BriefDigest
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              papers={papers}
              digestId={digest.id}
              loggedIn={!!session?.userId}
              interests={interestKeywords}
              seedField={digest.seedInterests?.[0]?.field}
              savedIds={bookmarkedIds}
              endSlot={session ? (
                <RegenerateCta digestId={digest.id} generating={generating} onRegenerate={() => handleGenerate(true)} />
              ) : undefined}
            />
          ) : digest.synthesisContent ? (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              suggestedQuestions={digest.suggestedQuestions}
              suggestedAnswers={digest.suggestedAnswers}
              digestId={digest.id}
              activeConcept={activeConcept}
              onConceptClick={(concept) => setActiveConcept(prev => prev === concept ? null : concept)}
              papers={papers}
              onSelectPaper={openSource}
              onRegenerate={() => handleGenerate(true)}
              generating={generating}
              onAppendNote={appendNote}
              onSignIn={onSignIn}
              hideHeader
              hideInteractionUI
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16">
              <Label>{(session && generateError) || "No digest found for today"}</Label>
              {session && (
                <ActionButton variant="primary" onClick={() => handleGenerate(true)} disabled={generating}>
                  {generating
                    ? <><Loader2 className="size-3.5 animate-spin" /> Generating…</>
                    : <><RefreshCw className="size-3.5" /> Generate digest</>}
                </ActionButton>
              )}
            </div>
          )}

          {/* Digest-level Q&A removed — questions now live on reading-list papers
              (the reading companion's "Ask this paper" thread). */}
        </main>

        {/* ── Right: paper rail (focus modes reveal cards inline instead) ── */}
        {papers.length > 0 && !focusMode && (
          <aside>
            <Label style={{ marginBottom: 16 }}>Referenced sources</Label>
            {/* The same card the digest renders, smaller. There is no rail-only
                card component any more. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {papers.map((paper, idx) => (
                <PaperCard key={paper.id} paper={paper} index={idx} size="compact" loggedIn={!!session?.userId} initialBookmarked={bookmarkedIds.has(paper.id)} />
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* ── Floating notepad — desktop only ── */}
      {digest.id && session && (
        <div className="hidden md:block">
          <NotepadFloat notes={notes} onChange={setNotes} onSave={() => saveNotes(digest.id, notes)} />
        </div>
      )}
    </div>
  );
}

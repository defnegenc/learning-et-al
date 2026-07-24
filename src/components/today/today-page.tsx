"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { PaperItem } from "./paper-card";
import { SourceCard, SOURCE_PALETTES } from "./source-card";
import { SynthesisBanner } from "./synthesis-banner";
import { BriefDigest } from "./brief-digest";
import { RegenerateCta } from "./regenerate-cta";
import { DigestHeader } from "./digest-header";
import { PapersMode } from "./papers-mode";
import { PapersModeOg } from "./papers-mode-og";
import React from "react";

/* ── Types ── */

/* ── Animated sweep title ── */
// Phase "exit-prep" instantly switches background anchor to right (no visual change at 100% size),
// then "exit" animates size→0 with right anchor so the bar collapses left-to-right.
type BarPhase = "hidden" | "in" | "exit-prep" | "exit";

function SweepTitle({ text, palettes }: { text: string; palettes: [string, string][] }) {
  const [p1, setP1] = useState<BarPhase>("hidden");
  const [p2, setP2] = useState<BarPhase>("hidden");

  const VERBS = new Set(["drive", "drives", "shape", "shapes", "affect", "affects", "are", "is",
    "make", "makes", "help", "helps", "change", "changes", "influence", "influences",
    "determine", "determines", "impact", "impacts", "reveal", "reveals", "show", "shows",
    "explain", "explains", "challenge", "challenges", "use", "uses", "enable", "enables",
    "transform", "transforms", "predict", "predicts", "blur", "blurs", "define", "defines"]);
  const words = text.split(" ");
  let splitIdx = -1;
  for (let i = 1; i < words.length - 1; i++) {
    if (VERBS.has(words[i].replace(/[^a-z]/gi, "").toLowerCase())) { splitIdx = i; break; }
  }
  if (splitIdx <= 0) splitIdx = Math.ceil(words.length / 2);

  const phrase1 = words.slice(0, splitIdx).join(" ");
  const phrase2 = words.slice(splitIdx).join(" ");

  useEffect(() => {
    setP1("hidden"); setP2("hidden");
    const ts = [
      setTimeout(() => setP1("in"), 200),
      setTimeout(() => setP1("exit-prep"), 830),  // instant anchor switch (no visual change)
      setTimeout(() => setP1("exit"), 845),         // now animate size→0 from right anchor
      setTimeout(() => setP2("in"), 1060),
      setTimeout(() => setP2("exit-prep"), 1690),
      setTimeout(() => setP2("exit"), 1705),
    ];
    return () => ts.forEach(clearTimeout);
  }, [text]);

  // Uses display:inline + background-image so the bar follows text wrapping per-line,
  // not the inline-block box width (which overshoot on wrapped lines).
  const phraseStyle = (phase: BarPhase, c1: string, c2: string): React.CSSProperties => {
    const rightAnchor = phase === "exit-prep" || phase === "exit";
    return {
      display: "inline",
      backgroundImage: `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: rightAnchor ? "right bottom" : "left bottom",
      backgroundSize: (phase === "in" || phase === "exit-prep") ? "100% 9px" : "0% 9px",
      transition: phase === "in"   ? "background-size 0.52s ease-in-out"
                : phase === "exit" ? "background-size 0.44s ease-in-out"
                : "none",
      paddingBottom: "10px",
    };
  };

  const [a1, b1] = palettes[0];
  const [a2, b2] = palettes[1 % palettes.length];

  return (
    <h1 style={{
      fontFamily: "var(--font-display), sans-serif",
      fontSize: "clamp(2.75rem, 5vw, 4rem)",
      lineHeight: 1.25, fontWeight: 700,
      letterSpacing: "-0.055em", color: "#1a1a1a",
      margin: "0 0 28px",
    }}>
      <span style={phraseStyle(p1, a1, b1)}>{phrase1}</span>
      {" "}
      <span style={phraseStyle(p2, a2, b2)}>{phrase2}</span>
    </h1>
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
        <div style={{ width: 300, background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 #1a1a1a" }}>
          <div style={{ borderBottom: "2px solid #1a1a1a", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.65rem", letterSpacing: "2px", fontWeight: 700, textTransform: "uppercase" }}>Notes</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "#666" }}>×</button>
          </div>
          <div style={{ padding: 14 }}>
            <textarea
              value={notes}
              onChange={e => { onChange(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              placeholder="Jot down your thoughts..."
              style={{ width: "100%", minHeight: 120, background: "transparent", border: "none", outline: "none", resize: "vertical", fontSize: "0.875rem", lineHeight: 1.65, color: "#333", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            {saved && <span style={{ fontSize: "0.6rem", color: "#38b000", fontFamily: "var(--font-mono), monospace" }}>Saved</span>}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "10px 18px 10px 40px", position: "relative",
          background: open ? "#FFF4B8" : "#fff",
          border: "2px solid #1a1a1a", borderRadius: 999,
          cursor: "pointer", fontFamily: "var(--font-display), sans-serif",
          fontSize: "0.8rem", fontWeight: 700, letterSpacing: 0.5, color: "#1a1a1a",
          textTransform: "uppercase", display: "inline-flex", alignItems: "center",
          boxShadow: "3px 3px 0 #1a1a1a", transition: "transform 150ms, box-shadow 150ms",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 #1a1a1a"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #1a1a1a"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 12, transform: open ? "rotate(-20deg)" : "none", transition: "transform 220ms" }}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
        {open ? "Close" : "Notes"}
      </button>
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

export function TodayPage({ session, isAdmin = false, onRegisterRefresh, onSignIn }: TodayPageProps) {
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

  /* ── Experience modes — brief is the DEFAULT; flags select alternatives ──
     ?classic=1 → original synthesis + paper-rail view
     ?papers=1 / ?papersog=1 → paper-first comparison variants                */
  const [papersMode, setPapersMode] = useState(false);
  const [papersOgMode, setPapersOgMode] = useState(false);
  const [classicMode, setClassicMode] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPapersMode(params.get("papers") === "1");
    setPapersOgMode(params.get("papersog") === "1");
    setClassicMode(params.get("classic") === "1");
  }, []);
  // Brief is the default reading experience; everything but classic is single-column.
  const briefMode = !papersMode && !papersOgMode && !classicMode;
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

  const fetchDigest = useCallback(async (digestId?: string) => {
    try {
      const endpoint = session
        ? "/api/digest"
        : digestId
          ? `/api/public/digest?digestId=${digestId}`
          : "/api/public/digest";
      const res = await fetch(endpoint);
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
      fetchDigest();
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
        await fetchDigest();
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error || `Generation failed (${res.status}). Check your API key in settings.`);
      }
    } catch (err) {
      setGenerateError("Network error — couldn't reach the server.");
      console.error("Failed to generate digest:", err);
    } finally {
      setGenerating(false);
    }
  };

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#666]" />
      </div>
    );
  }

  /* ── No digest state ── */
  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 px-4">
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.03em", textAlign: "center" }}>
          Today&apos;s digest is brewing
        </h1>
        <p style={{ fontSize: "1rem", color: "#999", textAlign: "center", maxWidth: "440px" }}>
          Check back soon — a fresh research digest is generated every day.
        </p>
        {session && generateError && (
          <p className="text-[0.75rem] text-[#ff007f] max-w-md text-center">{generateError}</p>
        )}
        {session && (
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="border border-[#1a1a1a] px-4 py-2 text-[0.65rem] uppercase tracking-[2px] hover:bg-[#1a1a1a] hover:text-[#e8e8e8] transition-colors disabled:opacity-50"
            style={{ borderWidth: "1.5px", fontFamily: "var(--font-mono), monospace" }}
          >
            {generating ? (
              <span className="flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> GENERATING...</span>
            ) : (
              <span className="flex items-center gap-2"><RefreshCw className="size-3" />{generateError ? "Try again" : "Generate today's digest"}</span>
            )}
          </button>
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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  /* ── Main render — two-column: synthesis | paper rail ── */
  return (
    <div style={{ maxWidth: papersMode ? 1100 : classicMode ? 1380 : 760, margin: "0 auto" }} className="px-4 md:px-8 pt-5 md:pt-12 pb-20">
      <div className={focusMode ? "" : "grid grid-cols-1 md:grid-cols-[1fr_400px] items-start"} style={{ gap: "48px" }}>

        {/* ── Left: title + synthesis + dig deeper ── */}
        <main>
          {/* DigestTitleBlock — 28px below matches the tag→gist gap inside DigestHeader */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Daily digest
                </span>
                {!session && publicDigestList.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      disabled={publicDigestIdx >= publicDigestList.length - 1}
                      onClick={() => {
                        const next = publicDigestIdx + 1;
                        setPublicDigestIdx(next);
                        fetchDigest(publicDigestList[next].id);
                      }}
                      style={{ background: "none", border: "1px solid #ddd", cursor: publicDigestIdx >= publicDigestList.length - 1 ? "default" : "pointer", padding: "2px 8px", fontSize: "0.75rem", color: publicDigestIdx >= publicDigestList.length - 1 ? "#ccc" : "#555" }}
                    >←</button>
                    <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", color: "#999", whiteSpace: "nowrap" }}>
                      {new Date(publicDigestList[publicDigestIdx]?.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <button
                      disabled={publicDigestIdx <= 0}
                      onClick={() => {
                        const prev = publicDigestIdx - 1;
                        setPublicDigestIdx(prev);
                        fetchDigest(publicDigestList[prev].id);
                      }}
                      style={{ background: "none", border: "1px solid #ddd", cursor: publicDigestIdx <= 0 ? "default" : "pointer", padding: "2px 8px", fontSize: "0.75rem", color: publicDigestIdx <= 0 ? "#ccc" : "#555" }}
                    >→</button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {generateError && (
                  <span style={{ fontSize: "0.6rem", color: "#ff007f", fontFamily: "var(--font-mono), monospace", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={generateError}>
                    {generateError}
                  </span>
                )}
              </div>
            </div>

            <SweepTitle text={displayTheme} palettes={SOURCE_PALETTES} />

            <DigestHeader
              seedInterests={digest.seedInterests}
              gist={digest.gist}
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

          {/* Synthesis — gated experiences swap in here:
              ?papers=1 → paper-first (verdict + 3 cards you interrogate)
              ?brief=1  → dig-through (scroll-revealed verdict, inline cards, threads) */}
          {digest.synthesisContent && papersOgMode && digest.id ? (
            <PapersModeOg
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              papers={papers}
              digestId={digest.id}
              isLoggedIn={!!session}
              onSignIn={onSignIn}
            />
          ) : digest.synthesisContent && papersMode && digest.id ? (
            <PapersMode
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              papers={papers}
              digestId={digest.id}
              isLoggedIn={!!session}
              onSignIn={onSignIn}
            />
          ) : digest.synthesisContent && briefMode && digest.id ? (
            <BriefDigest
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              papers={papers}
              digestId={digest.id}
              interests={interestKeywords}
              seedField={digest.seedInterests?.[0]?.field}
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
              <p className="text-[0.65rem] uppercase tracking-[2px] text-[#888]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                {(session && generateError) || "No digest found for today"}
              </p>
              {session && (
                <button onClick={() => handleGenerate(true)} disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[2px] bg-[#1a1a1a] text-white disabled:opacity-50"
                  style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}>
                  {generating ? <><Loader2 className="size-3 animate-spin" /> Generating...</> : <><RefreshCw className="size-3" /> Generate digest</>}
                </button>
              )}
            </div>
          )}

          {/* Digest-level Q&A removed — questions now live on reading-list papers
              (the reading companion's "Ask this paper" thread). */}
        </main>

        {/* ── Right: paper rail (focus modes reveal cards inline instead) ── */}
        {papers.length > 0 && !focusMode && (
          <aside>
            <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "16px" }}>
              Referenced sources
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {papers.map((paper, idx) => (
                <SourceCard key={paper.id} paper={paper} index={idx} loggedIn={!!session?.userId} initialBookmarked={bookmarkedIds.has(paper.id)} />
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

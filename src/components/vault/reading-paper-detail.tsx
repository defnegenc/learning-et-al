"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { paperByline, READING_BODY } from "@/components/paper-card";
import {
  ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM, GOLD,
  HAIRLINE, INK, MUTED, SHADOW, SURFACE, TextInput,
  foundationalSlots, foundationalWash, wash, washSlots,
} from "@/components/design-system";

type Jargon = { term: string; def: string };

export interface Companion {
  gist: string;
  did: string;
  found: string;
  caveats: string;
  remember: string;
  glossary: Jargon[];
  questions: string[];
}

export interface HomeworkItem {
  openAlexId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  pdfUrl: string | null;
  abstract: string;
  citationCount: number;
}

export interface QaPair {
  id: string;
  question: string;
  answer: string;
}

/**
 * Everything this view normally fetches, handed to it instead.
 *
 * `/prototype/reading-list` renders the real component against sample data with
 * no database, no session and no model behind it — which is the only way to
 * review this page's typography and rhythm without a signed-in account and a
 * populated reading list. Production never passes it; absent, every fetch runs
 * exactly as before.
 */
export interface ReadingFixture {
  companion: Companion | null;
  homework: HomeworkItem[];
  qa: QaPair[];
  /** Stands in for the model when a question is asked. */
  answer: (question: string) => string;
}

/**
 * Interleave TermChips into a text block at the first occurrence of each term.
 *
 * `used` is passed in rather than owned, so a term defined in the gist is not
 * defined again three paragraphs later — the walkthrough is one continuous read,
 * not five independent blocks.
 */
function annotateText(text: string, jargon: Jargon[], used: Set<string>, tint: string): React.ReactNode[] {
  const sorted = [...jargon].sort((a, b) => b.term.length - a.term.length);
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let best: { i: number; len: number; j: Jargon } | null = null;
    for (const j of sorted) {
      if (used.has(j.term.toLowerCase())) continue;
      const i = rest.toLowerCase().indexOf(j.term.toLowerCase());
      if (i >= 0 && (!best || i < best.i)) best = { i, len: j.term.length, j };
    }
    if (!best) { out.push(<span key={key++}>{rest}</span>); break; }
    used.add(best.j.term.toLowerCase());
    if (best.i > 0) out.push(<span key={key++}>{rest.slice(0, best.i)}</span>);
    out.push(<TermChip key={key++} text={rest.slice(best.i, best.i + best.len)} def={best.j.def} tint={tint} />);
    rest = rest.slice(best.i + best.len);
  }
  return out;
}

/** One beat of the walkthrough: a Display/SM heading over a paragraph. */
function Beat({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: HAIRLINE, paddingTop: 22, marginTop: 22 }}>
      <h2 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{heading}</h2>
      <p style={{ ...READING_BODY, margin: 0 }}>{children}</p>
    </section>
  );
}

// Follow-up work reads as a plain list, not as cards — one hairline-separated
// row per paper with a save control on the right.
function HomeworkRow({ item, sourcePaperId }: { item: HomeworkItem; sourcePaperId: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/papers/save-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePaperId, item }),
      });
      if (res.ok) setSaved(true);
    } catch { /* leave unsaved */ }
    finally { setSaving(false); }
  }

  const meta = [
    item.year ? String(item.year) : "",
    item.venue || "",
    item.citationCount > 0 ? `${item.citationCount} citations` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 0", borderTop: HAIRLINE }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={item.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...DISPLAY_SM, textDecoration: item.url ? "underline" : "none", textUnderlineOffset: 4 }}
        >
          {item.title}
        </a>
        <div style={{ ...BODY_STYLE, color: MUTED, marginTop: 8 }}>{meta}</div>
      </div>
      <button
        onClick={save}
        title={saved ? "In your reading list" : "Save to reading list"}
        style={{ background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0, flexShrink: 0, color: INK, marginTop: 3 }}
      >
        {saving
          ? <Loader2 size={15} className="animate-spin" />
          : <Bookmark size={15} fill={saved ? INK : "none"} />}
      </button>
    </div>
  );
}

/**
 * The closing recap of every hard word. The chips in the prose define each term
 * where you meet it; this catches the ones the companion flagged but never used
 * in its own copy, and gives you somewhere to look back to. Closed by default —
 * it is a reference, not part of the read.
 */
function Glossary({ terms }: { terms: Jargon[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 40, borderTop: HAIRLINE, paddingTop: 18 }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ ...DISPLAY_SM, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <span style={{ color: MUTED }}>{open ? "–" : "+"}</span>
        Glossary ({terms.length})
      </button>
      {open && (
        <dl style={{ margin: "16px 0 0" }}>
          {terms.map(g => (
            <div key={g.term} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: HAIRLINE }}>
              <dt style={{ ...BODY_STYLE, fontWeight: 600, width: 150, flexShrink: 0 }}>{g.term}</dt>
              <dd style={{ ...BODY_STYLE, color: DIM, margin: 0, flex: 1 }}>{g.def}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Ask this paper — the thread.
 *
 * The companion hands over three starter questions it thinks a curious reader
 * would actually want answered; they're rows in the same list idiom as the
 * citing work, so the page has one way of offering you a next thing. Answers
 * come from /api/papers/[id]/qa, which reads the full text, and the thread is
 * persisted per user, so a paper you came back to still has what you asked.
 */
function AskThread({ paperId, starters, fixture }: { paperId: string; starters: string[]; fixture?: ReadingFixture }) {
  const [pairs, setPairs] = useState<QaPair[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (fixture) {
        setPairs(fixture.qa);
        fixture.qa.forEach(p => asked.current.add(p.question));
        return;
      }
      try {
        const res = await fetch(`/api/papers/${paperId}/qa`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.qaPairs)) {
          setPairs(data.qaPairs);
          data.qaPairs.forEach((p: QaPair) => asked.current.add(p.question));
        }
      } catch { /* an empty thread is the right fallback */ }
    })();
    return () => { cancelled = true; };
  }, [paperId, fixture]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(q);
    setFailed(false);
    try {
      if (fixture) {
        // A beat, so the pending state is reviewable rather than a flash.
        await new Promise(r => setTimeout(r, 900));
        setPairs(prev => [...prev, { id: `fx-${prev.length}`, question: q, answer: fixture.answer(q) }]);
        asked.current.add(q);
        setDraft("");
        return;
      }
      const res = await fetch(`/api/papers/${paperId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (data.qaPair) {
        setPairs(prev => [...prev, data.qaPair]);
        asked.current.add(q);
        setDraft("");
      } else setFailed(true);
    } catch { setFailed(true); }
    finally { setAsking(null); }
  }

  const remaining = starters.filter(q => !asked.current.has(q));
  const empty = pairs.length === 0 && !asking;

  return (
    <div
      style={{
        border: BORDER, boxShadow: SHADOW, background: SURFACE,
        display: "flex", flexDirection: "column",
      }}
      className="reading-ask"
    >
      <div style={{ padding: "16px 18px 14px", borderBottom: BORDER, flexShrink: 0 }}>
        <h2 style={{ ...DISPLAY_SM, margin: 0 }}>Ask this paper</h2>
        <p style={{ ...BODY_SM, color: MUTED, margin: "6px 0 0" }}>
          Answered from the paper itself, not from the digest.
        </p>
      </div>

      <div style={{ overflowY: "auto", padding: "0 18px", flex: 1, minHeight: 0 }}>
        {pairs.map((pair, i) => (
          <div key={pair.id} style={{ padding: "16px 0", borderTop: i === 0 ? "none" : HAIRLINE }}>
            <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 8px" }}>{pair.question}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <span aria-hidden style={{ width: 2, flexShrink: 0, background: INK }} />
              <p style={{ ...BODY_STYLE, margin: 0 }}>{pair.answer}</p>
            </div>
          </div>
        ))}

        {asking && (
          <div style={{ padding: "16px 0", borderTop: pairs.length ? HAIRLINE : "none" }}>
            <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 8px" }}>{asking}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
              <span style={{ ...BODY_STYLE, color: MUTED }}>Looking it up&hellip;</span>
            </div>
          </div>
        )}

        {remaining.length > 0 && (
          <div style={{ paddingBottom: 4 }}>
            {empty && (
              <p style={{ ...BODY_SM, color: MUTED, margin: "16px 0 0" }}>
                Three the companion thought you&rsquo;d want:
              </p>
            )}
            {remaining.map((q, i) => (
              <button
                key={q}
                onClick={() => ask(q)}
                disabled={!!asking}
                style={{
                  ...BODY_STYLE,
                  display: "flex",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderTop: empty && i === 0 ? "none" : HAIRLINE,
                  background: "transparent",
                  padding: "14px 0",
                  cursor: asking ? "default" : "pointer",
                  opacity: asking ? 0.4 : 1,
                }}
              >
                <span aria-hidden style={{ color: MUTED, flexShrink: 0 }}>→</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px", borderTop: BORDER, flexShrink: 0 }}>
        <TextInput
          value={draft}
          onChange={setDraft}
          onKeyDown={e => { if (e.key === "Enter") ask(draft); }}
          placeholder="Ask your own question…"
          ariaLabel="Ask a question about this paper"
        />
        <ActionButton
          onClick={() => ask(draft)}
          variant="primary"
          shadow={false}
          disabled={!draft.trim() || !!asking}
          style={{ width: "100%", marginTop: 8 }}
        >
          Ask
        </ActionButton>
        {failed && (
          <p style={{ ...BODY_SM, color: MUTED, margin: "10px 0 0" }}>
            That one didn&rsquo;t come back. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Full-screen reading view: the companion walkthrough, then the thread, then
 * what's happened since.
 *
 * The point of this page is that you get the paper without reading the paper.
 * The companion has always been generated in five parts at bookmark time — the
 * gist, the method, the results, the caveats and the one line to remember — and
 * this view used to render only the first. All five are here now, as one
 * continuous read with hard words defined in place, and the questions the
 * companion suggests are live rather than decorative.
 */
export function ReadingPaperDetail({ paper, index = 0, onClose, fixture }: {
  paper: PaperItem;
  /**
   * The paper's position on the shelf — its wash index, so this page wears the
   * same hue as the card it was opened from. Highlights inside a paper's own
   * page are wayfinding for once rather than decoration: every hard word here
   * belongs to this paper, so colouring them says which paper you are inside.
   */
  index?: number;
  onClose: () => void;
  /** Prototype only — see `ReadingFixture`. */
  fixture?: ReadingFixture;
}) {
  const byline = paperByline(paper);
  const foundational = paper.category === "foundational";
  // The same mark the digest card's takeaway wears: the first of the card's two
  // wash hues. Never GOLD — that is a line colour, and behind a word it is too
  // dark to read the word through.
  const hue = foundational ? foundationalSlots()[0] : washSlots(index)[0];

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [companionPending, setCompanionPending] = useState(true);
  const [homework, setHomework] = useState<HomeworkItem[] | null>(null);
  const [mounted, setMounted] = useState(false);

  // Full-screen means the page behind must not scroll with it (the source of the
  // jittery double-scroll on mobile).
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Companion + homework: use the cache if the bookmark already generated
  // them, otherwise trigger generation now and wait.
  useEffect(() => {
    if (fixture) {
      setCompanion(fixture.companion);
      setCompanionPending(false);
      setHomework(fixture.homework);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/companion`);
        let data = await res.json();
        if (!data.companion) {
          const gen = await fetch(`/api/papers/${paper.id}/companion`, { method: "POST" });
          data = await gen.json();
        }
        if (!cancelled) setCompanion(data.companion ?? null);
      } catch { /* companion stays null */ }
      finally { if (!cancelled) setCompanionPending(false); }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/homework`);
        let data = await res.json();
        if (!data.homework) {
          const gen = await fetch(`/api/papers/${paper.id}/homework`, { method: "POST" });
          data = await gen.json();
        }
        if (!cancelled) setHomework(data.homework ?? []);
      } catch { if (!cancelled) setHomework([]); }
    })();
    return () => { cancelled = true; };
  }, [paper.id, fixture]);

  // One shared "already defined" set for the whole walkthrough, rebuilt on each
  // render so the chips land in the same places every time.
  const glossary = companion?.glossary ?? [];
  const defined = new Set<string>();
  const mark = (text: string) => annotateText(text, glossary, defined, hue);

  const detail = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: SURFACE,
        overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}
    >
      <div
        style={{ maxWidth: 1240, margin: "0 auto", paddingTop: "max(24px, env(safe-area-inset-top))" }}
        className="px-5 md:px-8 pb-24"
      >
        {/* The top bar: out of the page on the left, into the paper on the
            right. The source link used to sit below the walkthrough, where it
            read as the end of the page rather than the way out of it. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 28 }}>
          <button
            onClick={onClose}
            style={{ ...BODY_STYLE, display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0 }}
          >
            <ArrowLeft size={15} /> Back
          </button>
          {paper.sourceUrl && (
            <a
              href={paper.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ds-lift"
              style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "10px 18px", textDecoration: "none", flexShrink: 0 }}
            >
              Read the full paper ↗
            </a>
          )}
        </div>

        <div className="reading-shell">
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>{paper.title}</h1>
            {byline && (
              <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "0 0 32px" }}>{byline}</p>
            )}

            {/* ── The gist ── */}
            {companionPending ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
                <span style={{ ...BODY_STYLE, color: MUTED }}>Reading the paper…</span>
              </div>
            ) : companion?.gist ? (
              <p style={{ ...READING_BODY, margin: 0 }}>{mark(companion.gist)}</p>
            ) : paper.abstract ? (
              <p style={{ ...READING_BODY, margin: 0 }}>{paper.abstract}</p>
            ) : (
              <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic", margin: 0 }}>No summary available.</p>
            )}

            {/* ── The walkthrough — the beats after the gist ── */}
            {companion?.did && <Beat heading="What they did">{mark(companion.did)}</Beat>}
            {companion?.found && <Beat heading="What they found">{mark(companion.found)}</Beat>}
            {companion?.caveats && <Beat heading="Where it's shaky">{mark(companion.caveats)}</Beat>}

            {/* The one line worth keeping, in the card's own frame and wash — so
                the page closes on the object it opened from. */}
            {companion?.remember && (
              <div
                style={{
                  ...(foundational ? foundationalWash() : wash(index)),
                  border: `2px solid ${foundational ? GOLD : INK}`,
                  boxShadow: `5px 5px 0 0 ${foundational ? GOLD : INK}`,
                  padding: "22px 24px",
                  marginTop: 32,
                }}
              >
                <h2 style={{ ...DISPLAY_SM, color: DIM, margin: "0 0 12px" }}>Remember this</h2>
                <p style={{ ...READING_BODY, fontWeight: 600, margin: 0 }}>{companion.remember}</p>
              </div>
            )}

            {/* ── The glossary ── */}
            {glossary.length > 0 && <Glossary terms={glossary} />}

            {/* ── What's happened since ── */}
            <h2 style={{ ...DISPLAY_LG, margin: "56px 0 6px" }}>What&apos;s happened since</h2>
            <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 10px" }}>
              Newer work that cites this paper.
            </p>
            {homework === null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0" }}>
                <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
                <span style={{ ...BODY_STYLE, color: MUTED }}>Looking for follow-up work…</span>
              </div>
            ) : homework.length === 0 ? (
              <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic", margin: "12px 0 0" }}>Nothing citing this yet — it may be too new.</p>
            ) : (
              <div>
                {homework.map(item => (
                  <HomeworkRow key={item.openAlexId || item.title} item={item} sourcePaperId={paper.id} />
                ))}
              </div>
            )}
          </div>

          {/* ── Ask this paper, in the rail ── */}
          <aside className="reading-aside">
            {!companionPending && (
              <AskThread paperId={paper.id} starters={companion?.questions ?? []} fixture={fixture} />
            )}
          </aside>
        </div>

        <style>{`
          .reading-shell { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 56px; align-items: start; }
          /* The rail holds position while the walkthrough scrolls past it, and
             the thread scrolls inside its own frame so the composer never
             leaves the viewport. */
          .reading-aside { position: sticky; top: 8px; }
          .reading-ask { max-height: calc(100vh - 100px); }
          @media (max-width: 1060px) {
            .reading-shell { grid-template-columns: 1fr; gap: 0; }
            .reading-aside { position: static; margin-top: 56px; }
            .reading-ask { max-height: none; }
          }
        `}</style>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(detail, document.body);
}

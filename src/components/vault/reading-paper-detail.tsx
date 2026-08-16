"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { paperByline, READING_BODY } from "@/components/paper-card";
import {
  ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, MUTED, SHADOW, SURFACE, TextInput,
} from "@/components/design-system";

type Jargon = { term: string; def: string };

interface Companion {
  gist: string;
  did: string;
  found: string;
  caveats: string;
  remember: string;
  glossary: Jargon[];
  questions: string[];
}

interface HomeworkItem {
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

interface QaPair {
  id: string;
  question: string;
  answer: string;
}

/**
 * Interleave TermChips into a text block at the first occurrence of each term.
 *
 * `used` is passed in rather than owned, so a term defined in the gist is not
 * defined again three paragraphs later — the walkthrough is one continuous read,
 * not five independent blocks.
 */
function annotateText(text: string, jargon: Jargon[], used: Set<string>): React.ReactNode[] {
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
    out.push(<TermChip key={key++} text={rest.slice(best.i, best.i + best.len)} def={best.j.def} />);
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

/** The page's big heading — used for the two sections that are not the paper. */
function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h2 style={{ ...DISPLAY_LG, margin: "56px 0 6px" }}>{title}</h2>
      <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 10px" }}>{sub}</p>
    </>
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
        Every hard word, defined ({terms.length})
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
function AskThread({ paperId, starters }: { paperId: string; starters: string[] }) {
  const [pairs, setPairs] = useState<QaPair[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
  }, [paperId]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(q);
    setFailed(false);
    try {
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

  return (
    <>
      <SectionHead
        title="Ask this paper"
        sub="Answers are read out of the full text, not the abstract."
      />

      {pairs.map(pair => (
        <div key={pair.id} style={{ borderTop: HAIRLINE, padding: "18px 0" }}>
          <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 10px" }}>{pair.question}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <span aria-hidden style={{ width: 2, flexShrink: 0, background: INK }} />
            <p style={{ ...READING_BODY, margin: 0 }}>{pair.answer}</p>
          </div>
        </div>
      ))}

      {asking && (
        <div style={{ borderTop: HAIRLINE, padding: "18px 0" }}>
          <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 10px" }}>{asking}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
            <span style={{ ...BODY_STYLE, color: MUTED }}>Looking it up&hellip;</span>
          </div>
        </div>
      )}

      {remaining.map(q => (
        <button
          key={q}
          onClick={() => ask(q)}
          disabled={!!asking}
          style={{
            ...READING_BODY,
            display: "block",
            width: "100%",
            textAlign: "left",
            border: "none",
            borderTop: HAIRLINE,
            background: "transparent",
            padding: "16px 0",
            cursor: asking ? "default" : "pointer",
            opacity: asking ? 0.4 : 1,
          }}
        >
          <span style={{ color: MUTED, marginRight: 10 }}>→</span>
          {q}
        </button>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <TextInput
          value={draft}
          onChange={setDraft}
          onKeyDown={e => { if (e.key === "Enter") ask(draft); }}
          placeholder="Ask your own question…"
          ariaLabel="Ask a question about this paper"
        />
        <ActionButton onClick={() => ask(draft)} disabled={!draft.trim() || !!asking} style={{ flexShrink: 0 }}>
          Ask
        </ActionButton>
      </div>
      {failed && (
        <p style={{ ...BODY_SM, color: MUTED, margin: "10px 0 0" }}>
          That one didn&rsquo;t come back. Try again.
        </p>
      )}
    </>
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
export function ReadingPaperDetail({ paper, onClose }: { paper: PaperItem; onClose: () => void }) {
  const byline = paperByline(paper);

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [companionPending, setCompanionPending] = useState(true);
  const [homework, setHomework] = useState<HomeworkItem[] | null>(null);

  // Full-screen means the page behind must not scroll with it (the source of the
  // jittery double-scroll on mobile).
  useEffect(() => {
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
  }, [paper.id]);

  // One shared "already defined" set for the whole walkthrough, rebuilt on each
  // render so the chips land in the same places every time.
  const glossary = companion?.glossary ?? [];
  const defined = new Set<string>();
  const mark = (text: string) => annotateText(text, glossary, defined);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 80, background: SURFACE,
        overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }} className="px-5 md:px-8 pt-6 pb-24">
        <button
          onClick={onClose}
          style={{ ...BODY_STYLE, display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0, marginBottom: 28 }}
        >
          <ArrowLeft size={15} /> Back
        </button>

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

        {/* ── The walkthrough — the four beats after the gist ── */}
        {companion?.did && <Beat heading="What they did">{mark(companion.did)}</Beat>}
        {companion?.found && <Beat heading="What they found">{mark(companion.found)}</Beat>}
        {companion?.caveats && <Beat heading="Where it's shaky">{mark(companion.caveats)}</Beat>}

        {/* The one line worth keeping gets the page's biggest voice, inside the
            one framed shape in the product. */}
        {companion?.remember && (
          <div style={{ border: BORDER, boxShadow: SHADOW, background: SURFACE, padding: "22px 24px", marginTop: 32 }}>
            <h2 style={{ ...DISPLAY_SM, color: MUTED, margin: "0 0 12px" }}>Remember this</h2>
            <p style={{ ...DISPLAY_LG, margin: 0 }}>{companion.remember}</p>
          </div>
        )}

        {paper.sourceUrl && (
          <a
            href={paper.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-lift"
            style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "12px 22px", textDecoration: "none", marginTop: 32 }}
          >
            Read the full paper ↗
          </a>
        )}

        {/* ── The glossary, as a closing list ── */}
        {glossary.length > 0 && <Glossary terms={glossary} />}

        {/* ── Ask this paper ── */}
        {!companionPending && <AskThread paperId={paper.id} starters={companion?.questions ?? []} />}

        {/* ── What's happened since ── */}
        <SectionHead title="What's happened since" sub="Newer work that cites this paper." />
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
    </div>
  );
}

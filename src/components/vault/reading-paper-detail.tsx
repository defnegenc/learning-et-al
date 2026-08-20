"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Loader2, Maximize2, X } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { paperByline, READING_BODY } from "@/components/paper-card";
import { READING_TIP_KEY, markNuxSeen, nuxSeen } from "@/lib/nux";
import {
  pitchConsequence,
  type FamiliarityTopic,
  type FamiliarityValue,
  type PitchedForYou,
} from "@/lib/familiarity";
import {
  askThreads, digsForSection, groupThreads,
  type ReadingThread, type SectionKey, type ThreadTurn,
} from "@/lib/reading-thread";
import {
  ACID_PINK, ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM, GOLD,
  HAIRLINE, INK, LABEL_STYLE, MUTED, SELECTION_FILL, SHADOW, SURFACE, TextInput,
  foundationalWash, wash,
} from "@/components/design-system";

type Jargon = {
  term: string;
  def: string;
  tier?: "basic" | "working" | "deep";
  analogy?: string;
};

export interface Companion {
  gist: string;
  did: string;
  found: string;
  caveats: string;
  remember: string;
  glossary: Jargon[];
  questions: string[];
  topic?: FamiliarityTopic;
  pitchedForYou?: PitchedForYou;
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
  threadId?: string | null;
  selection?: string | null;
  sectionKey?: string | null;
  pitch?: PitchedForYou | null;
  createdAt?: string | number | Date | null;
}

/** Where this paper came from — the one line of "why you're reading this". */
export interface Provenance {
  theme: string | null;
  seedInterests: string[];
}

/**
 * Everything this view normally fetches, handed to it instead.
 *
 * `/prototype/reading-list` renders the real component against sample data with
 * no database, no session and no model behind it — which is the only way to
 * review this page's typography and rhythm without a signed-in account and a
 * populated library. Production never passes it; absent, every fetch runs
 * exactly as before.
 */
export interface ReadingFixture {
  companion: Companion | null;
  familiarity?: FamiliarityValue | null;
  homework: HomeworkItem[];
  qa: QaPair[];
  /** Stands in for the model when a question is asked or a passage is dug into. */
  answer: (question: string, selection?: string | null) => string;
}

/* ── The wire ────────────────────────────────────────────────────────────── */

interface AskPayload {
  question?: string;
  selection?: string | null;
  sectionKey?: SectionKey | null;
  threadId?: string | null;
}

interface StartEvent {
  id: string;
  threadId: string;
  question: string;
  selection: string | null;
  sectionKey: string | null;
}

/**
 * Consume the route's NDJSON stream.
 *
 * The answer arrives as it is written, because dig-deeper tells the reader to
 * keep reading and that it will be below — a promise that only holds if the
 * panel is filling in by the time they scroll to it.
 */
async function runAsk(
  paperId: string,
  payload: AskPayload,
  on: {
    start: (e: StartEvent) => void;
    delta: (id: string, text: string) => void;
    pitch: (id: string, pitch: PitchedForYou) => void;
  },
): Promise<void> {
  const res = await fetch(`/api/papers/${paperId}/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error("Ask failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let turnId = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: { type: string; [k: string]: unknown };
      try { event = JSON.parse(line); } catch { continue; }
      if (event.type === "start") {
        turnId = event.id as string;
        on.start(event as unknown as StartEvent);
      } else if (event.type === "delta") {
        on.delta(turnId, event.text as string);
      } else if (event.type === "pitch") {
        on.pitch(turnId, event.pitch as PitchedForYou);
      } else if (event.type === "error") {
        throw new Error((event.message as string) || "Ask failed");
      }
    }
  }
}

/** The same contract, played back from a fixture so the prototype behaves. */
async function runFixtureAsk(
  fixture: ReadingFixture,
  payload: AskPayload,
  on: {
    start: (e: StartEvent) => void;
    delta: (id: string, text: string) => void;
    pitch: (id: string, pitch: PitchedForYou) => void;
  },
): Promise<void> {
  const id = `fx-${Math.random().toString(36).slice(2)}`;
  const threadId = payload.threadId || id;
  on.start({
    id,
    threadId,
    question: payload.question || "Dig deeper on this passage.",
    selection: payload.selection ?? null,
    sectionKey: payload.sectionKey ?? null,
  });
  const words = fixture.answer(payload.question || "", payload.selection).split(" ");
  for (let i = 0; i < words.length; i++) {
    await new Promise(r => setTimeout(r, 24));
    on.delta(id, (i === 0 ? "" : " ") + words[i]);
  }
}

/* ── Prose ───────────────────────────────────────────────────────────────── */

/**
 * Interleave TermChips into a text block at the first occurrence of each term.
 *
 * `used` is passed in rather than owned, so a term defined in the gist is not
 * defined again three paragraphs later — the walkthrough is one continuous read,
 * not five independent blocks.
 *
 * **No tint.** These terms used to wear the paper's own wash hue, on the
 * argument that a filled word inside a paper's page is wayfinding rather than
 * decoration. That argument lost to a newer feature: highlighting a passage to
 * dig into it fills the selection with acid green, and a page already dotted
 * with filled words makes the reader's own selection just one more coloured
 * patch. So the dotted rule comes back here, the same one the synthesis uses,
 * and fill on this page means exactly one thing — what you are highlighting
 * right now.
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

function glossaryForLevel(terms: Jargon[], value: FamiliarityValue | null): Jargon[] {
  if (!value) return terms;
  return terms.filter(term => {
    if (!term.tier) return true; // companions cached before tiering
    if (value.level <= 2) return true;
    if (value.level === 3) return term.tier === "working" || term.tier === "deep";
    return term.tier === "deep";
  }).map(term => ({
    ...term,
    def: term.analogy && value.level <= 2 ? `${term.def} Analogy: ${term.analogy}` : term.def,
  }));
}

/* ── Highlight to dig deeper ─────────────────────────────────────────────── */

interface Pick {
  text: string;
  section: SectionKey;
  x: number;
  y: number;
}

/** A word is not a passage. Below this, the reader is probably just reading. */
const MIN_SELECTION = 16;

/**
 * Watch for a selection inside the walkthrough and report where it ended.
 *
 * Anchored to the section rather than to DOM offsets: what gets stored is the
 * quoted text and which beat it came from, so a panel survives a re-render, a
 * refresh, and a companion that was regenerated in between.
 */
function useSelectionPick(scope: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const read = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setPick(null);
      const text = sel.toString().trim();
      if (text.length < MIN_SELECTION) return setPick(null);

      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
      const host = el?.closest("[data-section]") as HTMLElement | null;
      // A selection spanning two beats resolves above both of them and gets no
      // menu — one passage, one section, or nothing.
      if (!host || !scope.current?.contains(host)) return setPick(null);

      const rects = range.getClientRects();
      const last = rects[rects.length - 1];
      if (!last) return setPick(null);

      setPick({
        text,
        section: host.dataset.section as SectionKey,
        x: last.right,
        y: last.bottom,
      });
    };

    const clear = () => setPick(null);
    document.addEventListener("mouseup", read);
    document.addEventListener("keyup", read);
    document.addEventListener("scroll", clear, true);
    return () => {
      document.removeEventListener("mouseup", read);
      document.removeEventListener("keyup", read);
      document.removeEventListener("scroll", clear, true);
    };
  }, [scope, enabled]);

  return [pick, setPick] as const;
}

/**
 * The floating pair. Hard border, the one shadow, no radius — it is the same
 * object as every other frame, just small and following the cursor.
 */
function SelectionMenu({ pick, onDig, onAsk }: {
  pick: Pick;
  onDig: () => void;
  onAsk: () => void;
}) {
  const WIDTH = 232;
  const left = Math.min(Math.max(12, pick.x - WIDTH / 2), window.innerWidth - WIDTH - 12);
  const top = Math.min(pick.y + 10, window.innerHeight - 60);

  return (
    <div
      // mousedown, not click: clicking anywhere collapses the selection, and by
      // the time click fires the passage we were about to send is gone.
      onMouseDown={e => e.preventDefault()}
      style={{
        position: "fixed", left, top, zIndex: 10040,
        display: "flex", border: BORDER, boxShadow: SHADOW, background: SURFACE,
      }}
    >
      <button onMouseDown={onDig} style={menuButton}>Dig deeper</button>
      <button onMouseDown={onAsk} style={{ ...menuButton, borderLeft: BORDER }}>Ask about this</button>
    </div>
  );
}

const menuButton: React.CSSProperties = {
  ...BODY_SM,
  fontWeight: 600,
  background: "transparent",
  border: "none",
  padding: "9px 14px",
  cursor: "pointer",
  color: INK,
  whiteSpace: "nowrap",
};

function FamiliarityScale({ topic, currentLevel, onSelect, onSkip }: {
  topic: FamiliarityTopic;
  currentLevel?: number | null;
  onSelect: (level: number) => void;
  onSkip?: () => void;
}) {
  return (
    <div style={{ borderTop: HAIRLINE, marginTop: 12, marginBottom: 12, paddingTop: 12 }}>
      <p style={{ ...BODY_SM, margin: "0 0 10px" }}>
        {onSkip ? "While I dig — how" : "How"} familiar are you with <strong>{topic.name}</strong>?
      </p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
        <span style={{ ...BODY_SM, color: DIM }}>new to it</span>
        {[1, 2, 3, 4, 5].map(level => (
          <button
            key={level}
            onClick={() => onSelect(level)}
            aria-label={`${level} out of 5 familiar with ${topic.name}`}
            aria-pressed={currentLevel === level}
            style={{
              ...BODY_SM,
              width: 28,
              height: 28,
              padding: 0,
              border: BORDER,
              background: currentLevel === level ? INK : SURFACE,
              color: currentLevel === level ? SURFACE : INK,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {level}
          </button>
        ))}
        <span style={{ ...BODY_SM, color: DIM }}>I work on this</span>
        {onSkip && (
          <button
            onClick={onSkip}
            style={{ ...BODY_SM, marginLeft: "auto", background: "none", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", color: DIM }}
          >
            Skip
          </button>
        )}
      </div>
      <p style={{ ...BODY_SM, color: MUTED, margin: "9px 0 0" }}>
        This helps pitch future reading companions. It never changes what gets selected.
      </p>
    </div>
  );
}

function PitchedForYouLine({ pitch, topic, currentLevel, onSelect }: {
  pitch: PitchedForYou;
  topic: FamiliarityTopic;
  currentLevel: number;
  onSelect: (level: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: "0 0 18px" }}>
      <button
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
      >
        <span style={{ ...LABEL_STYLE, display: "block", marginBottom: 5 }}>Pitched for you</span>
        <span style={{ ...BODY_SM, color: DIM }}>
          You rated yourself {pitch.level}/5 on {pitch.topicName}, so {pitch.consequence.replace(/^I(?:'m| am)\s+/i, "I'm ")}
          <span style={{ textDecoration: "underline", textUnderlineOffset: 3 }}> Not right anymore? Adjust.</span>
        </span>
      </button>
      {open && (
        <FamiliarityScale
          topic={topic}
          currentLevel={currentLevel}
          onSelect={level => { onSelect(level); setOpen(false); }}
        />
      )}
    </div>
  );
}

/**
 * A dig, answered — the wash panel that lands directly under the beat the
 * passage came from.
 *
 * The panel is the paper's own wash, never green: green lives in the live
 * selection and in the confirmation tick, and nowhere else. The quoted passage
 * wears the same ink underline a paper name wears in the synthesis.
 */
function DigPanel({ thread, washStyle, streaming, onFollowUp, error, familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity }: {
  thread: ReadingThread;
  washStyle: React.CSSProperties;
  streaming: boolean;
  error?: string | null;
  onFollowUp: (question: string) => void;
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div style={{ ...washStyle, border: BORDER, boxShadow: SHADOW, padding: "18px 20px", marginTop: 22 }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>Deeper</div>

      {familiarityOffer && (
        <FamiliarityScale
          topic={familiarityOffer}
          currentLevel={familiarityValue?.level}
          onSelect={onFamiliarity}
          onSkip={onSkipFamiliarity}
        />
      )}

      {thread.selection && (
        <p
          style={{
            ...BODY_STYLE,
            fontStyle: "italic",
            margin: "0 0 14px",
            textDecoration: "underline",
            textDecorationColor: INK,
            textUnderlineOffset: 4,
          }}
        >
          {thread.selection}
        </p>
      )}

      {thread.turns.map((turn, i) => (
        <div key={turn.id} style={{ borderTop: i === 0 ? "none" : HAIRLINE, paddingTop: i === 0 ? 0 : 14, marginTop: i === 0 ? 0 : 14 }}>
          {/* The opener's question is the canned dig intent — the passage above
              already says what was asked. Follow-ups the reader typed do show. */}
          {i > 0 && <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 8px" }}>{turn.question}</p>}
          {turn.pitch && familiarityValue && (
            <PitchedForYouLine
              pitch={turn.pitch}
              topic={{ id: familiarityValue.topicId, name: familiarityValue.topicName, source: "openalex" }}
              currentLevel={familiarityValue.level}
              onSelect={onFamiliarity}
            />
          )}
          <p style={{ ...READING_BODY, margin: 0 }}>
            {turn.answer}
            {streaming && i === thread.turns.length - 1 && !turn.answer && (
              <span style={{ color: MUTED, fontStyle: "italic" }}>Digging&hellip;</span>
            )}
          </p>
        </div>
      ))}

      {error && (
        <p style={{ ...BODY_SM, color: ACID_PINK, margin: "12px 0 0" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <TextInput
          value={draft}
          onChange={setDraft}
          onKeyDown={e => { if (e.key === "Enter" && draft.trim()) { onFollowUp(draft.trim()); setDraft(""); } }}
          placeholder="Follow up on this…"
          ariaLabel="Follow up on this passage"
        />
        <ActionButton
          onClick={() => { if (draft.trim()) { onFollowUp(draft.trim()); setDraft(""); } }}
          shadow={false}
          disabled={!draft.trim() || streaming}
          style={{ flexShrink: 0 }}
        >
          Ask
        </ActionButton>
      </div>
    </div>
  );
}

/** One beat of the walkthrough: a Display/SM heading over a paragraph. */
function Beat({ heading, sectionKey, children }: {
  heading: string;
  sectionKey: SectionKey;
  children: React.ReactNode;
}) {
  return (
    <section style={{ borderTop: HAIRLINE, paddingTop: 22, marginTop: 22 }}>
      <h2 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{heading}</h2>
      <p data-section={sectionKey} style={{ ...READING_BODY, margin: 0 }}>{children}</p>
    </section>
  );
}

/**
 * The mobile half of highlight-to-dig.
 *
 * Touch selection fights the native selection callout, and losing that fight
 * means the reader gets the OS copy menu instead of ours. So on narrow screens
 * the beat carries its own affordance and digs on the whole passage.
 */
function DigThisBeat({ onDig }: { onDig: () => void }) {
  return (
    <button
      className="reading-beat-dig"
      onClick={onDig}
      style={{
        ...BODY_SM, fontWeight: 600, background: "transparent", border: "none",
        padding: "10px 0 0", cursor: "pointer", color: DIM,
      }}
    >
      ¶ Dig deeper on this
    </button>
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
        title={saved ? "In your library" : "Save to your library"}
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
        style={{ ...DISPLAY_SM, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        <span style={{ flex: 1 }}>Glossary ({terms.length})</span>
        {/* The chevron the interests accordion uses. A bare +/- was carrying the
            whole "this opens" signal, and it read as punctuation. */}
        <ChevronDown
          size={16}
          style={{ color: MUTED, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
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
 * citing work, so the page has one way of offering you a next thing.
 *
 * Threaded now: a question and its follow-ups go to the model together, so
 * "and the second one?" resolves against what was just said instead of being
 * answered blind, which is how every question here used to be answered.
 */
function AskThread({ threads, starters, headerWash, quote, onClearQuote, onAsk, onFollowUp, streaming, failed, familiarityValue, onFamiliarity }: {
  threads: ReadingThread[];
  starters: string[];
  headerWash: React.CSSProperties;
  /** "Ask about this" dropped a passage in here — shown above the composer. */
  quote: string | null;
  onClearQuote: () => void;
  onAsk: (question: string, quote: string | null) => void;
  onFollowUp: (threadId: string, question: string) => void;
  streaming: boolean;
  failed: string | null;
  familiarityValue: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  // "Ask about this" is a request to type — put the cursor where the typing goes.
  useEffect(() => {
    if (!quote) return;
    inputRef.current?.querySelector("input")?.focus();
  }, [quote]);

  const asked = new Set(threads.flatMap(t => t.turns.map(turn => turn.question)));
  const remaining = starters.filter(q => !asked.has(q));
  const empty = threads.length === 0 && !streaming;

  const submit = () => {
    const q = draft.trim();
    if (!q || streaming) return;
    onAsk(q, quote);
    setDraft("");
  };

  return (
    <div
      style={{
        border: BORDER, boxShadow: SHADOW, background: SURFACE,
        display: "flex", flexDirection: "column",
        ...(fullScreen ? {
          position: "fixed",
          inset: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
          zIndex: 10020,
          maxHeight: "none",
        } : {}),
      }}
      className="reading-ask"
      id="ask-this-paper"
    >
      <div style={{ ...headerWash, padding: "16px 18px 14px", borderBottom: BORDER, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <div>
            <h2 style={{ ...DISPLAY_SM, margin: 0 }}>Ask this paper</h2>
            <p style={{ ...BODY_SM, color: MUTED, margin: "6px 0 0" }}>
              Answered from the paper itself, not from the digest.
            </p>
          </div>
          <button
            onClick={() => setFullScreen(v => !v)}
            title={fullScreen ? "Close fullscreen" : "Open fullscreen"}
            aria-label={fullScreen ? "Close fullscreen" : "Open fullscreen"}
            style={{ background: "none", border: "none", padding: 2, color: INK, cursor: "pointer", display: "flex", lineHeight: 1, flexShrink: 0 }}
          >
            {fullScreen ? <X size={17} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: "0 18px", flex: 1, minHeight: 0 }}>
        {threads.map((thread, ti) => (
          <div key={thread.id} style={{ padding: "16px 0", borderTop: ti === 0 ? "none" : HAIRLINE }}>
            {thread.selection && (
              <p style={{ ...BODY_SM, color: DIM, fontStyle: "italic", margin: "0 0 8px" }}>
                &ldquo;{thread.selection}&rdquo;
              </p>
            )}
            {thread.turns.map((turn, i) => (
              <div key={turn.id} style={{ marginTop: i === 0 ? 0 : 14 }}>
                <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 8px" }}>{turn.question}</p>
                {turn.pitch && familiarityValue && (
                  <PitchedForYouLine
                    pitch={turn.pitch}
                    topic={{ id: familiarityValue.topicId, name: familiarityValue.topicName, source: "openalex" }}
                    currentLevel={familiarityValue.level}
                    onSelect={onFamiliarity}
                  />
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <span aria-hidden style={{ width: 2, flexShrink: 0, background: INK }} />
                  <p style={{ ...BODY_STYLE, margin: 0 }}>
                    {turn.answer || (
                      <span style={{ color: MUTED }}>Looking it up&hellip;</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <FollowUpRow disabled={streaming} onSubmit={q => onFollowUp(thread.id, q)} />
          </div>
        ))}

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
                onClick={() => onAsk(q, null)}
                disabled={streaming}
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
                  cursor: streaming ? "default" : "pointer",
                  opacity: streaming ? 0.4 : 1,
                }}
              >
                <span aria-hidden style={{ color: MUTED, flexShrink: 0 }}>→</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px", borderTop: BORDER, flexShrink: 0 }} ref={inputRef}>
        {quote && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
            <p style={{ ...BODY_SM, color: DIM, fontStyle: "italic", margin: 0, flex: 1 }}>
              &ldquo;{quote}&rdquo;
            </p>
            <button
              onClick={onClearQuote}
              aria-label="Drop the quoted passage"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 16, lineHeight: 1, color: MUTED }}
            >×</button>
          </div>
        )}
        <TextInput
          value={draft}
          onChange={setDraft}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder={quote ? "What do you want to know about it?" : "Ask your own question…"}
          ariaLabel="Ask a question about this paper"
        />
        <ActionButton
          onClick={submit}
          variant="primary"
          shadow={false}
          disabled={!draft.trim() || streaming}
          style={{ width: "100%", marginTop: 8 }}
        >
          Ask
        </ActionButton>
        {failed && (
          <p style={{ ...BODY_SM, color: ACID_PINK, margin: "10px 0 0" }}>{failed}</p>
        )}
      </div>
    </div>
  );
}

/** The quiet "keep going" line under a thread in the rail. */
function FollowUpRow({ disabled, onSubmit }: { disabled: boolean; onSubmit: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...BODY_SM, fontWeight: 600, background: "none", border: "none", padding: "12px 0 0", cursor: "pointer", color: DIM }}
      >
        + Follow up
      </button>
    );
  }

  const submit = () => {
    const q = draft.trim();
    if (!q) return;
    onSubmit(q);
    setDraft("");
    setOpen(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <TextInput
        value={draft}
        onChange={setDraft}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder="Follow up…"
        ariaLabel="Follow up"
        autoFocus
      />
      <ActionButton onClick={submit} shadow={false} disabled={!draft.trim() || disabled} style={{ width: "100%", marginTop: 8 }}>
        Ask
      </ActionButton>
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

/**
 * The reading view: the companion walkthrough, the digs it produced, then the
 * thread, then what's happened since.
 *
 * The point of this page is that you get the paper without reading the paper.
 * The companion is generated in five parts at save time — the gist, the method,
 * the results, the caveats and the one line to remember — and all five are here
 * as one continuous read with hard words defined in place.
 *
 * It is a page now, not a portal overlay. It was always full-bleed, so the
 * overlay bought nothing except a view with no URL: nothing could link to it,
 * refresh lost it and back didn't close it. `/library/[paperId]` is the
 * canonical address; the vault navigates there rather than covering itself.
 */
export function ReadingPaperDetail({ paper, index = 0, provenance, onBack, fixture }: {
  paper: PaperItem;
  /**
   * The paper's position on the shelf — its wash index, so this page wears the
   * same hue as the card it was opened from: the dig panels and the "Remember
   * this" frame. Hard words no longer take it (see `annotateText`) — on this
   * page a filled word competes with the selection, which is the one thing here
   * that has to be unmistakable.
   */
  index?: number;
  provenance?: Provenance | null;
  onBack?: () => void;
  /** Prototype only — see `ReadingFixture`. */
  fixture?: ReadingFixture;
}) {
  const byline = paperByline(paper);
  const foundational = paper.category === "foundational";
  const washStyle = foundational ? foundationalWash() : wash(index);

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [familiarityValue, setFamiliarityValue] = useState<FamiliarityValue | null>(null);
  const [familiarityOffer, setFamiliarityOffer] = useState<FamiliarityTopic | null>(null);
  const [lastDigThreadId, setLastDigThreadId] = useState<string | null>(null);
  const [companionPending, setCompanionPending] = useState(true);
  const [companionFailed, setCompanionFailed] = useState(false);
  const [homework, setHomework] = useState<HomeworkItem[] | null>(null);

  const [threads, setThreads] = useState<ReadingThread[]>([]);
  const [streamingTurn, setStreamingTurn] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [tipSeen, setTipSeen] = useState(true);

  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useSelectionPick(proseRef, !companionPending);

  useEffect(() => { setTipSeen(nuxSeen(READING_TIP_KEY)); }, []);

  const loadCompanion = useCallback(async () => {
    setCompanionPending(true);
    setCompanionFailed(false);
    try {
      const res = await fetch(`/api/papers/${paper.id}/companion`);
      let data = await res.json();
      if (!data.companion) {
        const gen = await fetch(`/api/papers/${paper.id}/companion`, { method: "POST" });
        data = await gen.json();
      }
      setCompanion(data.companion ?? null);
      setFamiliarityValue(data.familiarity ?? null);
      // A null companion after an explicit generate is a failure, not an empty
      // state — the sections used to just silently not exist.
      setCompanionFailed(!data.companion);
    } catch {
      setCompanionFailed(true);
    } finally {
      setCompanionPending(false);
    }
  }, [paper.id]);

  useEffect(() => {
    if (fixture) {
      setCompanion(fixture.companion);
      setFamiliarityValue(fixture.familiarity ?? null);
      setCompanionPending(false);
      setHomework(fixture.homework);
      setThreads(groupThreads(fixture.qa.map(normalizeTurn)));
      return;
    }
    let cancelled = false;
    loadCompanion();
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
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/qa`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.qaPairs)) {
          setThreads(groupThreads(data.qaPairs.map(normalizeTurn)));
        }
      } catch { /* an empty thread is the right fallback */ }
    })();
    return () => { cancelled = true; };
  }, [paper.id, fixture, loadCompanion]);

  /* ── Asking ── */

  const ask = useCallback(async (payload: AskPayload) => {
    if (streamingTurn) return;
    setAskError(null);
    const handlers = {
      start: (e: StartEvent) => {
        setStreamingTurn(e.id);
        if (e.selection) setLastDigThreadId(e.threadId);
        const turn: ThreadTurn = {
          id: e.id, question: e.question, answer: "",
          threadId: e.threadId, selection: e.selection, sectionKey: e.sectionKey,
        };
        setThreads(prev => prev.some(t => t.id === e.threadId)
          ? prev.map(t => t.id === e.threadId ? { ...t, turns: [...t.turns, turn] } : t)
          : [...prev, {
              id: e.threadId,
              selection: e.selection,
              sectionKey: (e.sectionKey as SectionKey | null) ?? null,
              turns: [turn],
            }]);
      },
      delta: (id: string, text: string) => {
        setThreads(prev => prev.map(t => ({
          ...t,
          turns: t.turns.map(turn => turn.id === id ? { ...turn, answer: turn.answer + text } : turn),
        })));
      },
      pitch: (id: string, pitch: PitchedForYou) => {
        setThreads(prev => prev.map(thread => ({
          ...thread,
          turns: thread.turns.map(turn => turn.id === id ? { ...turn, pitch } : turn),
        })));
      },
    };
    try {
      if (fixture) await runFixtureAsk(fixture, payload, handlers);
      else await runAsk(paper.id, payload, handlers);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "That one didn't come back. Try again.");
    } finally {
      setStreamingTurn(null);
    }
  }, [paper.id, fixture, streamingTurn]);

  const setFamiliarity = useCallback((level: number) => {
    const topic = companion?.topic ?? familiarityOffer;
    if (!topic) return;
    const previous = familiarityValue;
    const optimistic: FamiliarityValue = {
      topicId: topic.id,
      topicName: topic.name,
      level,
      source: previous ? "correction" : "interleave",
      createdAt: new Date().toISOString(),
    };
    setFamiliarityValue(optimistic);
    setFamiliarityOffer(null);
    if (fixture) return;
    void fetch("/api/familiarity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, action: "set", level }),
    }).then(async response => {
      if (!response.ok) throw new Error("Familiarity update failed");
      const data = await response.json();
      if (data.familiarity) setFamiliarityValue(data.familiarity);
    }).catch(() => setFamiliarityValue(previous));
  }, [companion?.topic, familiarityOffer, familiarityValue, fixture, paper.id]);

  const skipFamiliarity = useCallback(() => {
    setFamiliarityOffer(null);
    if (fixture) return;
    void fetch("/api/familiarity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, action: "skip" }),
    });
  }, [fixture, paper.id]);

  const reserveFamiliarityOffer = useCallback(() => {
    if (familiarityValue || familiarityOffer || !companion?.topic) return;
    if (fixture) {
      setFamiliarityOffer(companion.topic);
      return;
    }
    void fetch("/api/familiarity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, action: "offer" }),
    }).then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.offered && data.topic) setFamiliarityOffer(data.topic); })
      .catch(() => {});
  }, [companion?.topic, familiarityOffer, familiarityValue, fixture, paper.id]);

  const dig = useCallback((text: string, section: SectionKey) => {
    window.getSelection()?.removeAllRanges();
    setPick(null);
    if (!tipSeen) { markNuxSeen(READING_TIP_KEY); setTipSeen(true); }
    reserveFamiliarityOffer();
    ask({ selection: text, sectionKey: section });
  }, [ask, reserveFamiliarityOffer, setPick, tipSeen]);

  /* ── Prose ── */

  // One shared "already defined" set for the whole walkthrough, rebuilt on each
  // render so the chips land in the same places every time.
  const activeFamiliarity = familiarityValue && companion?.topic?.id === familiarityValue.topicId
    ? familiarityValue
    : null;
  const glossary = glossaryForLevel(companion?.glossary ?? [], activeFamiliarity);
  const hasTieredGlossary = !!companion?.glossary.some(term => term.tier);
  const companionDisclosure: PitchedForYou | null = activeFamiliarity && (hasTieredGlossary || companion?.pitchedForYou)
    ? {
        topicId: activeFamiliarity.topicId,
        topicName: activeFamiliarity.topicName,
        level: activeFamiliarity.level,
        consequence: companion?.pitchedForYou?.level === activeFamiliarity.level
          ? companion.pitchedForYou.consequence
          : pitchConsequence(activeFamiliarity.level),
      }
    : null;
  const defined = new Set<string>();
  const mark = (text: string) => annotateText(text, glossary, defined);

  const sectionText: Record<SectionKey, string> = {
    gist: companion?.gist ?? "",
    did: companion?.did ?? "",
    found: companion?.found ?? "",
    caveats: companion?.caveats ?? "",
    remember: companion?.remember ?? "",
  };

  const digs = (key: SectionKey) => digsForSection(threads, key).map(thread => (
    <DigPanel
      key={thread.id}
      thread={thread}
      washStyle={washStyle}
      streaming={thread.turns.some(t => t.id === streamingTurn)}
      error={thread.turns.some(t => t.id === streamingTurn) ? null : askError}
      onFollowUp={q => ask({ question: q, threadId: thread.id })}
      familiarityOffer={thread.id === lastDigThreadId ? familiarityOffer : null}
      familiarityValue={activeFamiliarity}
      onFamiliarity={setFamiliarity}
      onSkipFamiliarity={skipFamiliarity}
    />
  ));

  const beatDig = (key: SectionKey) => (
    sectionText[key] ? <DigThisBeat onDig={() => dig(sectionText[key], key)} /> : null
  );

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto" }} className="px-5 md:px-8 pt-6 pb-24">
      {/* The top bar: out of the page on the left, into the paper on the right. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 28 }}>
        {onBack ? (
          <button
            onClick={onBack}
            style={{ ...BODY_STYLE, display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0 }}
          >
            <ArrowLeft size={15} /> Back
          </button>
        ) : <span />}
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
        <div style={{ minWidth: 0 }} ref={proseRef}>
          <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>{paper.title}</h1>
          {byline && (
            <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "0 0 8px" }}>{byline}</p>
          )}

          {/* Why you're reading this — the digest question that surfaced it and
              the interests that seeded that question. */}
          <WhyLine provenance={provenance} paper={paper} />

          {companionDisclosure && companion?.topic && (
            <PitchedForYouLine
              pitch={companionDisclosure}
              topic={companion.topic}
              currentLevel={activeFamiliarity!.level}
              onSelect={setFamiliarity}
            />
          )}

          {/* Taught once. Retires on the first successful dig. */}
          {!tipSeen && !companionPending && companion && (
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", margin: "0 0 26px" }}>
              <span style={LABEL_STYLE}>Tip</span>
              <span style={{ ...BODY_SM, color: DIM }}>
                Highlight any passage to have the agent dig deeper on it.
              </span>
            </div>
          )}

          {/* ── The gist ── */}
          {companionPending ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
              <span style={{ ...BODY_STYLE, color: MUTED }}>Reading the paper…</span>
            </div>
          ) : companion?.gist ? (
            <>
              <p data-section="gist" style={{ ...READING_BODY, margin: 0 }}>{mark(companion.gist)}</p>
              {beatDig("gist")}
              {digs("gist")}
            </>
          ) : companionFailed ? (
            <div style={{ border: BORDER, padding: "14px 16px" }}>
              <p style={{ ...BODY_STYLE, margin: 0 }}>
                The walkthrough didn&rsquo;t come back this time.
              </p>
              <ActionButton onClick={loadCompanion} shadow={false} style={{ marginTop: 12 }}>
                Try again
              </ActionButton>
            </div>
          ) : paper.abstract ? (
            <p style={{ ...READING_BODY, margin: 0 }}>{paper.abstract}</p>
          ) : (
            <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic", margin: 0 }}>No summary available.</p>
          )}

          {/* ── The walkthrough — the beats after the gist ── */}
          {companion?.did && (
            <>
              <Beat heading="What they did" sectionKey="did">{mark(companion.did)}</Beat>
              {beatDig("did")}
              {digs("did")}
            </>
          )}
          {companion?.found && (
            <>
              <Beat heading="What they found" sectionKey="found">{mark(companion.found)}</Beat>
              {beatDig("found")}
              {digs("found")}
            </>
          )}
          {companion?.caveats && (
            <>
              <Beat heading="Where it's shaky" sectionKey="caveats">{mark(companion.caveats)}</Beat>
              {beatDig("caveats")}
              {digs("caveats")}
            </>
          )}

          {/* The one line worth keeping, in the card's own frame and wash — so
              the page closes on the object it opened from. */}
          {companion?.remember && (
            <>
              <div
                style={{
                  ...washStyle,
                  border: `2px solid ${foundational ? GOLD : INK}`,
                  boxShadow: `5px 5px 0 0 ${foundational ? GOLD : INK}`,
                  padding: "22px 24px",
                  marginTop: 32,
                }}
              >
                <h2 style={{ ...DISPLAY_SM, color: DIM, margin: "0 0 12px" }}>Remember this</h2>
                <p data-section="remember" style={{ ...READING_BODY, fontWeight: 600, margin: 0 }}>
                  {companion.remember}
                </p>
              </div>
              {digs("remember")}
            </>
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
          {companionPending ? (
            // The rail used to render nothing at all until the companion landed,
            // which is a minute or two of dead air in the widest column on the
            // page. Say what is happening instead.
            <div style={{ border: BORDER, boxShadow: SHADOW, background: SURFACE }}>
              <div style={{ ...washStyle, padding: "16px 18px 14px", borderBottom: BORDER }}>
                <h2 style={{ ...DISPLAY_SM, margin: 0 }}>Ask this paper</h2>
              </div>
              <p style={{ ...BODY_STYLE, color: MUTED, margin: 0, padding: "16px 18px" }}>
                Your librarian is still reading — ask anything once it&rsquo;s done.
              </p>
            </div>
          ) : (
            <AskThread
              threads={askThreads(threads)}
              starters={companion?.questions ?? []}
              headerWash={washStyle}
              quote={quote}
              onClearQuote={() => setQuote(null)}
              onAsk={(q, quoted) => { setQuote(null); ask({ question: q, selection: quoted }); }}
              onFollowUp={(threadId, q) => ask({ question: q, threadId })}
              streaming={!!streamingTurn}
              failed={askError}
              familiarityValue={activeFamiliarity}
              onFamiliarity={setFamiliarity}
            />
          )}
        </aside>
      </div>

      {pick && (
        <SelectionMenu
          pick={pick}
          onDig={() => dig(pick.text, pick.section)}
          onAsk={() => {
            setQuote(pick.text);
            setPick(null);
            window.getSelection()?.removeAllRanges();
            document.getElementById("ask-this-paper")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        />
      )}

      <style>{`
        .reading-shell { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 56px; align-items: start; }
        /* The rail holds position while the walkthrough scrolls past it, and
           the thread scrolls inside its own frame so the composer never
           leaves the viewport. */
        .reading-aside { position: sticky; top: 8px; }
        .reading-ask { max-height: calc(100vh - 100px); }
        /* The one sanctioned fill use of acid green — see SELECTION_FILL. It is
           scoped to the walkthrough, because that is the only text a dig can
           act on. */
        .reading-shell [data-section]::selection { background: ${SELECTION_FILL}; }
        /* Desktop selects; touch taps the beat's own affordance, because touch
           selection loses to the native callout. */
        .reading-beat-dig { display: none; }
        @media (max-width: 1060px) {
          .reading-shell { grid-template-columns: 1fr; gap: 0; }
          .reading-aside { position: static; margin-top: 56px; }
          .reading-ask { max-height: none; }
        }
        @media (max-width: 720px) {
          .reading-beat-dig { display: block; }
        }
      `}</style>
    </div>
  );
}

/** Server rows and fixtures arrive slightly differently shaped. */
function normalizeTurn(pair: QaPair): ThreadTurn {
  return {
    id: pair.id,
    question: pair.question,
    answer: pair.answer,
    threadId: pair.threadId ?? null,
    selection: pair.selection ?? null,
    sectionKey: pair.sectionKey ?? null,
    pitch: pair.pitch ?? null,
    createdAt: pair.createdAt ?? null,
  };
}

/**
 * One line of why this paper is in front of you: the question that surfaced it
 * and the interests that seeded that question.
 *
 * It costs nothing — the digest already stores its theme and its seed
 * interests — and it is the seed of the librarian's voice: a shelf of titles
 * with no memory of why they were pulled is just a folder.
 */
function WhyLine({ provenance, paper }: { provenance?: Provenance | null; paper: PaperItem }) {
  const theme = provenance?.theme ?? paper.digestTheme ?? null;
  const seeds = provenance?.seedInterests ?? [];
  if (!theme && seeds.length === 0) return <div style={{ height: 24 }} />;

  return (
    <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 26px" }}>
      {theme && <>Pulled in for &ldquo;{theme}&rdquo;</>}
      {theme && seeds.length > 0 && " — "}
      {seeds.length > 0 && <>because you follow {seeds.join(", ")}.</>}
    </p>
  );
}

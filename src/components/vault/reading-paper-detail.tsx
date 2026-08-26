"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Loader2, X } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { paperByline, READING_BODY } from "@/components/paper-card";
import { READING_TIP_KEY, markNuxSeen, nuxSeen } from "@/lib/nux";
import {
  type FamiliarityTopic,
  type FamiliarityValue,
  type PitchedForYou,
} from "@/lib/familiarity";
import {
  DEFAULT_QUESTION, digsForSection, groupThreads,
  type ReadingThread, type SectionKey, type ThreadTurn,
} from "@/lib/reading-thread";
import {
  ACID_PINK, ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM, GOLD,
  HAIRLINE, INK, LABEL_STYLE, MUTED, PageLoader, SHADOW, SURFACE, TextInput,
  foundationalSlots, foundationalWash, wash, washSlots,
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
    question: payload.question || DEFAULT_QUESTION,
    selection: payload.selection ?? null,
    sectionKey: payload.sectionKey ?? null,
  });
  const words = fixture.answer(payload.question || "", payload.selection).split(" ");
  // A real model takes a couple of seconds to say its first word, and that gap
  // is now a designed surface — the loader, then the one question the interleave
  // owes, then a tip. Streaming the fixture's first token in 24ms would flash
  // past the whole thing, and the prototype exists precisely so these states are
  // reviewable without an account.
  await new Promise(r => setTimeout(r, FIXTURE_FIRST_TOKEN_MS));
  for (let i = 0; i < words.length; i++) {
    await new Promise(r => setTimeout(r, 24));
    on.delta(id, (i === 0 ? "" : " ") + words[i]);
  }
}

/**
 * Long enough to see the loader and the question under it; short enough to be
 * an honest impression of the wait. Each successive dig shows the next rung of
 * the ladder — answer the familiarity question and the next dig asks how much
 * you liked the paper, then the one after that shows tips.
 */
const FIXTURE_FIRST_TOKEN_MS = 2600;

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
/**
 * Mark the passages that have been dug into, in place, in the paper's own hue,
 * and annotate everything around them.
 *
 * A dig used to reprint its passage at the top of a panel. That said the same
 * thing twice and broke the read: the sentence you highlighted was still up
 * there in the paragraph, and a copy of it sat below in a box. Now the original
 * is what carries the mark, so a beat shows you at a glance which of its
 * sentences you have already pulled on, and the panel underneath is nothing but
 * the answer.
 *
 * Matching is by first exact occurrence, non-overlapping. A selection that no
 * longer appears (a regenerated companion) simply doesn't mark — the thread is
 * still anchored to its section, so nothing is lost but the highlight.
 *
 * Each mark carries its own fill, because two different things are marked here.
 * A passage already dug into wears the paper's hue. The passage being selected
 * *right now* wears acid green, and it is drawn rather than left to the browser:
 * clicking into the floating bar collapses the DOM selection, which used to take
 * the green with it and leave the reader typing a question about a sentence they
 * could no longer see.
 */
interface BeatMark {
  text: string;
  fill: string;
  /** The card this passage belongs to, and the number it wears in the prose. */
  id?: string;
  n?: number;
  /** Underlined while its card is being pointed at. */
  active?: boolean;
  onClick?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
}

function annotateBeat(
  text: string,
  jargon: Jargon[],
  used: Set<string>,
  marks: BeatMark[],
): React.ReactNode[] {
  const ranges: { start: number; end: number; mark: BeatMark }[] = [];
  for (const mark of marks) {
    const sel = mark.text.trim();
    if (!sel) continue;
    const i = text.indexOf(sel);
    if (i < 0) continue;
    const end = i + sel.length;
    if (ranges.some(r => i < r.end && end > r.start)) continue;
    ranges.push({ start: i, end, mark });
  }
  if (!ranges.length) return annotateText(text, jargon, used);
  ranges.sort((a, b) => a.start - b.start);

  const out: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      out.push(<React.Fragment key={key++}>{annotateText(text.slice(cursor, r.start), jargon, used)}</React.Fragment>);
    }
    out.push(
      <mark
        key={key++}
        data-mark-id={r.mark.id}
        onClick={r.mark.onClick}
        onMouseEnter={r.mark.onEnter}
        onMouseLeave={r.mark.onLeave}
        style={{
          background: r.mark.fill,
          color: INK,
          // `clone` so a passage spanning a line break carries the mark on both
          // lines rather than stretching one box behind the break.
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          cursor: r.mark.onClick ? "pointer" : undefined,
          boxShadow: r.mark.active ? `0 2px 0 0 ${INK}` : undefined,
        }}
      >
        {annotateText(text.slice(r.start, r.end), jargon, used)}
      </mark>,
    );
    if (r.mark.n !== undefined) {
      out.push(
        // `user-select: none` on purpose: a numeral is furniture, and without
        // this it lands inside the next selection that crosses it, where it is
        // a character the beat's own text does not contain and the passage
        // stops matching.
        <sup
          key={key++}
          onClick={r.mark.onClick}
          style={{
            ...BODY_SM, fontWeight: 600, fontSize: 11, padding: "0 2px",
            userSelect: "none", WebkitUserSelect: "none",
            cursor: r.mark.onClick ? "pointer" : undefined,
          }}
        >
          {r.mark.n}
        </sup>,
      );
    }
    cursor = r.end;
  }
  if (cursor < text.length) {
    out.push(<React.Fragment key={key++}>{annotateText(text.slice(cursor), jargon, used)}</React.Fragment>);
  }
  return out;
}

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
}

/**
 * Below this the reader is not choosing anything, they are clicking.
 *
 * It was 16, on the argument that a word is not a passage. Then a word became
 * something you could do something with: double-click "criterion" and the bar
 * offers to define it and keep it. Three characters is short enough for any
 * term and long enough to ignore a stray click-drag.
 */
const MIN_SELECTION = 3;

/** How long a dig has to be running before the interleave is allowed to ask anything. */
const OFFER_AFTER_MS = 1200;

/**
 * Which beat a selection belongs to, forgivingly.
 *
 * The obvious answer, `commonAncestorContainer.closest("[data-section]")`, is
 * why a multi-line drag used to do nothing at all. Drag across three lines and
 * release a few pixels past the end of the last one and the selection has taken
 * the gap under the paragraph with it, so the common ancestor is the section or
 * the column, and `closest` looks *upwards* from there and never finds the beat
 * sitting below it. The highlight looked perfect and produced no menu. It also
 * killed any drag that ran from one beat into the next.
 *
 * So: the beat the drag started in, or failing that the first beat the range
 * actually touches.
 */
function beatFor(range: Range, scope: HTMLElement): HTMLElement | null {
  const from = (node: Node) => {
    const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as Element | null;
    return el?.closest("[data-section]") as HTMLElement | null;
  };
  const direct = from(range.startContainer) ?? from(range.endContainer);
  if (direct && scope.contains(direct)) return direct;
  const beats = Array.from(scope.querySelectorAll("[data-section]")) as HTMLElement[];
  return beats.find(beat => range.intersectsNode(beat)) ?? null;
}

/**
 * The part of the selection actually inside that beat.
 *
 * `annotateBeat` finds a passage by `indexOf` in the beat's own text, so a
 * selection carrying the gap below the paragraph, or the first half of the next
 * beat, would never be found in the string it is supposed to be part of and the
 * mark would silently not draw. One passage, one beat.
 */
function clipToBeat(range: Range, beat: HTMLElement): Range | null {
  const whole = document.createRange();
  whole.selectNodeContents(beat);
  const out = document.createRange();
  if (range.compareBoundaryPoints(Range.START_TO_START, whole) >= 0) {
    out.setStart(range.startContainer, range.startOffset);
  } else {
    out.setStart(whole.startContainer, whole.startOffset);
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, whole) <= 0) {
    out.setEnd(range.endContainer, range.endOffset);
  } else {
    out.setEnd(whole.endContainer, whole.endOffset);
  }
  return out.collapsed ? null : out;
}

/**
 * Watch for a selection inside the walkthrough and hand it to the caller.
 *
 * Anchored to the section rather than to DOM offsets: what is captured is the
 * quoted text and which beat it came from, so it survives a re-render, a
 * refresh, and a companion that was regenerated in between.
 *
 * Two highlights, in sequence, and the handoff between them is the interaction.
 * While the mouse is down the browser draws its own selection, the ink one this
 * product uses everywhere. The instant it is released the passage is captured
 * and the DOM selection is collapsed on purpose, so the page can redraw the same
 * words in the paper's own hue (see `annotateBeat`). Drag black, release colour.
 *
 * It reports rather than remembers. The passage now lives in the conversation
 * the moment it is taken, and the previous version's `pick` state was cleared by
 * a document-wide scroll listener, which is why highlighting a second time so
 * often appeared to do nothing at all: anything that scrolled the page, the rail
 * included, threw the passage away between the release and the question.
 *
 * `nativeLive` is what keeps the two highlights from stacking: while the browser
 * is still drawing (a keyboard selection, which is never collapsed out from
 * under the reader), the page draws nothing.
 */
function useSelectionPick(
  scope: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onCapture: (pick: Pick) => void,
) {
  const [nativeLive, setNativeLive] = useState(false);
  const capture = useRef(onCapture);
  useEffect(() => { capture.current = onCapture; });

  useEffect(() => {
    if (!enabled) return;
    const track = () => {
      const sel = window.getSelection();
      setNativeLive(!!sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length >= MIN_SELECTION);
    };
    document.addEventListener("selectionchange", track);
    return () => document.removeEventListener("selectionchange", track);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const read = (event: Event) => {
      const released = event.type === "mouseup";
      // A drag that started inside the conversation is the reader selecting an
      // answer to copy, not choosing a passage.
      const target = event.target as Element | null;
      if (target?.closest?.("[data-talk]")) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      if (sel.toString().trim().length < MIN_SELECTION) return;

      const range = sel.getRangeAt(0);
      const scopeEl = scope.current;
      if (!scopeEl) return;
      const host = beatFor(range, scopeEl);
      if (!host) return;

      const clipped = clipToBeat(range, host);
      if (!clipped) return;
      const text = clipped.toString().trim();
      if (text.length < MIN_SELECTION) return;

      capture.current({ text, section: host.dataset.section as SectionKey });

      // Hand the highlight over: the browser's ink selection was the drag, the
      // paper's hue is the held passage. Only on release of the mouse; a
      // keyboard selection is still being made and must not be collapsed
      // mid-stroke.
      if (released) sel.removeAllRanges();
    };

    document.addEventListener("mouseup", read);
    document.addEventListener("keyup", read);
    return () => {
      document.removeEventListener("mouseup", read);
      document.removeEventListener("keyup", read);
    };
  }, [scope, enabled]);

  return nativeLive;
}

/**
 * Is this highlight a word, or is it a passage?
 *
 * The honest answer to "what if someone highlights a really long section": you
 * do not offer to define it. A definition is for something you could look up,
 * so the glossary control appears for a short, punctuation-free run of a few
 * words and nowhere else. Everything longer is a passage, and a passage is a
 * thing you ask about.
 */
function looksLikeTerm(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > MAX_TERM_LENGTH) return false;
  if (t.split(/\s+/).length > 5) return false;
  // A clause, not a term.
  return !/[.!?;:]/.test(t.slice(0, -1));
}

/** A term is a term. Past this it is a sentence. Mirrors the API's own cap. */
const MAX_TERM_LENGTH = 60;


/**
 * One question, five boxes, an end label at each end and a skip.
 *
 * Both interleaved questions are this object — familiarity and "how much did
 * you like it". They were two arrangements of the same idea inside a framed
 * block with a heading, a caption and a footnote, which read as a survey card
 * dropped into the middle of a paper. One row, no frame: a question in the
 * reading column, not a form.
 */
function ScaleRow({ question, lowLabel, highLabel, value, onSelect, onSkip, note, ariaPrefix, centered = false }: {
  question: React.ReactNode;
  lowLabel: string;
  highLabel: string;
  value?: number | null;
  onSelect: (level: number) => void;
  onSkip?: () => void;
  /** The trust line. Shown where the reader is correcting a stored level, not mid-wait. */
  note?: string;
  ariaPrefix: string;
  /** In the conversation it stands alone in its own block, so it centres. */
  centered?: boolean;
}) {
  return (
    <div style={centered ? { textAlign: "center" } : undefined}>
      <p style={{ ...BODY_SM, margin: "0 0 10px" }}>{question}</p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, justifyContent: centered ? "center" : "flex-start" }}>
        <span style={{ ...BODY_SM, color: DIM }}>{lowLabel}</span>
        {[1, 2, 3, 4, 5].map(level => (
          <button
            key={level}
            onClick={() => onSelect(level)}
            aria-label={`${level} out of 5 — ${ariaPrefix}`}
            aria-pressed={value === level}
            style={{
              ...BODY_SM,
              width: 28,
              height: 28,
              padding: 0,
              border: BORDER,
              background: value === level ? INK : SURFACE,
              color: value === level ? SURFACE : INK,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {level}
          </button>
        ))}
        <span style={{ ...BODY_SM, color: DIM }}>{highLabel}</span>
        {onSkip && !centered && (
          <button
            onClick={onSkip}
            style={{ ...BODY_SM, marginLeft: "auto", background: "none", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", color: DIM }}
          >
            Skip
          </button>
        )}
      </div>
      {/* Centred, the skip goes under rather than out to the right: pushed to a
          margin by `margin-left: auto` it is the one thing off the axis. */}
      {onSkip && centered && (
        <button
          onClick={onSkip}
          style={{ ...BODY_SM, margin: "10px auto 0", display: "block", background: "none", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", color: DIM }}
        >
          Skip
        </button>
      )}
      {note && <p style={{ ...BODY_SM, color: MUTED, margin: "9px 0 0" }}>{note}</p>}
    </div>
  );
}

function FamiliarityScale({ topic, currentLevel, onSelect, onSkip, lead, centered }: {
  topic: FamiliarityTopic;
  currentLevel?: number | null;
  onSelect: (level: number) => void;
  onSkip?: () => void;
  /** Mid-answer the question opens with "While I read:"; as a correction it just asks. */
  lead?: string;
  centered?: boolean;
}) {
  return (
    <ScaleRow
      question={<>{lead ?? "How"} familiar are you with <strong>{topic.name}</strong>?</>}
      lowLabel="new to it"
      highLabel="I work on this"
      value={currentLevel}
      onSelect={onSelect}
      onSkip={onSkip}
      note={onSkip ? undefined : "This changes how things are explained to you. It never changes what gets selected."}
      ariaPrefix={`familiar with ${topic.name}`}
      centered={centered}
    />
  );
}

/**
 * The second question, asked only in the dead air of a dig and only once per
 * paper. How much a paper was worth someone's evening is exactly what the
 * librarian cannot infer from a save alone.
 */
function PaperRating({ value, onSelect, onSkip, waiting = true, centered }: {
  value?: number | null;
  onSelect: (level: number) => void;
  onSkip: () => void;
  /** Still streaming. Once the answer has landed, "while I read" is not true. */
  waiting?: boolean;
  centered?: boolean;
}) {
  return (
    <ScaleRow
      question={waiting ? "While I read: how much did you like this paper?" : "How much did you like this paper?"}
      lowLabel="not for me"
      highLabel="loved it"
      value={value}
      onSelect={onSelect}
      onSkip={onSkip}
      ariaPrefix="liked this paper"
      centered={centered}
    />
  );
}

/**
 * What to say while a dig is running, in order of how much it is worth.
 *
 * A maintained content surface, like the first-run tips: these name real
 * features, so update them when one is added, renamed or removed.
 */
const DIG_WAIT_TIPS = [
  "Highlight anything else while you wait. Answers stack as cards over here.",
  "Type your own question in the bar, or just press Ask and I'll explain the passage.",
  "Underlined words carry a definition. Hover or tap one, or open the glossary top right.",
  "Answers read the paper's full text, then check it against what current web sources say.",
  "A question that isn't about one sentence goes in the corner, bottom right.",
];

const TIP_ROTATE_MS = 6000;

/**
 * The wait: the stamp, one line, and a rotating tip.
 *
 * The interleaved question used to live in here and die with it, which meant a
 * question you were half a second too slow to answer vanished under the answer
 * you were waiting for. The question is its own thing now and it outlives the
 * wait — see `InterleaveQuestion` — so this is only the wait.
 *
 * Nothing here is framed. A box makes a two-second wait look like a task.
 */
function DigWait({ showTips }: { showTips: boolean }) {
  const [tip, setTip] = useState(0);

  useEffect(() => {
    if (!showTips) return;
    const id = setInterval(() => setTip(t => (t + 1) % DIG_WAIT_TIPS.length), TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, [showTips]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* The stamp, centred, not a spinner pinned to a line of text: this is the
          same wait as every other wait in the product and it should be the same
          object. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "10px 0 2px" }}>
        <PageLoader inline />
        <span style={{ ...BODY_SM, color: MUTED, textAlign: "center" }}>
          Re-reading the paper for that&hellip;
        </span>
      </div>

      {showTips && (
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <span style={LABEL_STYLE}>Tip</span>
          <span style={{ ...BODY_SM, color: DIM }}>{DIG_WAIT_TIPS[tip]}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The one question the interleave owes, at the top of the card, staying put.
 *
 * It used to appear only inside the wait, which made it a race: the answer
 * arrived, the whole wait was replaced, and the question you were reaching for
 * went with it. Whether it was worth asking has nothing to do with whether the
 * model has finished, so it now sits above the answer and stays until it is
 * answered or waved off. The lead changes when the answer lands, because
 * "while I read" stops being true.
 */
function InterleaveQuestion({ familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity, ratingOffer, ratingValue, onRating, onSkipRating, waiting }: {
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
  ratingOffer: boolean;
  ratingValue?: number | null;
  onRating: (level: number) => void;
  onSkipRating: () => void;
  /** Still streaming, so the question can say so. */
  waiting: boolean;
}) {
  if (familiarityOffer) {
    return (
      <FamiliarityScale
        topic={familiarityOffer}
        currentLevel={familiarityValue?.level}
        onSelect={onFamiliarity}
        onSkip={onSkipFamiliarity}
        lead={waiting ? "While I read: how" : "How"}
        centered
      />
    );
  }
  if (ratingOffer) {
    return <PaperRating value={ratingValue} onSelect={onRating} onSkip={onSkipRating} waiting={waiting} centered />;
  }
  return null;
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
      ¶ Ask about this paragraph
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
 * The recap of every hard word, above the conversation in the rail.
 *
 * The chips in the prose define each term where you meet it; this catches the
 * ones the companion flagged but never used in its own copy, holds the ones the
 * reader added themselves, and gives you somewhere to look a word back up.
 *
 * Collapsed by default, because it is reference and not read, and it opens in
 * place rather than in a menu over the page: it belongs beside the conversation,
 * which is the other thing in this column you build up as you go.
 */
function Glossary({ terms, pending, open, onToggle }: {
  terms: Jargon[];
  /** Words the reader just added, still being defined. */
  pending: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const count = terms.length + pending.length;
  return (
    <div style={{ border: BORDER, background: SURFACE, padding: "12px 16px", flexShrink: 0 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ ...DISPLAY_SM, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        <span style={{ flex: 1 }}>Glossary ({count})</span>
        <ChevronDown
          size={16}
          style={{ color: MUTED, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </button>
      {open && (
        <dl style={{ margin: "10px 0 0", maxHeight: "32vh", overflowY: "auto" }}>
          {pending.map(term => (
            <div key={`pending-${term}`} style={{ padding: "10px 0", borderTop: HAIRLINE }}>
              <dt style={{ ...BODY_SM, fontWeight: 600 }}>{term}</dt>
              <dd style={{ ...BODY_SM, color: MUTED, fontStyle: "italic", margin: "2px 0 0" }}>Looking it up&hellip;</dd>
            </div>
          ))}
          {terms.map(g => (
            <div key={g.term} style={{ padding: "10px 0", borderTop: HAIRLINE }}>
              <dt style={{ ...BODY_SM, fontWeight: 600 }}>{g.term}</dt>
              <dd style={{ ...BODY_SM, color: DIM, margin: "2px 0 0" }}>{g.def}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * The conversation. One panel, one thread of talk, filling the rail.
 *
 * This replaces three things that were all trying to be it: a stack of answer
 * cards in the rail, a separate "Ask this paper" panel, and a bar floating over
 * the selection. Highlighting now does one thing: the passage arrives here, the
 * panel opens, and the cursor is in the field. What you are about to ask about
 * is legible while you type it, in the paper's own colour, and the sentence it
 * came from is marked in the same colour over in the read.
 *
 * Everything lands here in the order it happened. A block that began as a
 * highlight carries its passage at the top, and pressing it takes the read back
 * to the sentence; clicking the sentence in the prose lights the block here.
 *
 * Flat, on purpose. It was a numbered square inside a filled chip inside a
 * block above an answer behind a rule, which is four frames deep for one
 * answer. No numerals and no rule down the answer: the passage in colour, the
 * question in bold, the answer in plain text.
 *
 * The composer continues the conversation rather than starting a new thread,
 * which is what makes it a chat: highlight to change the subject, type to keep
 * pulling on the one you are on.
 */
function Conversation({
  threads, hue, pending, streaming, queued, failed, linked, open, onToggle,
  held, onDropHeld, onDefine, logRef, onLink, onJumpToPassage, onAsk,
  familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity,
  ratingOffer, ratingValue, onRating, onSkipRating, offerOn,
}: {
  threads: ReadingThread[];
  /** The paper's flat colour. Not the wash: in this column colour is a fill. */
  hue: string;
  /** Folded until the reader highlights something or opens it. */
  open: boolean;
  onToggle: () => void;
  /** The companion is still reading the paper, so there is nothing to ask yet. */
  pending: boolean;
  streaming: boolean;
  /** Questions asked while another was being written. They run in order. */
  queued: number;
  failed: string | null;
  /** The thread being pointed at, from either end. */
  linked: string | null;
  /** The passage the reader just highlighted, waiting for a question. */
  held: Pick | null;
  onDropHeld: () => void;
  /** Offered only for something term-shaped. See `looksLikeTerm`. */
  onDefine: (() => void) | null;
  logRef: React.RefObject<HTMLDivElement | null>;
  onLink: (threadId: string | null) => void;
  onJumpToPassage: (threadId: string) => void;
  /** An empty question with a passage held asks `DEFAULT_QUESTION`. */
  onAsk: (question: string) => void;
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
  ratingOffer: boolean;
  ratingValue?: number | null;
  onRating: (level: number) => void;
  onSkipRating: () => void;
  /** Which thread the interleave's one question belongs to. */
  offerOn: string | null;
}) {
  const [draft, setDraft] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);

  // A passage arriving is a request to type. Put the cursor where the typing
  // goes, the way the prototype's companion did.
  useEffect(() => {
    if (!held || !open) return;
    fieldRef.current?.querySelector("input")?.focus();
  }, [held, open]);

  const exchanges = threads.reduce((n, t) => n + t.turns.length, 0);

  const submit = () => {
    const q = draft.trim();
    // With a passage held, an empty field is still a question: the one almost
    // everybody was going to type.
    if ((!q && !held) || pending) return;
    onAsk(q || DEFAULT_QUESTION);
    setDraft("");
  };

  return (
    <div
      className="reading-talk"
      data-talk
      style={{
        border: BORDER, boxShadow: SHADOW, background: SURFACE,
        display: "flex", flexDirection: "column", minHeight: 0,
        // Folded, it is a bar. Open, it takes the rest of the rail.
        flex: open ? "1 1 auto" : "0 0 auto",
      }}
    >
      {/* Flat colour, not the card wash. A soft three-blob gradient behind a
          20px heading in a 480px column reads as a smudge; the passages below
          it are filled with the same colour flat, and a column should say one
          thing one way. */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          background: hue, border: "none", borderBottom: open ? BORDER : "none",
          padding: "14px 18px", cursor: "pointer", textAlign: "left", flexShrink: 0,
          display: "flex", alignItems: "flex-start", gap: 12, width: "100%",
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...DISPLAY_SM, display: "block" }}>Reading with you</span>
          <span style={{ ...BODY_SM, display: "block", marginTop: 4 }}>
            {open
              ? "Highlight anything in the paper, or just ask. I read the paper, then check it against current web sources."
              : exchanges > 0
                ? `${exchanges} question${exchanges === 1 ? "" : "s"} so far. Highlight anything, or open this and ask.`
                : "Highlight anything in the paper, or open this and ask."}
          </span>
        </span>
        {streaming && !open && <PageLoader inline />}
        <ChevronDown
          size={18}
          style={{ flexShrink: 0, marginTop: 2, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </button>

      {!open ? null : (
      <>
      <div ref={logRef} style={{ overflowY: "auto", padding: "0 18px", flex: 1, minHeight: 0 }}>
        {pending && (
          <p style={{ ...BODY_SM, color: MUTED, margin: "16px 0" }}>
            Still reading the paper. Ask anything once it&rsquo;s done.
          </p>
        )}

        {!pending && threads.length === 0 && !streaming && (
          <p style={{ ...BODY_SM, color: MUTED, margin: "16px 0" }}>
            Nothing yet. Highlight a sentence in the paper, or ask me anything about it.
          </p>
        )}

        {threads.map((thread, ti) => {
          const lit = linked === thread.id;
          return (
            <div
              key={thread.id}
              data-thread-id={thread.id}
              onMouseEnter={() => onLink(thread.id)}
              onMouseLeave={() => onLink(null)}
              // Nothing here moves on hover and nothing grows a second rule.
              style={{ padding: "18px 0", borderTop: ti === 0 ? "none" : HAIRLINE }}
            >
              {thread.selection && (
                // The passage, in the paper's flat colour, and it is the way
                // back. Lit, it takes the ink underline a marked passage wears
                // in the prose: same signal, both ends, no movement.
                <button
                  onClick={() => onJumpToPassage(thread.id)}
                  title="Take me back to this sentence"
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: hue, border: "none", padding: "8px 10px", margin: "0 0 12px", cursor: "pointer",
                    boxShadow: lit ? `0 2px 0 0 ${INK}` : "none",
                  }}
                >
                  {/* Three lines, then an ellipsis. A reader can highlight half
                      a beat, and reprinting half a beat above its own answer is
                      what the old inline panel did wrong. The whole passage is
                      still the anchor and is still marked in the paper. */}
                  <span
                    style={{
                      ...BODY_SM,
                      display: "-webkit-box", WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                    }}
                  >
                    {thread.selection}
                  </span>
                </button>
              )}

              {thread.turns.map((turn, i) => (
                <div key={turn.id} style={{ marginTop: i === 0 ? 0 : 18 }}>
                  <p style={{ ...BODY_STYLE, fontWeight: 600, margin: "0 0 8px" }}>{turn.question}</p>
                  {turn.answer
                    ? <p style={{ ...BODY_STYLE, margin: 0 }}>{turn.answer}</p>
                    : <DigWait showTips={offerOn !== thread.id} />}
                </div>
              ))}

              {/* The interleave's one question, under the answer it interrupted
                  and outliving the wait. No rule above it, and centred in its
                  own block: it is a question being asked of the reader, not
                  another section of the answer. */}
              {offerOn === thread.id && (familiarityOffer || ratingOffer) && (
                <div style={{ marginTop: 18 }}>
                  <InterleaveQuestion
                    familiarityOffer={familiarityOffer}
                    familiarityValue={familiarityValue}
                    onFamiliarity={onFamiliarity}
                    onSkipFamiliarity={onSkipFamiliarity}
                    ratingOffer={ratingOffer}
                    ratingValue={ratingValue}
                    onRating={onRating}
                    onSkipRating={onSkipRating}
                    waiting={thread.turns.every(t => !t.answer)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {queued > 0 && (
          <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 16px" }}>
            {queued} more in line.
          </p>
        )}
      </div>

      <div style={{ borderTop: BORDER, flexShrink: 0 }} ref={fieldRef}>
        {held && (
          // The passage you are about to ask about, in its own ruled row so the
          // fill never runs into the button under it.
          <div style={{ padding: "10px 14px", borderBottom: HAIRLINE, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span
              style={{
                ...BODY_SM, background: hue, padding: "2px 4px", flex: 1, minWidth: 0,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const, overflow: "hidden",
              }}
            >
              {held.text}
            </span>
            {/* The second verb, and only when it means something: a word is a
                thing you look up and keep, a passage is a thing you ask about. */}
            {onDefine && (
              <button
                onClick={onDefine}
                title="Define this and keep it in the glossary"
                style={{ ...BODY_SM, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, flexShrink: 0, whiteSpace: "nowrap" }}
              >
                + Glossary
              </button>
            )}
            <button
              onClick={onDropHeld}
              aria-label="Drop this passage"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, padding: "12px 14px" }}>
          <TextInput
            value={draft}
            onChange={setDraft}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            placeholder={held ? `Ask about this, or just “${DEFAULT_QUESTION}”` : threads.length ? "Keep going…" : "Ask anything about this paper…"}
            ariaLabel="Ask a question about this paper"
          />
          <ActionButton
            onClick={submit}
            variant="primary"
            shadow={false}
            disabled={(!draft.trim() && !held) || pending}
            style={{ flexShrink: 0 }}
          >
            Ask
          </ActionButton>
        </div>
        {failed && <p style={{ ...BODY_SM, color: ACID_PINK, margin: "0 14px 12px" }}>{failed}</p>}
      </div>
      </>
      )}
    </div>
  );
}

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
export function ReadingPaperDetail({ paper, index = 0, onBack, fixture }: {
  paper: PaperItem;
  /**
   * The paper's position on the shelf — its wash index, so this page wears the
   * same hue as the card it was opened from: the dig panels and the "Remember
   * this" frame. Hard words no longer take it (see `annotateText`) — on this
   * page a filled word competes with the selection, which is the one thing here
   * that has to be unmistakable.
   */
  index?: number;
  onBack?: () => void;
  /** Prototype only — see `ReadingFixture`. */
  fixture?: ReadingFixture;
}) {
  const byline = paperByline(paper);
  const foundational = paper.category === "foundational";
  // The card's first wash hue — what a dug passage wears in the prose, and what
  // the "Remember this" frame is washed in. Never GOLD: that is a line colour,
  // and behind a word it is too dark to read the word through.
  const hue = foundational ? foundationalSlots()[0] : washSlots(index)[0];
  const washStyle = foundational ? foundationalWash() : wash(index);

  // A fixture is data the caller already has, so the prototype starts in the
  // state it is meant to show rather than flashing "Reading the paper…" for a
  // frame. In production `fixture` is undefined and every one of these is the
  // empty value it always was.
  const [companion, setCompanion] = useState<Companion | null>(fixture?.companion ?? null);
  const [familiarityValue, setFamiliarityValue] = useState<FamiliarityValue | null>(fixture?.familiarity ?? null);
  const [familiarityOffer, setFamiliarityOffer] = useState<FamiliarityTopic | null>(null);
  const [lastDigThreadId, setLastDigThreadId] = useState<string | null>(null);
  const [companionPending, setCompanionPending] = useState(!fixture);
  const [companionFailed, setCompanionFailed] = useState(false);
  const [homework, setHomework] = useState<HomeworkItem[] | null>(fixture ? fixture.homework : null);

  const [threads, setThreads] = useState<ReadingThread[]>(fixture ? groupThreads(fixture.qa.map(normalizeTurn)) : []);
  const [streamingTurn, setStreamingTurn] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [tipSeen, setTipSeen] = useState(true);

  // How much they liked the paper. Asked at most once per paper, only in the
  // dead air of a dig, and only after the familiarity question is out of the
  // way — two questions in one wait is a survey.
  const [rating, setRating] = useState<number | null>(null);
  const [ratingDeclined, setRatingDeclined] = useState(false);

  // Digs made in this session open; ones rehydrated from the thread store on
  // load stay folded, so re-opening a paper you have dug into four times shows
  // you the paper rather than your own back-catalogue.
  const freshThreads = useRef(new Set<string>());
  const offerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The streaming flag as a ref too — the deferred offer has to read it at fire
  // time, not close over whatever it was when the dig started.
  const streamingRef = useRef<string | null>(null);
  // Busy is a ref, not the state: it has to be true from the instant `ask` is
  // called, not from the first token, or two questions in the same second both
  // get through.
  const busy = useRef(false);
  const queuedAsks = useRef<AskPayload[]>([]);
  const askRef = useRef<((payload: AskPayload) => Promise<void>) | null>(null);

  // Words the reader added from the bar, still being defined. They show in the
  // glossary immediately, greyed, because a word you just asked to keep should
  // appear in the list you asked to keep it in.
  const [pendingTerms, setPendingTerms] = useState<string[]>([]);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  // Folded until it has something to say. The rail is beside a paper someone
  // came here to read, and an open panel with three suggested questions in it
  // is the product asking for attention before the reader has spent any. It
  // opens itself the moment a question is asked, from anywhere.
  const [talkOpen, setTalkOpen] = useState(false);
  const [queued, setQueued] = useState(0);

  // The one live tie between a passage and the part of the conversation about
  // it. Whichever end you point at, both respond, and clicking either end takes
  // you to the other. Set by a hover, or by a jump, in which case it is a flash
  // that fades on its own so the block you were sent to is obvious for a beat.
  const [linked, setLinked] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const proseRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // The passage the reader is holding: taken on release, and it stays until it
  // is asked about or dropped. Highlighting opens the conversation and puts it
  // there, which is the whole gesture now — nothing floats over the sentence.
  const [held, setHeld] = useState<Pick | null>(null);

  const nativeSelectionLive = useSelectionPick(proseRef, !companionPending, captured => {
    setHeld(captured);
    setTalkOpen(true);
  });

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const flash = useCallback((threadId: string) => {
    setLinked(threadId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setLinked(null), 1600);
  }, []);

  /** Click a highlighted passage: go to what we said about it. */
  const jumpToTalk = useCallback((threadId: string) => {
    flash(threadId);
    logRef.current
      ?.querySelector(`[data-thread-id="${threadId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [flash]);

  /** And the reverse: click the passage in the conversation, go to the sentence. */
  const jumpToPassage = useCallback((threadId: string) => {
    flash(threadId);
    proseRef.current
      ?.querySelector(`[data-mark-id="${threadId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [flash]);

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
    (async () => {
      // Whether they have already told us. Cheap, and it is the difference
      // between asking once and asking every time they dig.
      try {
        const res = await fetch(`/api/papers/${paper.id}/rating`);
        const data = await res.json();
        if (!cancelled && typeof data.level === "number") setRating(data.level);
      } catch { /* unknown reads as un-rated, which only costs one question */ }
    })();
    return () => { cancelled = true; };
  }, [paper.id, fixture, loadCompanion]);

  /* ── Asking ── */

  const ask = useCallback(async (payload: AskPayload) => {
    // Asked while another answer is being written: queue it rather than drop
    // it. This was the other half of "highlighting stopped working" — the guard
    // here was `if (streamingTurn) return`, so a second question during a
    // five-second answer did nothing at all, silently, with the passage already
    // thrown away.
    if (busy.current) {
      queuedAsks.current.push(payload);
      setQueued(queuedAsks.current.length);
      setTalkOpen(true);
      return;
    }
    busy.current = true;
    setAskError(null);
    // Asking anything unfolds the conversation. The panel is closed by default,
    // so this is the one thing that has to open it, and it has to happen before
    // the first token rather than with it.
    setTalkOpen(true);
    const handlers = {
      start: (e: StartEvent) => {
        setStreamingTurn(e.id);
        streamingRef.current = e.id;
        if (e.selection) freshThreads.current.add(e.threadId);
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
      streamingRef.current = null;
      busy.current = false;
      const next = queuedAsks.current.shift();
      setQueued(queuedAsks.current.length);
      if (next) void askRef.current?.(next);
    }
  }, [paper.id, fixture]);

  // The queue drains through a ref so `ask` does not have to depend on itself.
  useEffect(() => { askRef.current = ask; });

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

  const submitRating = useCallback((level: number) => {
    const previous = rating;
    setRating(level); // optimistic: a rating is one tap and must feel like one
    if (fixture) return;
    void fetch(`/api/papers/${paper.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    }).catch(() => setRating(previous));
  }, [fixture, paper.id, rating]);

  const skipRating = useCallback(() => setRatingDeclined(true), []);

  useEffect(() => () => { if (offerTimer.current) clearTimeout(offerTimer.current); }, []);

  // A new question lands at the bottom of a conversation that may already be
  // taller than the panel, so keep the foot of it in view. Chat rules: the
  // newest thing is the thing you are looking at.
  useEffect(() => {
    if (!threads.length) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [threads.length]);

  /**
   * Keep this word. The other half of highlighting: a definition, written
   * against this paper's own text, appended to the glossary where it stays.
   */
  const define = useCallback(async (term: string) => {
    window.getSelection()?.removeAllRanges();
    setHeld(null);
    if (!tipSeen) { markNuxSeen(READING_TIP_KEY); setTipSeen(true); }
    const clean = term.trim();
    if (!clean) return;
    // Open the list you just added to, or the add goes somewhere invisible.
    setGlossaryOpen(true);
    setPendingTerms(prev => prev.includes(clean) ? prev : [...prev, clean]);
    try {
      if (fixture) {
        await new Promise(r => setTimeout(r, 1200));
        setCompanion(prev => prev && ({
          ...prev,
          glossary: [...prev.glossary, {
            term: clean,
            def: `Sample definition of "${clean}". In the product this comes from /api/papers/[id]/glossary, written against the paper's own text so the term is defined the way this paper uses it.`,
            tier: "working" as const,
          }],
        }));
        return;
      }
      const res = await fetch(`/api/papers/${paper.id}/glossary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: clean }),
      });
      const data = await res.json();
      if (!res.ok || !data.entry) throw new Error(data.error || "Couldn't add that one.");
      setCompanion(prev => {
        if (!prev) return prev;
        if (prev.glossary.some(g => g.term.toLowerCase() === data.entry.term.toLowerCase())) return prev;
        return { ...prev, glossary: [...prev.glossary, data.entry] };
      });
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Couldn't add that one.");
    } finally {
      setPendingTerms(prev => prev.filter(t => t !== clean));
    }
  }, [fixture, paper.id, tipSeen]);

  /** A question about the passage being held. */
  const askHere = useCallback((question: string, text: string, section: SectionKey) => {
    window.getSelection()?.removeAllRanges();
    setHeld(null);
    if (!tipSeen) { markNuxSeen(READING_TIP_KEY); setTipSeen(true); }
    // The interleave lives in the wait, and the reader is allowed one question a
    // day across the whole product. Reserving it the instant a question starts
    // would spend that question on a two-second wait nobody read. Make the
    // answer prove it is slow first.
    if (offerTimer.current) clearTimeout(offerTimer.current);
    offerTimer.current = setTimeout(() => {
      if (streamingRef.current) reserveFamiliarityOffer();
    }, OFFER_AFTER_MS);
    ask({ question, selection: text, sectionKey: section });
  }, [ask, reserveFamiliarityOffer, tipSeen]);

  /* ── Prose ── */

  // One shared "already defined" set for the whole walkthrough, rebuilt on each
  // render so the chips land in the same places every time.
  const activeFamiliarity = familiarityValue && companion?.topic?.id === familiarityValue.topicId
    ? familiarityValue
    : null;
  const glossary = glossaryForLevel(companion?.glossary ?? [], activeFamiliarity);
  const defined = new Set<string>();

  const marksFor = (key: SectionKey): BeatMark[] => [
    // The live selection first, so re-highlighting a passage you already asked
    // about shows it as the current selection rather than as an old one.
    ...(held && held.section === key && !nativeSelectionLive
      ? [{ text: held.text, fill: hue }]
      : []),
    ...digsForSection(threads, key)
      .map(t => ({
        id: t.id,
        text: t.selection ?? "",
        fill: hue,
        active: linked === t.id,
        onClick: () => jumpToTalk(t.id),
        onEnter: () => setLinked(t.id),
        onLeave: () => setLinked(null),
      }))
      .filter(m => m.text),
  ];
  const mark = (text: string, key: SectionKey) => annotateBeat(text, glossary, defined, marksFor(key));

  const sectionText: Record<SectionKey, string> = {
    gist: companion?.gist ?? "",
    did: companion?.did ?? "",
    found: companion?.found ?? "",
    caveats: companion?.caveats ?? "",
    remember: companion?.remember ?? "",
  };

  const beatDig = (key: SectionKey) => (
    sectionText[key]
      ? <DigThisBeat onDig={() => { setHeld({ text: sectionText[key], section: key }); setTalkOpen(true); }} />
      : null
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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
      </div>

      <div className="reading-shell">
        <div style={{ minWidth: 0 }} ref={proseRef}>
          <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>{paper.title}</h1>
          {byline && (
            <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "0 0 8px" }}>{byline}</p>
          )}

          {/* No "pulled in for" line and no "you rated yourself" callout. Both
              were the product explaining itself above a paper the reader opened
              on purpose, and the page is for the paper. */}
          <div style={{ height: 18 }} />

          {/* Taught once, and retired on the first question. One line, a bolded
              sentence-case lead-in rather than a mono eyebrow: it is a tip, not
              a section. Pre-lighting a sentence or two in the paper's hue was
              built and rejected (see docs/design-decisions.md) because it puts
              the product's hand on which sentences matter before the reader has
              read any of them. */}
          {!tipSeen && !companionPending && companion && (
            <p style={{ ...BODY_SM, color: DIM, margin: "0 0 26px", maxWidth: 620 }}>
              <strong>Tip:</strong> highlight part of the text to ask more about it and dig deeper.
            </p>
          )}

          {/* ── The gist ── */}
          {companionPending ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
              <span style={{ ...BODY_STYLE, color: MUTED }}>Reading the paper…</span>
            </div>
          ) : companion?.gist ? (
            <>
              <p data-section="gist" style={{ ...READING_BODY, margin: 0 }}>{mark(companion.gist, "gist")}</p>
              {beatDig("gist")}
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
              <Beat heading="What they did" sectionKey="did">{mark(companion.did, "did")}</Beat>
              {beatDig("did")}
            </>
          )}
          {companion?.found && (
            <>
              <Beat heading="What they found" sectionKey="found">{mark(companion.found, "found")}</Beat>
              {beatDig("found")}
            </>
          )}
          {companion?.caveats && (
            <>
              <Beat heading="Where it's shaky" sectionKey="caveats">{mark(companion.caveats, "caveats")}</Beat>
              {beatDig("caveats")}
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
                {/* Marks but no chips: a passage dug into here still shows it,
                    and so does the one being highlighted right now, but the one
                    line worth keeping is not the place to start defining
                    words. */}
                <p data-section="remember" style={{ ...READING_BODY, fontWeight: 600, margin: 0 }}>
                  {annotateBeat(companion.remember, [], defined, marksFor("remember"))}
                </p>
              </div>
            </>
          )}


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

        {/* ── The rail: your answers, the glossary, then Ask this paper ──
            One scroll region, not three. The whole column is sticky and scrolls
            inside itself, so the stack can grow all evening without pushing the
            composer off the bottom of the screen. */}
        {/* The rail is the conversation, full height. It was a stack of answer
            cards with a separate chat panel in the corner, which was two places
            to look for one conversation, split by whether a question happened
            to start from a highlight. */}
        <aside className="reading-aside">
          {/* Reference above the conversation, folded until wanted. Both are
              things this column accumulates as you read. */}
          {(glossary.length > 0 || pendingTerms.length > 0) && (
            <Glossary
              terms={glossary}
              pending={pendingTerms}
              open={glossaryOpen}
              onToggle={() => setGlossaryOpen(v => !v)}
            />
          )}
          <Conversation
            threads={threads}
            hue={hue}
            pending={companionPending}
            open={talkOpen}
            onToggle={() => setTalkOpen(v => !v)}
            streaming={!!streamingTurn}
            queued={queued}
            failed={askError}
            linked={linked}
            held={held}
            onDropHeld={() => setHeld(null)}
            onDefine={held && looksLikeTerm(held.text) ? () => define(held.text) : null}
            logRef={logRef}
            onLink={setLinked}
            onJumpToPassage={jumpToPassage}
            // A held passage makes it a question about that passage, which is
            // the only reason a question needs a thread of its own. Otherwise
            // typing continues the conversation: highlight to change the
            // subject, type to keep pulling on this one.
            onAsk={q => held
              ? askHere(q, held.text, held.section)
              : ask({ question: q, threadId: threads.at(-1)?.id })}
            familiarityOffer={familiarityOffer}
            familiarityValue={activeFamiliarity}
            onFamiliarity={setFamiliarity}
            onSkipFamiliarity={skipFamiliarity}
            // Second in the queue: never before the familiarity question has
            // been answered or waved off, never twice, never once they have told
            // us.
            ratingOffer={!familiarityOffer && rating === null && !ratingDeclined && !!lastDigThreadId}
            ratingValue={rating}
            onRating={submitRating}
            onSkipRating={skipRating}
            offerOn={lastDigThreadId}
          />
        </aside>
      </div>

      <style>{`
        /* Wider than the old rail: it is a conversation now, not a stack of
           notes, and 372px made every answer eleven words to a line. */
        .reading-shell { display: grid; grid-template-columns: minmax(0, 1fr) 480px; gap: 44px; align-items: start; }
        /* The conversation holds position and fills the screen's height while
           the walkthrough scrolls past it. The panel itself is the scroll
           container: the log scrolls, the header and the composer do not, so the
           place you type is always in the same place. */
        /* Bottom-aligned: folded, the glossary and the conversation sit in the
           bottom right corner of the screen rather than floating at the top of a
           column of nothing. Open, the conversation grows upward into the space
           above them. */
        .reading-aside {
          position: sticky; top: 8px; height: calc(100vh - 24px);
          display: flex; flex-direction: column; justify-content: flex-end; gap: 16px;
        }
        /* The glossary takes what it needs; the conversation takes the rest. */
        .reading-talk { flex: 1; min-height: 0; }
        /* No ::selection override here. The drag wears the product's ordinary
           ink selection, and the paper's hue arrives on release, drawn by the
           page in useSelectionPick. Acid green is out of this interaction: it
           said "confirmed" about a passage nothing had happened to yet, and it
           was the same green on a pink paper as on a blue one. */
        /* Desktop selects; touch taps the beat's own affordance, because touch
           selection loses to the native callout. */
        .reading-beat-dig { display: none; }
        @media (max-width: 1060px) {
          .reading-shell { grid-template-columns: 1fr; gap: 0; }
          /* Below the read there is no viewport height to fill, so the panel
             takes what it needs up to a limit and the page scrolls past it. */
          .reading-aside { position: static; height: auto; margin: 56px 0 0; }
          .reading-talk { flex: none; max-height: 76vh; }
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


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
  DEFAULT_QUESTION, askThreads, digThreads, digsForSection, groupThreads,
  type ReadingThread, type SectionKey, type ThreadTurn,
} from "@/lib/reading-thread";
import {
  ACID_PINK, ActionButton, BODY_SM, BODY_STYLE, BORDER, BORDER_HAIR, DIM, DISPLAY_LG, DISPLAY_SM, GOLD,
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
  x: number;
  y: number;
}

/** A word is not a passage. Below this, the reader is probably just reading. */
const MIN_SELECTION = 16;

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
 * Watch for a selection inside the walkthrough and report where it ended.
 *
 * Anchored to the section rather than to DOM offsets: what gets stored is the
 * quoted text and which beat it came from, so a panel survives a re-render, a
 * refresh, and a companion that was regenerated in between.
 *
 * Two highlights, in sequence, and the handoff between them is the interaction.
 * While the mouse is down the browser draws its own selection — the ink one this
 * product uses everywhere, no override. The instant it is released, the passage
 * is captured and the DOM selection is collapsed on purpose, so the page can
 * redraw the same words in the paper's own hue (see `annotateBeat`). Drag black,
 * release colour: the colour is the confirmation that the passage is now the
 * thing the question will be asked about.
 *
 * `nativeLive` is what keeps the two from stacking — while the browser is still
 * drawing (a keyboard selection, which is never collapsed out from under the
 * reader), the page draws nothing.
 */
function useSelectionPick(scope: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [nativeLive, setNativeLive] = useState(false);

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

    const read = (event?: Event) => {
      const released = event?.type === "mouseup";
      // Anything that happens inside the menu is the reader using the menu, not
      // re-selecting. Focusing the question box necessarily collapses the DOM
      // selection, and without this the menu would close the instant it was
      // clicked into. The passage is already captured in state by then.
      const target = event?.target as Element | null;
      if (target?.closest?.("[data-selection-menu]")) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setPick(null);
      if (sel.toString().trim().length < MIN_SELECTION) return setPick(null);

      const range = sel.getRangeAt(0);
      const scopeEl = scope.current;
      if (!scopeEl) return setPick(null);
      const host = beatFor(range, scopeEl);
      if (!host) return setPick(null);

      const clipped = clipToBeat(range, host);
      if (!clipped) return setPick(null);
      const text = clipped.toString().trim();
      if (text.length < MIN_SELECTION) return setPick(null);

      // Zero-width rects turn up at the ends of a multi-line range, and putting
      // the bar on one lands it at the left margin of a line nobody touched.
      const rects = Array.from(clipped.getClientRects()).filter(r => r.width > 0 && r.height > 0);
      const last = rects[rects.length - 1];
      if (!last) return setPick(null);

      setPick({
        text,
        section: host.dataset.section as SectionKey,
        x: last.right,
        y: last.bottom,
      });

      // Hand the highlight over: the browser's ink selection was the drag, the
      // paper's hue is the held passage. Only on release of the mouse — a
      // keyboard selection is still being made and must not be collapsed
      // mid-stroke.
      if (released) sel.removeAllRanges();
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

  return [pick, setPick, nativeLive] as const;
}

/**
 * The floating menu. Hard border, the one shadow, no radius — the same object as
 * every other frame, just small and following the cursor.
 *
 * One bar, one verb. It used to offer "Ask" and "Dig deeper" as two separate
 * controls and nobody could say what the difference was — they land in the same
 * place and produce the same shape of answer, so "dig deeper" is gone from the
 * interface entirely. There is a text field and an Ask button: type a question
 * and it asks it, press Ask with nothing typed and it asks the question almost
 * everybody was going to type anyway. Either way the answer posts inline under
 * the beat the passage came from, so the passage, the question and the answer
 * stay in one place.
 */
function SelectionMenu({ pick, onDig, onAsk }: {
  pick: Pick;
  /** Ask with an empty field — sends `DEFAULT_QUESTION`. */
  onDig: () => void;
  onAsk: (question: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const WIDTH = 340;
  const left = Math.min(Math.max(12, pick.x - WIDTH / 2), window.innerWidth - WIDTH - 12);
  const top = Math.min(pick.y + 10, window.innerHeight - 80);
  const typed = draft.trim();
  const submit = () => {
    if (typed) { onAsk(typed); setDraft(""); }
    else onDig();
  };

  return (
    <div
      data-selection-menu
      // mousedown, not click, on the button: clicking anywhere collapses the
      // selection, and by the time click fires the passage is gone. The input
      // is the exception — it has to be allowed to take focus.
      onMouseDown={e => {
        if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
      }}
      style={{
        position: "fixed", left, top, zIndex: 10040, width: WIDTH,
        display: "flex", alignItems: "stretch", border: BORDER, boxShadow: SHADOW, background: SURFACE,
      }}
    >
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
        }}
        placeholder={`Ask about this, or just “${DEFAULT_QUESTION}”`}
        aria-label="Ask a question about the selected passage"
        autoFocus
        style={{
          ...BODY_SM, flex: 1, minWidth: 0, background: SURFACE, color: INK,
          border: "none", outline: "none", padding: "10px 12px",
        }}
      />
      <button onMouseDown={submit} style={{ ...menuButton, borderLeft: BORDER }}>
        Ask
      </button>
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

/**
 * One question, five boxes, an end label at each end and a skip.
 *
 * Both interleaved questions are this object — familiarity and "how much did
 * you like it". They were two arrangements of the same idea inside a framed
 * block with a heading, a caption and a footnote, which read as a survey card
 * dropped into the middle of a paper. One row, no frame: a question in the
 * reading column, not a form.
 */
function ScaleRow({ question, lowLabel, highLabel, value, onSelect, onSkip, note, ariaPrefix }: {
  question: React.ReactNode;
  lowLabel: string;
  highLabel: string;
  value?: number | null;
  onSelect: (level: number) => void;
  onSkip?: () => void;
  /** The trust line. Shown where the reader is correcting a stored level, not mid-wait. */
  note?: string;
  ariaPrefix: string;
}) {
  return (
    <div>
      <p style={{ ...BODY_SM, margin: "0 0 8px" }}>{question}</p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
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
        {onSkip && (
          <button
            onClick={onSkip}
            style={{ ...BODY_SM, marginLeft: "auto", background: "none", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", color: DIM }}
          >
            Skip
          </button>
        )}
      </div>
      {note && <p style={{ ...BODY_SM, color: MUTED, margin: "9px 0 0" }}>{note}</p>}
    </div>
  );
}

function FamiliarityScale({ topic, currentLevel, onSelect, onSkip, lead }: {
  topic: FamiliarityTopic;
  currentLevel?: number | null;
  onSelect: (level: number) => void;
  onSkip?: () => void;
  /** Mid-answer the question opens with "While I read:"; as a correction it just asks. */
  lead?: string;
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
    />
  );
}

/**
 * The second question, asked only in the dead air of a dig and only once per
 * paper. How much a paper was worth someone's evening is exactly what the
 * librarian cannot infer from a save alone.
 */
function PaperRating({ value, onSelect, onSkip }: {
  value?: number | null;
  onSelect: (level: number) => void;
  onSkip: () => void;
}) {
  return (
    <ScaleRow
      question="While I read: how much did you like this paper?"
      lowLabel="not for me"
      highLabel="loved it"
      value={value}
      onSelect={onSelect}
      onSkip={onSkip}
      ariaPrefix="liked this paper"
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
  "Highlight anything else while you wait. Answers land under the passage they came from.",
  "Type your own question in the bar, or just press Ask and I'll explain the passage.",
  "Underlined words carry a definition. Hover or tap one.",
  "Answers read the paper's full text, then check it against what current web sources say.",
  "What you ask about teaches your librarian what to send you next.",
];

const TIP_ROTATE_MS = 6000;

/**
 * The wait, which is the whole point of the interleave.
 *
 * The loader comes first and never moves. Underneath it, one thing at a time:
 * the familiarity question if it is owed, then — only if the reader answered it
 * and the dig is still running — how much they liked the paper, then a tip. If
 * the answer lands first, none of it was ever in the way. Nothing here is
 * framed, and there is no rule down the side either: until there is an answer
 * there is no aside to hang one on.
 */
function DigWait({ familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity, ratingOffer, ratingValue, onRating, onSkipRating }: {
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
  ratingOffer: boolean;
  ratingValue?: number | null;
  onRating: (level: number) => void;
  onSkipRating: () => void;
}) {
  const [tip, setTip] = useState(0);
  const showTips = !familiarityOffer && !ratingOffer;

  useEffect(() => {
    if (!showTips) return;
    const id = setInterval(() => setTip(t => (t + 1) % DIG_WAIT_TIPS.length), TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, [showTips]);

  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* The stamp, centred in the column, not a spinner pinned to a line of
          text: this is the same wait as every other wait in the product and it
          should be the same object. Centring it also stops the eye reading it
          as a bullet on the paragraph above. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "10px 0 2px" }}>
        <PageLoader inline />
        <span style={{ ...BODY_STYLE, color: MUTED, textAlign: "center" }}>
          Re-reading the paper for that&hellip;
        </span>
      </div>

      {familiarityOffer ? (
        <FamiliarityScale
          topic={familiarityOffer}
          currentLevel={familiarityValue?.level}
          onSelect={onFamiliarity}
          onSkip={onSkipFamiliarity}
          lead="While I read: how"
        />
      ) : ratingOffer ? (
        <PaperRating value={ratingValue} onSelect={onRating} onSkip={onSkipRating} />
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <span style={LABEL_STYLE}>Tip</span>
          <span style={{ ...BODY_SM, color: DIM }}>{DIG_WAIT_TIPS[tip]}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Why the writing is pitched the way it is — a callout in the paper's own hue.
 *
 * It used to wear a mono "Pitched for you" eyebrow, which named the mechanism
 * rather than the fact and made a one-line disclosure look like a section. The
 * sentence already says what it is ("You rated yourself 3/5 on…"), so the label
 * is gone and the paper's wash carries the "this is an aside" signal instead.
 */
function PitchedForYouLine({ pitch, topic, currentLevel, hue, style, onSelect }: {
  pitch: PitchedForYou;
  topic: FamiliarityTopic;
  currentLevel: number;
  /** The paper's first wash hue — a blue paper gets a blue callout. */
  hue: string;
  style?: React.CSSProperties;
  onSelect: (level: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    // The tag hairline, not the structural 2px: this is one quiet line about
    // how the writing is pitched, and it must not read as a frame competing
    // with "Remember this".
    <div style={{ background: hue, border: BORDER_HAIR, padding: "12px 14px", margin: "0 0 18px", ...style }}>
      <button
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
      >
        <span style={{ ...BODY_SM, color: INK }}>
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
 * An answer, as a card in the rail.
 *
 * It used to be an indent behind a 2px rule directly under the beat, which had
 * two problems the reader named at once. It cut the read: the paragraph you were
 * halfway through moved down the page the moment an answer arrived. And folded,
 * it was a bare chevron hanging off a paragraph with nothing on it to say what
 * it was.
 *
 * So the answer leaves the column. Each one is a card in the rail wearing the
 * full frame and the one shadow, headed by **the passage it came from, filled in
 * the paper's own hue** — which is the part that makes this work at a distance.
 * You never have to hold in your head which highlight this card was, so it does
 * not need to sit next to the sentence to be findable.
 *
 * The tie to the prose is a numeral and it runs both ways: hover a card and its
 * sentence darkens in the text, hover a sentence and its card lifts, click
 * either to be taken to the other.
 */
function DigCard({
  thread, n, index, hue, streaming, error, onFollowUp, defaultOpen, linked, onLink, onJumpToPassage,
  pitch, pitchTopic, familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity,
  ratingOffer, ratingValue, onRating, onSkipRating,
}: {
  thread: ReadingThread;
  /** What it wears in the prose. */
  n: number;
  /** Position in the rail, for the aria label only. */
  index: number;
  hue: string;
  streaming: boolean;
  error?: string | null;
  onFollowUp: (question: string) => void;
  /** Fresh answers open; ones rehydrated on load stay folded. */
  defaultOpen: boolean;
  linked: boolean;
  onLink: (linked: boolean) => void;
  onJumpToPassage: () => void;
  pitch: PitchedForYou | null;
  pitchTopic: FamiliarityTopic | null;
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
  ratingOffer: boolean;
  ratingValue?: number | null;
  onRating: (level: number) => void;
  onSkipRating: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const empty = thread.turns.every(turn => !turn.answer);

  return (
    <div
      data-card-id={thread.id}
      onMouseEnter={() => onLink(true)}
      onMouseLeave={() => onLink(false)}
      style={{
        border: BORDER, background: SURFACE, boxShadow: SHADOW,
        transform: linked ? "translate(-2px, -2px)" : "none",
        transition: "transform 120ms",
      }}
    >
      <div style={{ background: hue, borderBottom: open ? BORDER : "none", padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={onJumpToPassage}
          title="Take me back to this sentence"
          aria-label={`Go back to passage ${n} in the paper`}
          style={{
            ...BODY_SM, fontWeight: 600, lineHeight: "18px",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, flexShrink: 0, border: BORDER_HAIR,
            background: INK, color: SURFACE, cursor: "pointer", padding: 0,
          }}
        >
          {n}
        </button>
        {/* The passage, not the question. The passage is what you recognise.
            Folded it is clamped to two lines, because a card you have put away
            should be the size of a label; open, it is the whole sentence. */}
        <span
          style={{
            ...BODY_SM, flex: 1, minWidth: 0,
            ...(open ? {} : {
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }),
          }}
        >
          {thread.selection}
        </span>
        <button
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label={open ? `Fold answer ${index + 1}` : `Unfold answer ${index + 1}`}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
        >
          <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>
      </div>

      {open && (
        <div style={{ padding: "12px 14px 14px" }}>
          {/* The disclosure about how the writing is pitched, above the answer
              rather than inside it. It waits for the answer: the wait is a
              loader and one question, and this is neither. */}
          {pitch && pitchTopic && familiarityValue && !empty && (
            <PitchedForYouLine
              pitch={pitch}
              topic={pitchTopic}
              currentLevel={familiarityValue.level}
              hue={hue}
              onSelect={onFamiliarity}
            />
          )}

          {empty && streaming ? (
            <DigWait
              familiarityOffer={familiarityOffer}
              familiarityValue={familiarityValue}
              onFamiliarity={onFamiliarity}
              onSkipFamiliarity={onSkipFamiliarity}
              ratingOffer={ratingOffer}
              ratingValue={ratingValue}
              onRating={onRating}
              onSkipRating={onSkipRating}
            />
          ) : (
            <>
              {thread.turns.map((turn, i) => (
                <div key={turn.id} style={{ borderTop: i === 0 ? "none" : HAIRLINE, paddingTop: i === 0 ? 0 : 14, marginTop: i === 0 ? 0 : 14 }}>
                  <p style={{ ...BODY_SM, fontWeight: 600, margin: "0 0 8px" }}>{turn.question}</p>
                  <p style={{ ...BODY_SM, margin: 0 }}>
                    {turn.answer}
                    {streaming && i === thread.turns.length - 1 && !turn.answer && (
                      <span style={{ color: MUTED, fontStyle: "italic" }}>Looking it up&hellip;</span>
                    )}
                  </p>
                </div>
              ))}

              {error && <p style={{ ...BODY_SM, color: ACID_PINK, margin: "12px 0 0" }}>{error}</p>}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
            </>
          )}
        </div>
      )}
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
 * The recap of every hard word. The chips in the prose define each term where
 * you meet it; this catches the ones the companion flagged but never used in
 * its own copy, and gives you somewhere to look back to.
 *
 * It lives in the rail, not in the column. In series with the walkthrough it
 * read as a sixth beat of the read and put a closed drawer between "Remember
 * this" and what has happened since. A glossary is a thing you look across at.
 * Closed by default for the same reason: reference, not read.
 */
function Glossary({ terms }: { terms: Jargon[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: BORDER, background: SURFACE, padding: "14px 16px" }}>
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
        // A 150px term column left the definitions in a 200px gutter. In the
        // rail the term leads and the definition sits under it.
        <dl style={{ margin: "12px 0 0", maxHeight: 320, overflowY: "auto" }}>
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
function AskThread({ threads, starters, headerWash, hue, quote, onClearQuote, onAsk, onFollowUp, streaming, failed, familiarityValue, onFamiliarity }: {
  threads: ReadingThread[];
  starters: string[];
  headerWash: React.CSSProperties;
  /** The paper's first wash hue — what the pitch callout is filled with. */
  hue: string;
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
              Compares the paper with what current web sources say.
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
                    hue={hue}
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
  // The card's first wash hue — what a dug passage wears in the prose, and what
  // the "Remember this" frame is washed in. Never GOLD: that is a line colour,
  // and behind a word it is too dark to read the word through.
  const hue = foundational ? foundationalSlots()[0] : washSlots(index)[0];
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

  // The one live tie between a passage and its card. Whichever one you are
  // pointing at, both respond: the sentence takes an underline, the card lifts.
  const [linked, setLinked] = useState<string | null>(null);

  const proseRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [pick, setPick, nativeSelectionLive] = useSelectionPick(proseRef, !companionPending);

  const jumpToCard = useCallback((threadId: string) => {
    setLinked(threadId);
    railRef.current
      ?.querySelector(`[data-card-id="${threadId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const jumpToPassage = useCallback((threadId: string) => {
    setLinked(threadId);
    proseRef.current
      ?.querySelector(`[data-mark-id="${threadId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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
    if (streamingTurn) return;
    setAskError(null);
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

  // A new answer lands at the bottom of a stack that may already be taller than
  // the rail, so bring its card into view. Only for an answer started in this
  // session: `lastDigThreadId` is set from the stream's own start event, never
  // from rehydrating a paper you asked about last week.
  useEffect(() => {
    if (!lastDigThreadId) return;
    railRef.current
      ?.querySelector(`[data-card-id="${lastDigThreadId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lastDigThreadId]);

  const dig = useCallback((text: string, section: SectionKey) => {
    window.getSelection()?.removeAllRanges();
    setPick(null);
    if (!tipSeen) { markNuxSeen(READING_TIP_KEY); setTipSeen(true); }
    // The interleave lives in the wait, and the reader is allowed one question a
    // day across the whole product. Reserving it the instant a dig starts would
    // spend that question on a two-second wait nobody read. Make the dig prove
    // it is slow first.
    if (offerTimer.current) clearTimeout(offerTimer.current);
    offerTimer.current = setTimeout(() => {
      if (streamingRef.current) reserveFamiliarityOffer();
    }, OFFER_AFTER_MS);
    ask({ selection: text, sectionKey: section });
  }, [ask, reserveFamiliarityOffer, setPick, tipSeen]);

  /** A typed question about a passage. Same landing place as a dig. */
  const askHere = useCallback((question: string, text: string, section: SectionKey) => {
    window.getSelection()?.removeAllRanges();
    setPick(null);
    if (!tipSeen) { markNuxSeen(READING_TIP_KEY); setTipSeen(true); }
    // The interleave lives in the wait, and the reader is allowed one question a
    // day across the whole product. Reserving it the instant a dig starts would
    // spend that question on a two-second wait nobody read. Make the dig prove
    // it is slow first.
    if (offerTimer.current) clearTimeout(offerTimer.current);
    offerTimer.current = setTimeout(() => {
      if (streamingRef.current) reserveFamiliarityOffer();
    }, OFFER_AFTER_MS);
    ask({ question, selection: text, sectionKey: section });
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

  // Every answered passage in the paper, in the order it was asked. This is the
  // rail's list and the prose's numbering, and they are the same list, which is
  // the whole point: the numeral in the text and the numeral on the card are
  // the same number because they come from one place.
  const answeredPassages = digThreads(threads);
  const numberOf = new Map(answeredPassages.map((t, i) => [t.id, i + 1]));

  const marksFor = (key: SectionKey): BeatMark[] => [
    // The live selection first, so re-highlighting a passage you already asked
    // about shows it as the current selection rather than as an old one.
    ...(pick && pick.section === key && !nativeSelectionLive
      ? [{ text: pick.text, fill: hue }]
      : []),
    ...digsForSection(threads, key)
      .map(t => ({
        id: t.id,
        text: t.selection ?? "",
        fill: hue,
        n: numberOf.get(t.id),
        active: linked === t.id,
        onClick: () => jumpToCard(t.id),
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

  // The rail's stack. One card per answered passage, newest last, so the column
  // reads in the order you asked rather than in the order the paper is written.
  const cards = answeredPassages.map((thread, i) => (
    <DigCard
      key={thread.id}
      thread={thread}
      n={i + 1}
      index={i}
      hue={hue}
      streaming={thread.turns.some(t => t.id === streamingTurn)}
      error={thread.turns.some(t => t.id === streamingTurn) ? null : askError}
      onFollowUp={q => ask({ question: q, threadId: thread.id })}
      defaultOpen={freshThreads.current.has(thread.id)}
      linked={linked === thread.id}
      onLink={on => setLinked(on ? thread.id : null)}
      onJumpToPassage={() => jumpToPassage(thread.id)}
      pitch={thread.turns.find(turn => turn.pitch)?.pitch ?? null}
      pitchTopic={companion?.topic ?? null}
      familiarityOffer={thread.id === lastDigThreadId ? familiarityOffer : null}
      familiarityValue={activeFamiliarity}
      onFamiliarity={setFamiliarity}
      onSkipFamiliarity={skipFamiliarity}
      // Second in the queue, and only in this answer's own wait: never before the
      // familiarity question has been answered or waved off, never twice, never
      // once they have told us.
      ratingOffer={thread.id === lastDigThreadId && !familiarityOffer && rating === null && !ratingDeclined}
      ratingValue={rating}
      onRating={submitRating}
      onSkipRating={skipRating}
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
              hue={hue}
              onSelect={setFamiliarity}
            />
          )}

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
        <aside ref={railRef} className="reading-aside" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* The answers come first, above the reference material: they are the
              only part of this column the reader made themselves. */}
          {cards}
          {/* The glossary is a reference, not a beat. Sitting in series with the
              walkthrough it read as a sixth section of the read, and put a
              closed drawer between "Remember this" and what has happened since.
              In the rail it is a thing you look across at, which is what a
              glossary is for. */}
          {glossary.length > 0 && <Glossary terms={glossary} />}
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
              hue={hue}
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
          onAsk={question => askHere(question, pick.text, pick.section)}
        />
      )}

      <style>{`
        .reading-shell { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 56px; align-items: start; }
        /* The rail holds position while the walkthrough scrolls past it, and it
           is ONE scroll region: the answer cards, the glossary and the thread
           all move together inside it. It used to be the thread alone that
           scrolled, in its own frame, which worked only while nothing sat above
           it. Answer cards sit above it now and would have pushed it off the
           bottom of the screen by the third question.
           The gutter is padding, not margin: the cards carry a 5px shadow and a
           2px offset on hover, and an overflow container clips both. */
        .reading-aside {
          position: sticky; top: 8px;
          max-height: calc(100vh - 24px);
          overflow-y: auto;
          overflow-x: hidden;
          padding: 4px 8px 8px 4px;
          margin: -4px -8px -8px -4px;
        }
        .reading-ask { max-height: none; }
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
          /* Below the read, the rail is just more page: no sticky, no scroll of
             its own, and nothing to clip the shadows. */
          .reading-aside {
            position: static; max-height: none; overflow: visible;
            padding: 0; margin: 56px 0 0;
          }
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

"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Loader2, X } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { PaperCard, paperByline, READING_BODY } from "@/components/paper-card";
import { READING_TIP_KEY, markNuxSeen, nuxSeen } from "@/lib/nux";
import {
  type FamiliarityTopic,
  type FamiliarityValue,
  type PitchedForYou,
} from "@/lib/familiarity";
import {
  DEFAULT_QUESTION, digThreads, digsForSection, groupThreads,
  type ReadingThread, type SectionKey, type ThreadTurn,
} from "@/lib/reading-thread";
import {
  ACID_PINK, ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, MUTED, PageLoader, SHADOW, SURFACE, TextInput,
  foundationalSlots, washSlots,
} from "@/components/design-system";

type Jargon = {
  term: string;
  def: string;
  tier?: "basic" | "working" | "deep";
  analogy?: string;
  /** The reader asked for this one. It is never filtered out again. */
  added?: boolean;
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
  id?: string;
  active?: boolean;
  onClick?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  /**
   * What hangs off the end of the marked words: the numbered square, and the
   * question or answer when it is open. It is rendered in the flow immediately
   * after the passage, which is why a beat is a `div` and not a `p` — a block
   * cannot legally sit inside a paragraph, and this one has to sit inside the
   * sentence it belongs to.
   */
  after?: React.ReactNode;
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
    if (r.mark.after) out.push(<React.Fragment key={key++}>{r.mark.after}</React.Fragment>);
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
    // A word the reader asked to keep is kept. Tier filtering is about what the
    // companion volunteers; this one was requested, and an expert asking what a
    // basic term means in THIS paper is a completely ordinary thing to do.
    if (term.added) return true;
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
      const released = event.type === "mouseup" || event.type === "touchend";
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
    // Touch, where it works: a phone that lets the reader drag the selection
    // handles fires this at the end of it. Where it does not, the per-beat
    // affordance is the path (see `DigThisBeat`), which is why that exists.
    document.addEventListener("touchend", read);
    return () => {
      document.removeEventListener("mouseup", read);
      document.removeEventListener("keyup", read);
      document.removeEventListener("touchend", read);
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
 * What the wait says while it is waiting.
 *
 * It used to be one fixed line with a mono "Tip" row under it naming features,
 * which is the product using the reader's dead air to advertise to them. These
 * say what is actually happening instead, and they are allowed to be funny
 * about it: the honest content of this pause is that something is reading a
 * paper carefully, and that is a slightly absurd thing to be doing on request.
 *
 * Rules for adding one. It must be TRUE of this moment (the model is reading the
 * paper's own text and checking it against the web), under about eight words so
 * it does not wrap in a 380px margin, and dry rather than cute. No exclamation
 * marks, no "hang tight", nothing that congratulates the reader for waiting.
 *
 * The first line is never a joke: whatever else this is, the reader is owed a
 * plain statement of what is happening before the voice starts.
 */
const WAIT_LINES = [
  "Reading the paper for that.",
  "Finding the bit where they actually say it.",
  "Separating what they showed from what they claimed.",
  "Checking whether the caveat is a caveat or a hedge.",
  "Looking for the number under the adjective.",
  "Asking what it would take for this to be wrong.",
  "Rereading the paragraph that seemed clear a moment ago.",
  "Working out whether anyone has replicated this.",
];

const LINE_ROTATE_MS = 3200;

/**
 * The wait: the stamp, and one line at a time.
 *
 * The interleaved question used to live in here and die with it, which meant a
 * question you were half a second too slow to answer vanished under the answer
 * you were waiting for. The question is its own thing now and it outlives the
 * wait (see `InterleaveQuestion`), so this is only the wait.
 *
 * Nothing here is framed. A box makes a two-second wait look like a task.
 */
function DigWait() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLine(n => (n + 1) % WAIT_LINES.length), LINE_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    // The stamp, centred, not a spinner pinned to a line of text: this is the
    // same wait as every other wait in the product and it should be the same
    // object. The line under it has a minimum height so a short line following
    // a long one does not shift the answer that is about to arrive.
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "10px 0 2px" }}>
      <PageLoader inline />
      <span style={{ ...BODY_SM, color: MUTED, textAlign: "center", minHeight: 40 }}>
        {WAIT_LINES[line]}
      </span>
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
function InterleaveQuestion({ familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity, waiting }: {
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
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
      {/* A div, not a p: an answer opens inside the sentence it belongs to, and
          a paragraph cannot contain a block. */}
      <div data-section={sectionKey} style={{ ...READING_BODY }}>{children}</div>
    </section>
  );
}

// Follow-up work reads as cards, because it is papers and there is one card for
// a paper in this product. It used to be a hairline-separated list, which was a
// second way of drawing the same object.
function HomeworkCard({ item, sourcePaperId, index }: { item: HomeworkItem; sourcePaperId: string; index: number }) {
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

  // A citing work is not in our papers table yet, so it is shaped into the card
  // rather than fetched as one. Everything the compact card reads is here; what
  // is missing (summary, keywords) is missing because OpenAlex did not give it.
  const asPaper: PaperItem = {
    id: item.openAlexId || item.url || item.title,
    title: item.title,
    summary: null,
    source: "semantic_scholar",
    sourceUrl: item.url,
    keywords: [],
    authors: item.authors ?? [],
    year: item.year,
    abstract: item.abstract || null,
    category: "recent",
  };

  return (
    <PaperCard
      paper={asPaper}
      index={index}
      size="compact"
      // No `loggedIn`: the card's own bookmark saves a paper we already have a
      // row for, and this one has to go through save-external. The save lives
      // in the footnote instead, which is the one place a compact card lets a
      // caller put its own control.
      onOpen={p => { if (p.sourceUrl) window.open(p.sourceUrl, "_blank", "noopener,noreferrer"); }}
      footnote={
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...BODY_SM, color: DIM, flex: 1, minWidth: 0 }}>
            {item.citationCount > 0 ? `${item.citationCount} citations` : "Cites this paper"}
          </span>
          <button
            onClick={save}
            title={saved ? "In your library" : "Save to your library"}
            style={{ ...BODY_SM, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0, flexShrink: 0, color: INK }}
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : <Bookmark size={14} fill={saved ? INK : "none"} />}
            {saved ? "Saved" : "Save"}
          </button>
        </span>
      }
    />
  );
}

/**
 * The square. A question, tagged onto the passage it came from.
 *
 * Closed, a question is one ink square with a number in it, sitting at the end
 * of the coloured passage like a footnote marker. That is the resting state of
 * this whole feature: reading a paper you have asked four things about is
 * reading the paper, with four small squares in it.
 */
function AnswerSquare({ n, open, label, onToggle }: {
  n: number;
  open: boolean;
  label?: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? `Close answer ${n}` : `Open answer ${n}`}
      title={open ? "Close" : label}
      style={{
        ...BODY_SM, fontWeight: 600, lineHeight: "16px",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, padding: 0, margin: "0 1px 0 3px",
        verticalAlign: "text-top", flexShrink: 0,
        border: "none", background: open ? SURFACE : INK, color: open ? INK : SURFACE,
        boxShadow: open ? `inset 0 0 0 2px ${INK}` : "none",
        cursor: "pointer",
        // Furniture, not text: without this it lands inside the next selection
        // that crosses it and the passage stops matching the beat's own words.
        userSelect: "none", WebkitUserSelect: "none",
      }}
    >
      {n}
    </button>
  );
}

/**
 * The answer itself. It opens beside its passage in the margin on a wide screen
 * and under it in the flow on a narrow one, and it is the same component both
 * times — the only difference is which column it is rendered into.
 */
function AnswerPanel({ thread, n, streaming, error, active, onActivate, onClose, composer, familiarityOffer, familiarityValue, onFamiliarity, onSkipFamiliarity, owed }: {
  thread: ReadingThread;
  /** The same number as the square in the paper. Out here it is the only thing
      saying which passage this answer belongs to. */
  n: number;
  streaming: boolean;
  error?: string | null;
  /** The one text bar is in here. Tapping the answer is what puts it here. */
  active: boolean;
  onActivate: () => void;
  /** Closing from here, rather than hunting for the square back in the text. */
  onClose: () => void;
  composer: React.ReactNode;
  familiarityOffer?: FamiliarityTopic | null;
  familiarityValue?: FamiliarityValue | null;
  onFamiliarity: (level: number) => void;
  onSkipFamiliarity: () => void;
  /** The interleave owes a question, and it belongs to this one. */
  owed: boolean;
}) {
  const empty = thread.turns.every(turn => !turn.answer);

  return (
    <div
      onMouseDown={onActivate}
      style={{
        borderLeft: BORDER,
        paddingLeft: 16,
        cursor: active ? undefined : "pointer",
      }}
    >
      {thread.turns.map((turn, i) => (
        <div key={turn.id} style={{ marginTop: i === 0 ? 0 : 16 }}>
          {/* The close sits on the first question rather than in a header bar of
              its own: an answer in the margin is a long way from the square that
              opened it, and hunting back through the paragraph for an 18px box
              is not a way to put something down. */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            {i === 0 && (
              <span
                aria-hidden
                style={{
                  ...BODY_SM, fontWeight: 600, lineHeight: "16px",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, height: 18, flexShrink: 0, marginTop: 2,
                  background: INK, color: SURFACE,
                }}
              >
                {n}
              </span>
            )}
            <p style={{ ...BODY_SM, fontWeight: 600, margin: "0 0 6px", flex: 1, minWidth: 0 }}>{turn.question}</p>
            {i === 0 && (
              <button
                onClick={onClose}
                aria-label="Close this answer"
                title="Close (or press Escape)"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: MUTED, display: "flex", flexShrink: 0 }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          {turn.answer
            ? <p style={{ ...BODY_STYLE, margin: 0 }}>{turn.answer}</p>
            : <DigWait />}
        </div>
      ))}

      {/* The interleave's one question: no rule above it, centred in its own
          block. It is a question being asked of the reader, not another section
          of the answer. */}
      {owed && (
        <div style={{ marginTop: 18 }}>
          <InterleaveQuestion
            familiarityOffer={familiarityOffer}
            familiarityValue={familiarityValue}
            onFamiliarity={onFamiliarity}
            onSkipFamiliarity={onSkipFamiliarity}
            waiting={empty && streaming}
          />
        </div>
      )}

      {error && <p style={{ ...BODY_SM, color: ACID_PINK, margin: "12px 0 0" }}>{error}</p>}

      {/* The bar, when this is the one you tapped. Otherwise there is nothing
          here to type into, which is the point: one bar on the page. */}
      {active && !empty && <div style={{ marginTop: 14 }}>{composer}</div>}
    </div>
  );
}

/**
 * The one text bar. There is never a second one on the page.
 *
 * It is not docked anywhere: it *moves*. Highlight a passage and the bar is
 * under that passage; tap an answer you opened earlier and the bar goes and
 * sits in that answer; touch neither and it waits at the foot of the read under
 * "Ask this paper". Whatever it is currently inside is what the next thing you
 * type is about, which is why it does not need to say so.
 *
 * Before this there were three fields on one page: one hanging off the fresh
 * highlight, one in every open answer, and one at the foot. A reader looking at
 * two identical inputs stacked on each other has to work out which of them means
 * what, and the answer was "whichever one you are nearest".
 */
function Composer({ placeholder, onSubmit, allowEmpty = false, onDefine, onCancel, cancelLabel }: {
  placeholder: string;
  onSubmit: (question: string) => void;
  /** With a passage held, an empty field still asks `DEFAULT_QUESTION`. */
  allowEmpty?: boolean;
  /** Offered only for something term-shaped. See `looksLikeTerm`. */
  onDefine?: (() => void) | null;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // The bar arriving is a request to type. Not on a phone: focusing an input
  // there throws the keyboard over the page before the reader has decided to
  // say anything.
  useEffect(() => {
    if (window.matchMedia("(max-width: 720px)").matches) return;
    box.current?.querySelector("input")?.focus();
  }, []);

  const typed = draft.trim();
  const submit = () => {
    if (!typed && !allowEmpty) return;
    onSubmit(typed || DEFAULT_QUESTION);
    setDraft("");
  };

  return (
    <div ref={box}>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput
          value={draft}
          onChange={setDraft}
          onKeyDown={e => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape" && onCancel) onCancel();
          }}
          placeholder={placeholder}
          ariaLabel={placeholder}
        />
        <ActionButton
          onClick={submit}
          variant="primary"
          shadow={false}
          disabled={!typed && !allowEmpty}
          style={{ flexShrink: 0 }}
        >
          Ask
        </ActionButton>
      </div>
      {(onDefine || onCancel) && (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {/* The second verb, and only when it means something: a word is a
              thing you look up and keep, a passage is a thing you ask about. */}
          {onDefine && (
            <button
              onClick={onDefine}
              style={{ ...BODY_SM, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", color: INK }}
            >
              + Glossary
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              style={{ ...BODY_SM, background: "none", border: "none", padding: 0, cursor: "pointer", color: DIM }}
            >
              {cancelLabel ?? "Never mind"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Is there room beside the read for an answer to open into? */
function useWideEnough() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MARGIN_BREAKPOINT);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

/** Below this there is no margin to open into, so answers open in the flow. */
const MARGIN_BREAKPOINT = "(min-width: 1220px)";

/** The held passage's mark, so the composer can be lined up with it. */
const HELD_ID = "held-passage";

/**
 * Where each open thing sits in the margin: level with the line it belongs to,
 * pushed down only far enough to clear whatever is above it.
 *
 * Measured after paint and written back only when a number actually changed, so
 * it settles in one pass rather than cascading.
 */
function useMarginTops(
  proseRef: React.RefObject<HTMLDivElement | null>,
  ids: string[],
  heights: React.RefObject<Record<string, HTMLDivElement | null>>,
) {
  const [tops, setTops] = useState<Record<string, number>>({});
  const [generation, setGeneration] = useState(0);
  const key = ids.join(",");

  // Anything that can move a line under the mark: the window resizing, a font
  // arriving, the container finishing its widen. Without this the tops are
  // whatever they were at the instant the answer opened, which is the wrong
  // moment by definition — the layout is still changing then.
  useEffect(() => {
    const el = proseRef.current;
    if (!el) return;
    const bump = () => setGeneration(g => g + 1);
    const observer = new ResizeObserver(bump);
    observer.observe(el);
    window.addEventListener("resize", bump);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, [proseRef]);

  useLayoutEffect(() => {
    const box = proseRef.current?.getBoundingClientRect();
    if (!box) return;
    const measured = ids
      .map(id => {
        const el = proseRef.current?.querySelector(`[data-mark-id="${id}"]`);
        if (!el) return null;
        // The FIRST line of the passage, not the box around all of its lines:
        // a passage that wraps has a bounding box starting at its first line
        // anyway, but a passage whose first fragment ends a line has client
        // rects that start further left, and the top is what matters here.
        const rects = Array.from(el.getClientRects()).filter(r => r.height > 0);
        const top = (rects[0]?.top ?? el.getBoundingClientRect().top) - box.top;
        return { id, want: top };
      })
      .filter((m): m is { id: string; want: number } => !!m)
      .sort((a, b) => a.want - b.want);

    const next: Record<string, number> = {};
    let floor = 0;
    for (const m of measured) {
      const top = Math.max(m.want, floor);
      next[m.id] = top;
      floor = top + (heights.current?.[m.id]?.offsetHeight ?? 120) + 20;
    }
    const changed = Object.keys(next).length !== Object.keys(tops).length
      || Object.entries(next).some(([id, v]) => Math.abs((tops[id] ?? -1) - v) > 0.5);
    // Measuring rendered geometry and writing it back is what a layout effect is
    // for; the guard is what stops it cascading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (changed) setTops(next);
    // `key` stands in for the id list, which is a new array every render.
  }, [key, tops, ids, proseRef, heights, generation]);

  return tops;
}

/**
 * The recap of every hard word, folded, at the foot of the read.
 *
 * The chips in the prose define each term where you meet it; this catches the
 * ones the companion flagged but never used, holds the ones the reader added
 * themselves, and gives you somewhere to look a word back up. Reference, not
 * read, so it is closed until asked for.
 */
function Glossary({ terms, pending }: { terms: Jargon[]; pending: string[] }) {
  const [open, setOpen] = useState(false);
  const count = terms.length + pending.length;
  return (
    <div style={{ border: BORDER, background: SURFACE, padding: "14px 16px", marginTop: 32 }}>
      <button
        onClick={() => setOpen(v => !v)}
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
        <dl style={{ margin: "12px 0 0" }}>
          {pending.map(term => (
            <div key={`pending-${term}`} style={{ padding: "10px 0", borderTop: HAIRLINE }}>
              <dt style={{ ...BODY_STYLE, fontWeight: 600 }}>{term}</dt>
              <dd style={{ ...BODY_SM, color: MUTED, fontStyle: "italic", margin: "2px 0 0" }}>Looking it up&hellip;</dd>
            </div>
          ))}
          {terms.map(g => (
            <div key={g.term} style={{ padding: "10px 0", borderTop: HAIRLINE }}>
              <dt style={{ ...BODY_STYLE, fontWeight: 600 }}>{g.term}</dt>
              <dd style={{ ...BODY_SM, color: DIM, margin: "2px 0 0" }}>{g.def}</dd>
            </div>
          ))}
        </dl>
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
  // Folded until it has something to say. The rail is beside a paper someone
  // came here to read, and an open panel with three suggested questions in it
  // is the product asking for attention before the reader has spent any. It
  // opens itself the moment a question is asked, from anywhere.
  // Which questions are unfolded. A fresh one opens as it arrives; one
  // rehydrated on load stays a square, so re-opening a paper you asked four
  // things about shows you the paper rather than your own back-catalogue.
  const [openTags, setOpenTags] = useState<Set<string>>(new Set());
  const [queued, setQueued] = useState(0);

  const toggleTag = useCallback((id: string) => {
    setOpenTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Closing the one the bar was in sends it back to the foot.
        setActive(a => (a.kind === "thread" && a.id === id ? { kind: "none" } : a));
      } else {
        next.add(id);
        setActive({ kind: "thread", id });
      }
      return next;
    });
  }, []);

  const proseRef = useRef<HTMLDivElement>(null);
  // One ref per thing in the margin, so its height is known when the next thing
  // below it is placed.
  const marginRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wide = useWideEnough();

  // The passage the reader is holding: taken on release, and it stays until it
  // is asked about or dropped. There is no tie to maintain between a passage
  // and its answer any more, because the answer opens on the passage.
  const [held, setHeld] = useState<Pick | null>(null);
  /**
   * Where the one text bar currently is, and whether there is one at all.
   *
   * `none` is the resting state: a paper you are reading has no field on it.
   * A highlight takes the bar to that passage, tapping an answer you opened
   * earlier takes it into that answer, and Escape puts it away again. "Ask this
   * paper" used to hold it at the foot of the read as a general-purpose field;
   * that section is gone, and with it the only question on this page that was
   * not about a passage.
   */
  const [active, setActive] = useState<{ kind: "none" } | { kind: "held" } | { kind: "thread"; id: string }>({ kind: "none" });

  const nativeSelectionLive = useSelectionPick(proseRef, !companionPending, captured => {
    setHeld(captured);
    setActive({ kind: "held" });
  });

  useEffect(() => { setTipSeen(nuxSeen(READING_TIP_KEY)); }, []);

  // Escape puts everything down: the question you were about to ask and every
  // answer left open. The margin goes with them, so one key clears the page
  // back to the paper.
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setHeld(null);
      setActive({ kind: "none" });
      setOpenTags(prev => (prev.size ? new Set() : prev));
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

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
    // Asked while another answer is being written: queue it rather than drop
    // it. This was the other half of "highlighting stopped working" — the guard
    // here was `if (streamingTurn) return`, so a second question during a
    // five-second answer did nothing at all, silently, with the passage already
    // thrown away.
    if (busy.current) {
      queuedAsks.current.push(payload);
      setQueued(queuedAsks.current.length);
      return;
    }
    busy.current = true;
    setAskError(null);
    const handlers = {
      start: (e: StartEvent) => {
        setStreamingTurn(e.id);
        streamingRef.current = e.id;
        if (e.selection) {
          // The question has started, so the passage is no longer being held.
          setHeld(null);
          freshThreads.current.add(e.threadId);
          setLastDigThreadId(e.threadId);
          // A question you just asked opens where you asked it, and takes the
          // bar with it, so a follow-up is typed in the answer you are reading.
          setOpenTags(prev => new Set(prev).add(e.threadId));
          setActive({ kind: "thread", id: e.threadId });
        }
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


  useEffect(() => () => { if (offerTimer.current) clearTimeout(offerTimer.current); }, []);

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
            added: true,
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
    // The passage stays held until the answer actually starts. If this one is
    // queued behind an answer already being written, that is the only thing on
    // screen that can say so.
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

  // Every passage asked about, anywhere in the paper, in the order it was asked.
  // The square's number comes from here, so it counts questions rather than
  // position in the beat: the first thing you asked is 1 wherever it is.
  const asked = digThreads(threads);
  const numberOf = new Map(asked.map((t, i) => [t.id, i + 1]));

  const panelFor = (t: ReadingThread) => (
    <AnswerPanel
      thread={t}
      n={numberOf.get(t.id) ?? 1}
      streaming={t.turns.some(turn => turn.id === streamingTurn)}
      error={t.turns.some(turn => turn.id === streamingTurn) ? null : askError}
      active={active.kind === "thread" && active.id === t.id}
      onActivate={() => setActive({ kind: "thread", id: t.id })}
      onClose={() => toggleTag(t.id)}
      composer={
        <Composer
          key={`thread-${t.id}`}
          placeholder="Keep going…"
          onSubmit={q => ask({ question: q, threadId: t.id })}
        />
      }
      familiarityOffer={t.id === lastDigThreadId ? familiarityOffer : null}
      familiarityValue={activeFamiliarity}
      onFamiliarity={setFamiliarity}
      onSkipFamiliarity={skipFamiliarity}
      // "How much did you like this paper?" used to queue up behind this one.
      // It is gone: two questions in the margin of one answer is a survey, and
      // the familiarity one at least changes what the reader is then handed.
      owed={t.id === lastDigThreadId && !!familiarityOffer}
    />
  );

  const heldComposer = held && active.kind === "held" ? (queued > 0 ? (
    <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>
      In line, right behind the one being written.
    </p>
  ) : (
    <Composer
      key={`held-${held.text}`}
      placeholder={`Ask about this, or just “${DEFAULT_QUESTION}”`}
      allowEmpty
      onSubmit={q => askHere(q, held.text, held.section)}
      onDefine={looksLikeTerm(held.text) ? () => define(held.text) : null}
      onCancel={() => { setHeld(null); setActive({ kind: "none" }); }}
    />
  )) : null;

  // What the margin is showing, top to bottom: the question being typed, and
  // every answer left open. Nothing else ever goes out there.
  const marginItems: { id: string; node: React.ReactNode }[] = wide
    ? [
        ...(heldComposer ? [{ id: HELD_ID, node: <div style={{ borderLeft: BORDER, paddingLeft: 16 }}>{heldComposer}</div> }] : []),
        ...asked.filter(t => openTags.has(t.id)).map(t => ({ id: t.id, node: panelFor(t) })),
      ]
    : [];
  const marginTops = useMarginTops(proseRef, marginItems.map(m => m.id), marginRefs);

  const marksFor = (key: SectionKey): BeatMark[] => [
    // The passage being held, with its question hanging off it.
    ...(held && held.section === key && !nativeSelectionLive
      ? [{
          id: HELD_ID,
          text: held.text,
          fill: hue,
          after: wide || !heldComposer
            ? null
            : <div style={{ borderLeft: BORDER, paddingLeft: 16, margin: "14px 0 18px" }}>{heldComposer}</div>,
        }]
      : []),
    ...digsForSection(threads, key)
      .map(t => ({
        id: t.id,
        text: t.selection ?? "",
        fill: hue,
        after: (
          <>
            <AnswerSquare
              n={numberOf.get(t.id) ?? 1}
              open={openTags.has(t.id)}
              label={t.turns[0]?.question}
              onToggle={() => toggleTag(t.id)}
            />
            {/* Wide, it opens in the margin beside the passage. Narrow, there is
                no margin to open into, so it opens in the flow underneath. */}
            {!wide && openTags.has(t.id) && (
              <div style={{ margin: "14px 0 18px" }}>{panelFor(t)}</div>
            )}
          </>
        ),
      }))
      .filter(m => m.text),
  ];
  const mark = (text: string, key: SectionKey) => annotateBeat(text, glossary, defined, marksFor(key));



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

      <div className={`reading-shell${wide && marginItems.length > 0 ? " has-margin" : ""}`}>
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
              <div data-section="gist" style={{ ...READING_BODY }}>{mark(companion.gist, "gist")}</div>
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
            </>
          )}
          {companion?.found && (
            <>
              <Beat heading="What they found" sectionKey="found">{mark(companion.found, "found")}</Beat>
            </>
          )}
          {companion?.caveats && (
            <>
              <Beat heading="Where it's shaky" sectionKey="caveats">{mark(companion.caveats, "caveats")}</Beat>
            </>
          )}

          {/* The one line worth keeping. Not a box: a beat like the others, with
              the sentence itself highlighted in the paper's own colour. The
              framed, washed, shadowed panel made the last thing on the page the
              loudest thing on it, and the page already closes on this line by
              being the last thing there. */}
          {companion?.remember && (
            <section style={{ borderTop: HAIRLINE, paddingTop: 22, marginTop: 22 }}>
              <h2 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>Remember this</h2>
              <div data-section="remember" style={{ ...READING_BODY }}>
                {/* The whole line is filled, so a passage highlighted inside it
                    cannot be filled again in the same colour and disappear. In
                    here a mark is the ink underline instead: `marksFor` is
                    rewritten for this one beat. */}
                <mark
                  style={{
                    background: hue,
                    color: INK,
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                  }}
                >
                  {annotateBeat(companion.remember, [], defined, marksFor("remember").map(m => ({
                    ...m, fill: "transparent", active: true,
                  })))}
                </mark>
              </div>
            </section>
          )}



          {(glossary.length > 0 || pendingTerms.length > 0) && (
            <Glossary terms={glossary} pending={pendingTerms} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ marginTop: 16 }}>
              {homework.map((item, i) => (
                <HomeworkCard
                  key={item.openAlexId || item.title}
                  item={item}
                  sourcePaperId={paper.id}
                  // Off the source paper's own slot, so the citing work beside a
                  // pink paper is not pink too.
                  index={index + i + 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* The margin. It does not exist until something opens into it: no
            reserved column of nothing, no empty rail. When it appears the page
            widens around it and the read stays the same measure, so the words
            never reflow, they only move. */}
        {wide && (
          <div className="reading-margin">
            {marginItems.map(item => (
              <div
                key={item.id}
                ref={el => { marginRefs.current[item.id] = el; }}
                style={{ position: "absolute", left: 0, right: 0, top: marginTops[item.id] ?? 0, transition: "top 160ms" }}
              >
                {item.node}
              </div>
            ))}
          </div>
        )}
      </div>


      <style>{`
        /* One centred column, and a margin that is not there until it is needed.
           A question opens beside the sentence it is about on a wide screen and
           under it on a narrow one; the two things the page accumulates that are
           not about a sentence (what you asked, and the words you kept) are
           sections at the foot of the read. Nothing is docked, floating or
           sticky, which is what makes this the same page on a phone. */
        .reading-shell {
          max-width: 720px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: stretch;
          transition: max-width 200ms ease;
        }
        /* The read is a FIXED 720px in both states, not a fraction of whatever
           the container currently is. When the margin opens, the container
           animates from 720 to 1140 and a fractional column would be squeezed
           to 300px mid-animation, reflowing every line in the paper and landing
           the answer level with a line that has since moved. Fixed, the column
           only slides sideways: no reflow, and the measured tops stay true. */
        .reading-shell.has-margin {
          max-width: 1140px;
          grid-template-columns: 720px 380px;
          gap: 40px;
        }
        .reading-margin { position: relative; }
        /* No ::selection override here. The drag wears the product's ordinary
           ink selection, and the paper's hue arrives on release, drawn by the
           page in useSelectionPick. */
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


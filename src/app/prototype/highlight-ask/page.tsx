"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { READING_BODY } from "@/components/paper-card";
import {
  BODY_SM, BODY_STYLE, BORDER, BORDER_HAIR, DIM, DISPLAY_LG, DISPLAY_SM, HAIRLINE, INK, MUTED,
  NavTab, PageLoader, RULE, SHADOW, SURFACE, washSlots,
} from "@/components/design-system";

/*
 * Highlight to ask, six ways. /prototype/highlight-ask
 *
 * Round two. Round one put six shapes up and two of them survived, for reasons
 * that are now the brief for everything on this page:
 *
 *   1. THE READ IS NEVER CUT. An answer may not push the paragraph you are
 *      reading down the page. Everything here happens beside the text, under
 *      it, or over it, never inside it.
 *   2. THE PASSAGE COMES BACK IN COLOUR. Every answer repeats the passage it
 *      came from, filled in the paper's own hue, so you never have to hold in
 *      your head which highlight this one was.
 *   3. UNOBTRUSIVE UNTIL WANTED. At rest, an answered passage is a coloured
 *      mark and at most a small numeral. Nothing shouts.
 *   4. FRIENDLY, NOT SYSTEM SOFTWARE. The thing answering you has read the
 *      paper and is sitting next to you. It is not a command palette.
 *
 * Two tabs are the survivors, tuned: LEDGER (the favourite) and PINNED CARDS.
 * Four are new and all obey the four rules above. The bottom-docked command bar
 * is gone.
 *
 * Everything is interactive against canned text. There is no model behind the
 * page: the answer is fixed and arrives on a timer, so the waits are real waits.
 */

/* ── The sample paper ────────────────────────────────────────────────────── */

const TITLE = "Sleep restriction and the consolidation of motor skill memory";

interface BeatSpec {
  key: string;
  heading: string | null;
  text: string;
}

const BEATS: BeatSpec[] = [
  {
    key: "gist",
    heading: null,
    text: "If you practise a movement and then sleep normally, you wake up better at it than when you stopped, and the gain arrives without any further practice. This study cut that night short to find out whether the improvement is built by the practice or by the sleep. It is built by the sleep, and the part that gets lost is not recoverable by sleeping in the following night.",
  },
  {
    key: "did",
    heading: "What they did",
    text: "Fifty-two adults learned a finger-tapping sequence to a fixed criterion in the evening. Half were sent home to sleep normally; half were held to four hours in the lab, woken at the same clock time, and both groups were retested at 24 and 72 hours. A third group practised in the morning and was retested after an equal amount of waking time, which separates the effect of sleep from the effect of twelve hours passing.",
  },
  {
    key: "found",
    heading: "What they found",
    text: "The rested group improved 19% overnight with no further practice. The restricted group improved 4%, statistically indistinguishable from the wake group's 3%. A second, full night of sleep did not recover the missing gain: at 72 hours the restricted group was still 13 points behind. Slow-wave sleep in the first two hours predicted the size of the gain better than total sleep time did, which is why four hours was not simply half as good.",
  },
  {
    key: "caveats",
    heading: "Where it's shaky",
    text: "Fifty-two people is small for a three-arm design, and one night of restriction is not the chronic pattern most people actually live in. Everyone was 19 to 26, and slow-wave sleep declines steeply with age, so the effect size here is probably a ceiling rather than an average. Finger tapping is also the friendliest possible motor task, and nothing here says a surgical or a musical skill behaves the same way.",
  },
];

const DEFAULT_QUESTION = "What does this mean?";

/** Long enough to see the loader, short enough to be an honest impression. */
const FIRST_TOKEN_MS = 1700;
const WORD_MS = 38;

function sampleAnswer(question: string, selection: string): string {
  const quoted = selection.length > 44 ? `${selection.slice(0, 44)}…` : selection;
  if (question === DEFAULT_QUESTION) {
    return `On "${quoted}": the claim turns on when the sleep happens, not how much of it there is. Slow-wave sleep is front-loaded into the first couple of hours after you fall asleep, and that window is where the paper's 19% gain was built, which is why a four hour night kept almost none of it. Outside work agrees on the direction and argues about the size: a 2026 replication found 11%, with an afternoon nap recovering roughly a third of what a short night cost. This page has no model behind it, so this text is fixed. It is here to show the shape of an answer, not the quality of one.`;
  }
  return `Short answer: mostly yes, with one caveat the paper itself flags. The effect is measured against a fixed practice criterion, so everyone started equally trained rather than equally practised, and that is doing more work in this result than the sample size is. Web sources checked alongside it push the same way, though the largest of them used a different task. This page has no model behind it, so this text is fixed. It is here to show the shape of an answer, not the quality of one.`;
}

/* ── The engine ──────────────────────────────────────────────────────────── */

interface Ask {
  id: string;
  n: number;
  section: string;
  selection: string;
  question: string;
  answer: string;
  streaming: boolean;
  open: boolean;
}

function useAsks() {
  const [asks, setAsks] = useState<Ask[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const running = timers.current;
    return () => running.forEach(clearTimeout);
  }, []);

  const start = useCallback((selection: string, section: string, question: string) => {
    seq.current += 1;
    const id = `ask-${seq.current}`;
    const n = seq.current;
    setAsks(prev => [...prev, { id, n, section, selection, question, answer: "", streaming: true, open: true }]);

    const words = sampleAnswer(question, selection).split(" ");
    let i = 0;
    const tick = () => {
      i += 3;
      setAsks(prev => prev.map(a => a.id === id
        ? { ...a, answer: words.slice(0, i).join(" "), streaming: i < words.length }
        : a));
      if (i < words.length) timers.current.push(setTimeout(tick, WORD_MS));
    };
    timers.current.push(setTimeout(tick, FIRST_TOKEN_MS));
    return id;
  }, []);

  const toggle = useCallback((id: string) => {
    setAsks(prev => prev.map(a => a.id === id ? { ...a, open: !a.open } : a));
  }, []);

  const openOnly = useCallback((id: string) => {
    setAsks(prev => prev.map(a => ({ ...a, open: a.id === id })));
  }, []);

  const forSection = useCallback((key: string) => asks.filter(a => a.section === key), [asks]);
  const streaming = asks.some(a => a.streaming);

  return { asks, start, toggle, openOnly, forSection, streaming };
}

/* ── Selecting ───────────────────────────────────────────────────────────── */

interface Pick {
  text: string;
  section: string;
  /** Viewport coordinates of the selection's first and last line. */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A word is not a passage. Below this the reader is probably just reading. */
const MIN_SELECTION = 16;

/**
 * Capture the passage on mouse-up and hand the highlight over.
 *
 * The browser draws the drag in ink, the way it does everywhere else in the
 * product. On release the range is collapsed on purpose and the page redraws the
 * same words in the paper's hue, so colour means "this is the passage the
 * question is about" rather than "something is selected".
 */
function usePick(scope: React.RefObject<HTMLElement | null>, onCapture?: (pick: Pick) => void) {
  const [pick, setPick] = useState<Pick | null>(null);
  // Held in a ref so the listener is bound once and still calls the current
  // handler. The variants that dock their composer take the passage this way
  // rather than watching `pick` in an effect.
  const capture = useRef(onCapture);
  useEffect(() => { capture.current = onCapture; });

  useEffect(() => {
    const read = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-ask-ui]")) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setPick(null);
      const text = sel.toString().trim();
      if (text.length < MIN_SELECTION) return setPick(null);

      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
      // Text inside an answer is not a passage of the paper.
      if (el?.closest("[data-ask-ui]")) return setPick(null);
      const host = el?.closest("[data-section]") as HTMLElement | null;
      if (!host || !scope.current?.contains(host)) return setPick(null);

      const rects = range.getClientRects();
      const first = rects[0];
      const last = rects[rects.length - 1];
      if (!first || !last) return setPick(null);

      const captured: Pick = {
        text,
        section: host.dataset.section as string,
        top: first.top,
        bottom: last.bottom,
        left: first.left,
        right: last.right,
      };
      setPick(captured);
      capture.current?.(captured);
      sel.removeAllRanges();
    };

    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setPick(null); };
    document.addEventListener("mouseup", read);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mouseup", read);
      document.removeEventListener("keydown", escape);
    };
  }, [scope]);

  return [pick, setPick] as const;
}

/* ── The prose ───────────────────────────────────────────────────────────── */

interface Mark {
  id: string;
  text: string;
  fill: string;
  /** A stronger edge, for the mark whose answer is being pointed at. */
  active?: boolean;
  flash?: boolean;
  className?: string;
  title?: string;
  onClick?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  /** Anything that follows the marked words. A numeral, usually. */
  trailing?: React.ReactNode;
}

function annotate(text: string, marks: Mark[]): React.ReactNode[] {
  const ranges: { start: number; end: number; mark: Mark }[] = [];
  for (const mark of marks) {
    const sel = mark.text.trim();
    if (!sel) continue;
    const i = text.indexOf(sel);
    if (i < 0) continue;
    const end = i + sel.length;
    if (ranges.some(r => i < r.end && end > r.start)) continue;
    ranges.push({ start: i, end, mark });
  }
  if (!ranges.length) return [text];
  ranges.sort((a, b) => a.start - b.start);

  const out: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const r of ranges) {
    if (r.start > cursor) out.push(<React.Fragment key={key++}>{text.slice(cursor, r.start)}</React.Fragment>);
    out.push(
      <mark
        key={r.mark.id}
        data-mark-id={r.mark.id}
        className={[r.mark.flash ? "proto-flash" : "", r.mark.className ?? ""].filter(Boolean).join(" ") || undefined}
        title={r.mark.title}
        onClick={r.mark.onClick}
        onMouseEnter={r.mark.onEnter}
        onMouseLeave={r.mark.onLeave}
        style={{
          background: r.mark.fill,
          color: INK,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          cursor: r.mark.onClick ? "pointer" : undefined,
          boxShadow: r.mark.active ? `0 2px 0 0 ${INK}` : undefined,
        }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    if (r.mark.trailing) out.push(<React.Fragment key={key++}>{r.mark.trailing}</React.Fragment>);
    cursor = r.end;
  }
  if (cursor < text.length) out.push(<React.Fragment key={key++}>{text.slice(cursor)}</React.Fragment>);
  return out;
}

function Beats({ proseRef, marksFor, lead }: {
  proseRef: React.RefObject<HTMLDivElement | null>;
  marksFor: (key: string) => Mark[];
  /** The first-run line, between the byline and the read. */
  lead?: React.ReactNode;
}) {
  return (
    <div ref={proseRef} style={{ minWidth: 0 }}>
      <h1 style={{ ...DISPLAY_LG, margin: "0 0 8px" }}>{TITLE}</h1>
      <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: lead ? "0 0 14px" : "0 0 26px" }}>
        Villanueva, Ito and Oyelaran, 2025
      </p>
      {lead}
      {BEATS.map((beat, i) => (
        <section
          key={beat.key}
          style={i === 0 ? undefined : { borderTop: HAIRLINE, paddingTop: 22, marginTop: 22 }}
        >
          {beat.heading && <h2 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{beat.heading}</h2>}
          <p data-section={beat.key} style={{ ...READING_BODY, margin: 0 }}>
            {annotate(beat.text, marksFor(beat.key))}
          </p>
        </section>
      ))}
    </div>
  );
}

/* ── Small shared parts ──────────────────────────────────────────────────── */

/** The wait. The stamp, centred, with one line under it. */
function Waiting({ compact = false, line = "Re-reading the paper for that…" }: { compact?: boolean; line?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: compact ? "10px 0" : "18px 0" }}>
      <PageLoader inline />
      <span style={{ ...(compact ? BODY_SM : BODY_STYLE), color: MUTED, textAlign: "center" }}>{line}</span>
    </div>
  );
}

/** The one composer, dressed differently per variant. */
function AskField({ onSubmit, onCancel, autoFocus = true, placeholder }: {
  onSubmit: (question: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0 }}>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); onSubmit(draft.trim() || DEFAULT_QUESTION); }
          if (e.key === "Escape" && onCancel) onCancel();
        }}
        autoFocus={autoFocus}
        placeholder={placeholder ?? `Ask about this, or just “${DEFAULT_QUESTION}”`}
        aria-label="Ask a question about the selected passage"
        style={{
          ...BODY_SM, flex: 1, minWidth: 0, background: "transparent", color: INK,
          border: "none", outline: "none", padding: "10px 12px",
        }}
      />
      <button
        onMouseDown={e => { e.preventDefault(); onSubmit(draft.trim() || DEFAULT_QUESTION); }}
        style={{
          ...BODY_SM, fontWeight: 600, background: "transparent", color: INK,
          border: "none", borderLeft: BORDER, padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        Ask
      </button>
    </div>
  );
}

/** The floating bar, for the variants that put the composer at the selection. */
function FloatingBar({ pick, onSubmit, onCancel }: {
  pick: Pick;
  onSubmit: (question: string) => void;
  onCancel: () => void;
}) {
  const WIDTH = 360;
  return (
    <div
      data-ask-ui
      onMouseDown={e => { if (!(e.target as HTMLElement).closest("input")) e.preventDefault(); }}
      style={{
        position: "fixed", zIndex: 60, width: WIDTH,
        left: Math.min(Math.max(12, pick.right - WIDTH / 2), window.innerWidth - WIDTH - 12),
        top: Math.min(pick.bottom + 10, window.innerHeight - 80),
        display: "flex", border: BORDER, boxShadow: SHADOW, background: SURFACE,
      }}
    >
      <AskField onSubmit={onSubmit} onCancel={onCancel} />
    </div>
  );
}

/** A number in a hard square. The one badge shape on this page. */
function Numeral({ n, tone = "ink", size = 20 }: { n: number; tone?: "ink" | "hollow"; size?: number }) {
  return (
    <span
      style={{
        ...BODY_SM, fontWeight: 600, lineHeight: `${size - 2}px`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, flexShrink: 0,
        border: BORDER_HAIR,
        background: tone === "ink" ? INK : SURFACE,
        color: tone === "ink" ? SURFACE : INK,
      }}
    >
      {n}
    </span>
  );
}

/**
 * The passage, repeated, filled in the paper's hue. This is the part that made
 * the two survivors work: an answer that shows you what it is about does not
 * need to sit next to the sentence to be findable.
 */
function QuotedPassage({ text, hue, onJump, max = 120 }: {
  text: string;
  hue: string;
  onJump?: () => void;
  max?: number;
}) {
  const body = (
    <span style={{ ...BODY_SM, background: hue, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
      {text.length > max ? `${text.slice(0, max)}…` : text}
    </span>
  );
  if (!onJump) return <span style={{ display: "block" }}>{body}</span>;
  return (
    <button
      onClick={onJump}
      title="Take me back to this sentence"
      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      {body}
    </button>
  );
}

function quoteLine(text: string, max = 76) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Take me back to that sentence. The blink is the caller's business: whoever
 * owns the marks decides which one is flashing, because that is a prop on a
 * mark, not a document-wide fact.
 */
function useJump() {
  return useCallback((id: string) => {
    document.querySelector(`[data-mark-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
}

/**
 * Where each answered passage sits inside the reading column, in pixels from its
 * top. For the variants that line something up with the line it came from.
 */
function useMarkTops(proseRef: React.RefObject<HTMLDivElement | null>, asks: Ask[]) {
  const [tops, setTops] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const box = proseRef.current?.getBoundingClientRect();
    if (!box) return;
    const next: Record<string, number> = {};
    for (const ask of asks) {
      const el = proseRef.current?.querySelector(`[data-mark-id="${ask.id}"]`);
      if (el) next[ask.id] = el.getBoundingClientRect().top - box.top;
    }
    const changed = Object.keys(next).length !== Object.keys(tops).length
      || Object.entries(next).some(([id, v]) => Math.abs((tops[id] ?? -1) - v) > 0.5);
    // Measuring rendered geometry and writing it back is what a layout effect is
    // for; the guard is what stops it cascading. Once the numbers match, no-op.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (changed) setTops(next);
  }, [asks, tops, proseRef]);

  return tops;
}

/* ── First run ───────────────────────────────────────────────────────────── */

/**
 * Teaching the gesture, four ways, on top of whichever answer shape is showing.
 *
 * The problem is narrow and real: highlight-to-ask is invisible. Nothing on the
 * page says a sentence is a thing you can pull on, and a reader who never drags
 * across a line never finds out. The shipped answer is a line of small grey text
 * that says so, which is a caption asking you to take its word for it.
 *
 * All three of the real options here say it in the paper's own colour instead,
 * inside the text, which is the only place the gesture exists. They retire the
 * moment the reader asks anything.
 */
type NuxMode = "off" | "one" | "three" | "demo";

interface Lit {
  section: string;
  text: string;
  /** What clicking it asks. Shown on hover for the invitations. */
  question: string;
}

/** The sentence the demo paints, and the one pre-lit for "one". */
const NUX_ONE: Lit = {
  section: "gist",
  text: "It is built by the sleep, and the part that gets lost is not recoverable by sleeping in the following night.",
  question: DEFAULT_QUESTION,
};

/** Three short phrases across the read, each worth a different kind of question. */
const NUX_THREE: Lit[] = [
  { section: "gist", text: "the gain arrives without any further practice", question: "How can you improve at something without practising it?" },
  { section: "found", text: "Slow-wave sleep in the first two hours", question: "Why the first two hours specifically?" },
  { section: "caveats", text: "Finger tapping is also the friendliest possible motor task", question: "What would a harder task change here?" },
];

function useNuxLayer(mode: NuxMode, hue: string, asks: Ask[], onPick: (lit: Lit) => void) {
  const [phase, setPhase] = useState<"painting" | "bar" | "gone">("painting");
  const [run, setRun] = useState(0);
  const [barAt, setBarAt] = useState<{ left: number; top: number } | null>(null);

  // The demo is a little film: the highlight paints itself across a sentence,
  // the bar it produces appears under it, and both clear. It runs once and can
  // be asked for again; it never loops, because a loop is an advertisement.
  // Only the timeouts live in the effect, so nothing is set synchronously
  // during it; a replay resets the phase in the click handler that asks for it.
  useEffect(() => {
    if (mode !== "demo") return;
    const toBar = setTimeout(() => setPhase("bar"), 1500);
    const toGone = setTimeout(() => setPhase("gone"), 4200);
    return () => { clearTimeout(toBar); clearTimeout(toGone); };
  }, [mode, run]);

  useEffect(() => {
    if (mode !== "demo" || phase !== "bar") return;
    const rect = document.querySelector('[data-mark-id^="nux-demo"]')?.getBoundingClientRect();
    // Where the painted sentence ended up is only knowable after it is painted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rect) setBarAt({ left: Math.max(12, rect.right - 180), top: rect.bottom + 10 });
  }, [mode, phase, run]);

  const replay = () => { setPhase("painting"); setBarAt(null); setRun(r => r + 1); };

  const retired = asks.length > 0;
  const taken = new Set(asks.map(a => a.selection));

  const marks = (key: string): Mark[] => {
    if (retired || mode === "off") return [];
    if (mode === "demo") {
      if (phase === "gone" || NUX_ONE.section !== key) return [];
      // The fill is a gradient rather than a colour so the class has something
      // to widen; a CSS animation outranks the inline background-size, which is
      // what lets the highlight paint itself across the words. The id carries
      // the run so "show me again" remounts the mark and restarts it.
      return [{
        id: `nux-demo-${run}`,
        text: NUX_ONE.text,
        fill: `linear-gradient(${hue}, ${hue}) no-repeat`,
        className: "proto-paint",
      }];
    }
    const lit = mode === "one" ? [NUX_ONE] : NUX_THREE;
    return lit.filter(l => l.section === key && !taken.has(l.text)).map(l => ({
      id: `nux-${l.text.slice(0, 12)}`,
      text: l.text,
      fill: hue,
      title: mode === "three" ? l.question : "Ask about this sentence",
      onClick: () => onPick(l),
      trailing: mode === "three"
        ? <sup style={{ ...BODY_SM, fontWeight: 600, fontSize: 11, padding: "0 2px" }}>?</sup>
        : undefined,
    }));
  };

  const lead = retired || mode === "off" ? null : (
    <p style={{ ...BODY_SM, margin: "0 0 22px", maxWidth: 620 }}>
      {mode === "one" && (
        <>
          <strong>One sentence is already highlighted.</strong> That is what asking looks
          like. Click it, or drag across any other line and ask your own thing.
        </>
      )}
      {mode === "three" && (
        <>
          <strong>Three things worth asking about are already highlighted.</strong> Click
          one to ask it, or drag across any line of your own.
        </>
      )}
      {mode === "demo" && (
        <>
          <strong>Like this.</strong> Drag across any sentence in the paper and ask
          about it.{" "}
          <button
            data-ask-ui
            onClick={replay}
            style={{ ...BODY_SM, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Show me again
          </button>
        </>
      )}
    </p>
  );

  // The ghost bar the demo produces. Not a real bar: it cannot be typed in and
  // it does not take the pointer.
  const ghost = mode === "demo" && phase === "bar" && barAt && !retired ? (
    <div
      aria-hidden
      style={{
        position: "fixed", zIndex: 59, width: 360, left: barAt.left, top: barAt.top,
        display: "flex", border: BORDER, boxShadow: SHADOW, background: SURFACE,
        pointerEvents: "none",
      }}
    >
      <span style={{ ...BODY_SM, flex: 1, padding: "10px 12px", color: MUTED }}>
        {DEFAULT_QUESTION}
      </span>
      <span style={{ ...BODY_SM, fontWeight: 600, borderLeft: BORDER, padding: "9px 14px" }}>Ask</span>
    </div>
  ) : null;

  return { marks, lead, ghost };
}

/* ────────────────────────────────────────────────────────────────────────────
   1. Ledger
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The favourite, tuned.
 *
 * Nothing lands in the read: the passage takes a numbered stamp and the answer
 * goes to a numbered ledger at the foot of the page. The paper stays exactly as
 * long as it started, however much you ask.
 *
 * Two things it was missing. It is now two-way: a stamp takes you down to its
 * row, and a row's quoted passage takes you back up to the sentence and blinks
 * it once, so the ledger is a set of return tickets rather than a dead end. And
 * because the answer arrives a long way from your eyes, a small runner rides the
 * bottom corner while one is being written, showing the stamp and the count. It
 * is the only thing on the page that moves, and it is four words wide.
 */
function Ledger({ hue, nuxMode }: VariantProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { asks, start, toggle, openOnly, forSection, streaming } = useAsks();
  const ledgerRef = useRef<HTMLDivElement>(null);
  const jump = useJump();
  const [flash, setFlash] = useState<string | null>(null);

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const toRow = (id: string) => {
    openOnly(id);
    ledgerRef.current?.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const toPassage = (id: string) => {
    jump(id);
    setFlash(id);
    setTimeout(() => setFlash(null), 1100);
  };

  const nux = useNuxLayer(nuxMode, hue, asks, lit => start(lit.text, lit.section, lit.question));

  const marksFor = (key: string): Mark[] => [
    ...nux.marks(key),
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, flash: flash === a.id, onClick: () => toRow(a.id),
      trailing: (
        <button
          data-ask-ui
          onClick={() => toRow(a.id)}
          title={`Go to note ${a.n}`}
          aria-label={`Go to note ${a.n}`}
          style={{ background: "none", border: "none", padding: "0 3px", cursor: "pointer", verticalAlign: "baseline" }}
        >
          <Numeral n={a.n} size={17} />
        </button>
      ),
    })),
  ];

  return (
    <>
      <Beats proseRef={proseRef} marksFor={marksFor} lead={nux.lead} />
      {nux.ghost}

      <div ref={ledgerRef} style={{ marginTop: 56 }}>
        <h2 style={{ ...DISPLAY_LG, margin: "0 0 6px" }}>What you asked this paper</h2>
        <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 16px" }}>
          {asks.length === 0
            ? "Nothing yet. Highlight a sentence above and your question lands here, numbered, with its passage. The paper itself stays exactly as it is."
            : `${asks.length} question${asks.length === 1 ? "" : "s"}. Click a passage to go back to where you found it.`}
        </p>
        {asks.map(ask => (
          <div key={ask.id} data-row={ask.id} data-ask-ui style={{ borderTop: BORDER, padding: "14px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <button
                onClick={() => toPassage(ask.id)}
                title="Take me back to this sentence"
                aria-label={`Go back to passage ${ask.n} in the paper`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
              >
                <Numeral n={ask.n} />
              </button>
              <button
                onClick={() => toggle(ask.id)}
                aria-expanded={ask.open}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...BODY_STYLE, fontWeight: 600, display: "block" }}>{ask.question}</span>
                  <span style={{ display: "block", marginTop: 4 }}>
                    <QuotedPassage text={ask.selection} hue={hue} onJump={() => toPassage(ask.id)} />
                  </span>
                </span>
                <ChevronDown size={16} style={{ flexShrink: 0, transform: ask.open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
              </button>
            </div>
            {ask.open && (
              <div style={{ paddingTop: 12, paddingLeft: 32 }}>
                {ask.answer
                  ? <p style={{ ...READING_BODY, margin: 0 }}>{ask.answer}</p>
                  : <Waiting />}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* The runner. Only while something is being written, or for as long as
          there is a ledger to get back to. Four words wide, bottom corner. */}
      {asks.length > 0 && (
        <button
          data-ask-ui
          onClick={() => ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          style={{
            position: "fixed", right: 20, bottom: 20, zIndex: 55,
            display: "flex", alignItems: "center", gap: 10,
            border: BORDER, boxShadow: SHADOW, background: SURFACE,
            padding: "8px 12px", cursor: "pointer",
          }}
        >
          {streaming ? <PageLoader inline /> : <Numeral n={asks.length} />}
          <span style={{ ...BODY_SM, fontWeight: 600 }}>
            {streaming ? "Writing your answer" : `${asks.length} in the ledger`}
          </span>
        </button>
      )}

      {pick && <FloatingBar pick={pick} onSubmit={submit} onCancel={() => setPick(null)} />}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   2. Pinned cards
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The other survivor. Answers as objects you can put down: each is a full card
 * in the rail with the frame and the one shadow, headed by the passage it came
 * from in the paper's hue, tied to its mark by a numeral.
 *
 * Tuned: the tie is now two-way and physical. Hovering a card darkens its mark
 * in the text, hovering a mark lifts its card, and clicking either takes you to
 * the other. The header carries the passage rather than the question, because
 * the passage is what you recognise.
 */
function PinnedCards({ hue, nuxMode }: VariantProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { asks, start, toggle, forSection } = useAsks();
  const [linked, setLinked] = useState<string | null>(null);
  const jump = useJump();

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const nux = useNuxLayer(nuxMode, hue, asks, lit => start(lit.text, lit.section, lit.question));

  const marksFor = (key: string): Mark[] => [
    ...nux.marks(key),
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, active: linked === a.id,
      onEnter: () => setLinked(a.id),
      onLeave: () => setLinked(null),
      trailing: <sup style={{ ...BODY_SM, fontWeight: 600, fontSize: 11, padding: "0 2px" }}>{a.n}</sup>,
    })),
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 40, alignItems: "start" }}>
      <Beats proseRef={proseRef} marksFor={marksFor} lead={nux.lead} />
      {nux.ghost}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
        {asks.length === 0 && (
          <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>
            Highlight a sentence on the left. Each answer is pinned out here as a card you can fold, headed by the passage it came from.
          </p>
        )}
        {asks.map(ask => (
          <div
            key={ask.id}
            data-ask-ui
            onMouseEnter={() => setLinked(ask.id)}
            onMouseLeave={() => setLinked(null)}
            style={{
              border: BORDER, background: SURFACE,
              boxShadow: SHADOW,
              transform: linked === ask.id ? "translate(-2px, -2px)" : "none",
              transition: "transform 120ms",
            }}
          >
            <div style={{ background: hue, borderBottom: ask.open ? BORDER : "none", padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <button
                onClick={() => jump(ask.id)}
                title="Take me back to this sentence"
                aria-label={`Go back to passage ${ask.n} in the paper`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
              >
                <Numeral n={ask.n} />
              </button>
              <span style={{ ...BODY_SM, flex: 1, minWidth: 0 }}>{quoteLine(ask.selection, 90)}</span>
              <button
                onClick={() => toggle(ask.id)}
                aria-label={ask.open ? "Fold this card" : "Unfold this card"}
                aria-expanded={ask.open}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
              >
                <ChevronDown size={16} style={{ transform: ask.open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
              </button>
            </div>
            {ask.open && (
              <div style={{ padding: "12px 14px 14px" }}>
                <p style={{ ...BODY_SM, fontWeight: 600, margin: "0 0 8px" }}>{ask.question}</p>
                {ask.answer
                  ? <p style={{ ...BODY_SM, margin: 0 }}>{ask.answer}</p>
                  : <Waiting compact />}
              </div>
            )}
          </div>
        ))}
      </div>

      {pick && (
        <div
          data-ask-ui
          onMouseDown={e => { if (!(e.target as HTMLElement).closest("input")) e.preventDefault(); }}
          style={{
            position: "fixed", zIndex: 60, width: 380,
            left: Math.min(Math.max(12, pick.right - 190), window.innerWidth - 392),
            top: Math.min(pick.bottom + 10, window.innerHeight - 160),
            border: BORDER, boxShadow: SHADOW, background: SURFACE,
          }}
        >
          <div style={{ background: hue, padding: "10px 12px", borderBottom: BORDER, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ ...BODY_SM, flex: 1 }}>{quoteLine(pick.text, 110)}</span>
            <button
              onClick={() => setPick(null)}
              aria-label="Cancel"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          </div>
          <div style={{ display: "flex" }}>
            <AskField onSubmit={submit} onCancel={() => setPick(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   3. The spine
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The ledger's discipline with the margin's proximity.
 *
 * A 2px rule runs down the edge of the reading column, and every question you
 * have asked is one short tick on it, at exactly the height of the sentence it
 * came from. That is the entire resting state: no cards, no notes, no numerals
 * in the prose, a ruled edge with some ticks on it.
 *
 * Point at a tick and its answer swings out into the empty margin, headed by the
 * passage in the paper's hue. Move away and it is gone again. Click to keep it.
 * You can read the whole paper with four answers behind that edge and never see
 * one until you want it.
 */
function Spine({ hue, nuxMode }: VariantProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { asks, start, forSection, streaming } = useAsks();
  const tops = useMarkTops(proseRef, asks);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const jump = useJump();

  const submit = (question: string) => {
    if (!pick) return;
    const id = start(pick.text, pick.section, question);
    setPinned(id);
    setPick(null);
  };

  const showing = hovered ?? pinned;
  const shown = asks.find(a => a.id === showing) ?? null;

  const nux = useNuxLayer(nuxMode, hue, asks, lit => setPinned(start(lit.text, lit.section, lit.question)));

  const marksFor = (key: string): Mark[] => [
    ...nux.marks(key),
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, active: showing === a.id,
      onEnter: () => setHovered(a.id),
      onLeave: () => setHovered(null),
    })),
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 28, alignItems: "start" }}>
      <Beats proseRef={proseRef} marksFor={marksFor} lead={nux.lead} />
      {nux.ghost}

      <div style={{ position: "relative", minHeight: 480, borderLeft: BORDER, paddingLeft: 0 }}>
        {asks.length === 0 && (
          <p style={{ ...BODY_SM, color: MUTED, margin: 0, padding: "0 0 0 16px" }}>
            Highlight a sentence on the left. Answers hide behind this edge as ticks, level with their own line. Point at one to read it.
          </p>
        )}

        {asks.map(ask => (
          <button
            key={ask.id}
            data-ask-ui
            onMouseEnter={() => setHovered(ask.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { setPinned(p => p === ask.id ? null : ask.id); jump(ask.id); }}
            title={quoteLine(ask.selection, 60)}
            aria-label={`Answer ${ask.n}`}
            style={{
              position: "absolute", left: -2, top: (tops[ask.id] ?? 0) + 4,
              width: showing === ask.id ? 28 : 18, height: 14,
              background: showing === ask.id ? INK : hue,
              border: BORDER_HAIR, borderLeft: "none", padding: 0, cursor: "pointer",
              transition: "width 120ms, background 120ms",
            }}
          />
        ))}

        {shown && (
          <div
            data-ask-ui
            onMouseEnter={() => setHovered(shown.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "absolute", left: 34, right: 0, top: Math.max(0, (tops[shown.id] ?? 0) - 8),
              border: BORDER, boxShadow: SHADOW, background: SURFACE, zIndex: 5,
            }}
          >
            <div style={{ background: hue, padding: "10px 12px", borderBottom: BORDER }}>
              <QuotedPassage text={shown.selection} hue="transparent" onJump={() => jump(shown.id)} max={110} />
            </div>
            <div style={{ padding: "12px 14px" }}>
              <p style={{ ...BODY_SM, fontWeight: 600, margin: "0 0 8px" }}>{shown.question}</p>
              {shown.answer
                ? <p style={{ ...BODY_SM, margin: 0 }}>{shown.answer}</p>
                : <Waiting compact />}
              <p style={{ ...BODY_SM, color: MUTED, margin: "10px 0 0" }}>
                {pinned === shown.id ? "Click the tick again to let this go." : "Click the tick to keep this open."}
              </p>
            </div>
          </div>
        )}

        {streaming && !shown && (
          <div style={{ position: "absolute", left: 16, top: 0 }}><Waiting compact line="Writing…" /></div>
        )}
      </div>

      {pick && <FloatingBar pick={pick} onSubmit={submit} onCancel={() => setPick(null)} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   4. The companion
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The friendly one, and the honest replacement for the command bar.
 *
 * Somebody is reading this paper with you and they sit in the bottom corner.
 * Highlight a sentence and they take it: the passage arrives in their panel as a
 * chip in the paper's hue with the cursor already in the field, so you type your
 * question where the answer will appear, in the one place that is always in the
 * same spot.
 *
 * Folded, they are a single square with a count on it. The read never moves, and
 * there is nothing in the margin at all, so this is the only shape here that
 * survives a phone unchanged.
 */
function Companion({ hue, nuxMode }: VariantProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const { asks, start, forSection, streaming } = useAsks();
  const [open, setOpen] = useState(true);
  const [held, setHeld] = useState<Pick | null>(null);
  const jump = useJump();
  const logRef = useRef<HTMLDivElement>(null);

  // Taking the passage is the whole gesture. Nothing floats over the sentence,
  // so this variant never renders `pick` at all: the passage goes straight to
  // the panel in the corner.
  usePick(proseRef, captured => {
    setHeld(captured);
    setOpen(true);
  });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [asks.length]);

  const submit = (question: string) => {
    if (!held) return;
    start(held.text, held.section, question);
    setHeld(null);
  };

  const nux = useNuxLayer(nuxMode, hue, asks, lit => { setOpen(true); start(lit.text, lit.section, lit.question); });

  const marksFor = (key: string): Mark[] => [
    ...nux.marks(key),
    ...(held && held.section === key ? [{ id: "held", text: held.text, fill: hue }] : []),
    ...forSection(key).map(a => ({ id: a.id, text: a.selection, fill: hue })),
  ];

  return (
    <>
      <div style={{ maxWidth: 680 }}>
        <Beats proseRef={proseRef} marksFor={marksFor} lead={nux.lead} />
      {nux.ghost}
      </div>

      {!open ? (
        <button
          data-ask-ui
          onClick={() => setOpen(true)}
          aria-label="Open your reading companion"
          style={{
            position: "fixed", right: 24, bottom: 24, zIndex: 60,
            width: 52, height: 52, border: BORDER, boxShadow: SHADOW, background: SURFACE,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {streaming ? <PageLoader inline /> : <span style={{ ...DISPLAY_SM }}>{asks.length || "?"}</span>}
        </button>
      ) : (
        <div
          data-ask-ui
          style={{
            position: "fixed", right: 24, bottom: 24, zIndex: 60, width: 380,
            maxHeight: "min(70vh, 620px)", display: "flex", flexDirection: "column",
            border: BORDER, boxShadow: SHADOW, background: SURFACE,
          }}
        >
          <div style={{ background: hue, borderBottom: BORDER, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ ...DISPLAY_SM, margin: 0 }}>Reading with you</p>
              <p style={{ ...BODY_SM, margin: "4px 0 0" }}>
                Highlight anything in the paper and I&rsquo;ll take it from there.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fold the companion away"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
            >
              <ChevronDown size={17} />
            </button>
          </div>

          <div ref={logRef} style={{ overflowY: "auto", padding: "0 14px", flex: 1, minHeight: 0 }}>
            {asks.length === 0 && !held && (
              <p style={{ ...BODY_SM, color: MUTED, margin: "14px 0" }}>
                Nothing yet. Try the sentence about slow-wave sleep.
              </p>
            )}
            {asks.map((ask, i) => (
              <div key={ask.id} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : HAIRLINE }}>
                <QuotedPassage text={ask.selection} hue={hue} onJump={() => jump(ask.id)} max={90} />
                <p style={{ ...BODY_SM, fontWeight: 600, margin: "8px 0 6px" }}>{ask.question}</p>
                {ask.answer
                  ? <p style={{ ...BODY_SM, margin: 0 }}>{ask.answer}</p>
                  : <Waiting compact />}
              </div>
            ))}
          </div>

          <div style={{ borderTop: BORDER, flexShrink: 0 }}>
            {held && (
              <div style={{ padding: "10px 12px 0", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ ...BODY_SM, background: hue, padding: "2px 4px", flex: 1, minWidth: 0 }}>
                  {quoteLine(held.text, 70)}
                </span>
                <button
                  onClick={() => setHeld(null)}
                  aria-label="Drop this passage"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div style={{ display: "flex" }}>
              <AskField
                key={held?.text ?? "idle"}
                onSubmit={held ? submit : () => {}}
                autoFocus={!!held}
                placeholder={held ? `Ask about this, or just “${DEFAULT_QUESTION}”` : "Highlight a sentence first"}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   5. The drawer
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The ledger, brought to you instead of waited for.
 *
 * A drawer is fixed to the bottom of the reading column, not the window: it is
 * the width of the text and it belongs to the page. Its lip is a row of tabs,
 * one per question, each carrying its numeral and a scrap of its passage in the
 * paper's hue. Pull one and the drawer slides open over the foot of the column
 * with that answer in it; push it and you have the read back.
 *
 * The advantage over the ledger is that you never travel: the answers come to
 * the bottom of the page you are on. The cost is that an open drawer covers the
 * last few lines of the column while it is open.
 */
function Drawer({ hue, nuxMode }: VariantProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const { asks, start, forSection, streaming } = useAsks();
  const [openId, setOpenId] = useState<string | null>(null);
  const [held, setHeld] = useState<Pick | null>(null);
  const jump = useJump();

  // Straight into the drawer's lip. Nothing floats over the sentence.
  usePick(proseRef, setHeld);

  const submit = (question: string) => {
    if (!held) return;
    const id = start(held.text, held.section, question);
    setOpenId(id);
    setHeld(null);
  };

  const shown = asks.find(a => a.id === openId) ?? null;

  const nux = useNuxLayer(nuxMode, hue, asks, lit => setOpenId(start(lit.text, lit.section, lit.question)));

  const marksFor = (key: string): Mark[] => [
    ...nux.marks(key),
    ...(held && held.section === key ? [{ id: "held", text: held.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, active: openId === a.id,
      onClick: () => setOpenId(p => p === a.id ? null : a.id),
    })),
  ];

  return (
    <div style={{ position: "relative", maxWidth: 820 }}>
      <Beats proseRef={proseRef} marksFor={marksFor} lead={nux.lead} />
      {nux.ghost}
      {/* Room under the read so the drawer never sits on the last line. */}
      <div style={{ height: 220 }} />

      <div
        data-ask-ui
        style={{
          position: "sticky", bottom: 16, zIndex: 40,
          border: BORDER, boxShadow: SHADOW, background: SURFACE,
        }}
      >
        {shown && (
          <div style={{ borderBottom: BORDER, maxHeight: "38vh", overflowY: "auto" }}>
            <div style={{ background: hue, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ ...BODY_SM, flex: 1 }}>{quoteLine(shown.selection, 130)}</span>
              <button
                onClick={() => jump(shown.id)}
                style={{ ...BODY_SM, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, flexShrink: 0 }}
              >
                Back to it
              </button>
              <button
                onClick={() => setOpenId(null)}
                aria-label="Close the drawer"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <p style={{ ...BODY_SM, fontWeight: 600, margin: "0 0 8px" }}>{shown.question}</p>
              {shown.answer
                ? <p style={{ ...READING_BODY, margin: 0 }}>{shown.answer}</p>
                : <Waiting />}
            </div>
          </div>
        )}

        {held ? (
          <div>
            <div style={{ padding: "10px 14px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ ...BODY_SM, background: hue, padding: "2px 4px", flex: 1, minWidth: 0 }}>
                {quoteLine(held.text, 110)}
              </span>
              <button
                onClick={() => setHeld(null)}
                aria-label="Drop this passage"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "flex" }}>
              <AskField onSubmit={submit} onCancel={() => setHeld(null)} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", overflowX: "auto" }}>
            {asks.length === 0 ? (
              <span style={{ ...BODY_SM, color: MUTED }}>
                Highlight a sentence above. Your questions live in this drawer, and it follows you down the page.
              </span>
            ) : (
              <>
                {streaming && <PageLoader inline />}
                {asks.map(ask => (
                  <button
                    key={ask.id}
                    onClick={() => setOpenId(p => p === ask.id ? null : ask.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                      border: BORDER_HAIR, background: openId === ask.id ? hue : SURFACE,
                      padding: "5px 8px", cursor: "pointer", maxWidth: 260,
                    }}
                  >
                    <Numeral n={ask.n} size={17} />
                    <span style={{ ...BODY_SM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {quoteLine(ask.selection, 34)}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   6. The whisper
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The extreme case, and the answer to "how unobtrusive can this get".
 *
 * The answer has no furniture at all. It lives inside the mark: point at a
 * passage you asked about and the answer appears over the page beside it, in the
 * one ink tooltip this product already uses for hard words and a paper's gist.
 * Move away and there is nothing on the page but a coloured sentence.
 *
 * A whisper cannot hold five hundred words, so it holds the first breath of the
 * answer and a way to keep it. Click the passage and it becomes a card, in
 * place, over the margin, until you dismiss it.
 */
function Whisper({ hue, nuxMode }: VariantProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { asks, start, forSection, streaming } = useAsks();
  const tops = useMarkTops(proseRef, asks);
  const [hovered, setHovered] = useState<string | null>(null);
  const [kept, setKept] = useState<string | null>(null);

  const submit = (question: string) => {
    if (!pick) return;
    const id = start(pick.text, pick.section, question);
    setKept(id);
    setPick(null);
  };

  const nux = useNuxLayer(nuxMode, hue, asks, lit => setKept(start(lit.text, lit.section, lit.question)));

  const marksFor = (key: string): Mark[] => [
    ...nux.marks(key),
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, active: hovered === a.id || kept === a.id,
      onEnter: () => setHovered(a.id),
      onLeave: () => setHovered(null),
      onClick: () => setKept(p => p === a.id ? null : a.id),
    })),
  ];

  const whispered = asks.find(a => a.id === hovered && a.id !== kept) ?? null;
  const keptAsk = asks.find(a => a.id === kept) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 28, alignItems: "start" }}>
      <div style={{ position: "relative" }}>
        <Beats proseRef={proseRef} marksFor={marksFor} lead={nux.lead} />
      {nux.ghost}

        {/* The whisper. Ink, small, and gone the moment you look away. */}
        {whispered && (
          <div
            style={{
              position: "absolute", left: 0, right: 0, top: (tops[whispered.id] ?? 0) + 26,
              zIndex: 30, background: INK, color: SURFACE, padding: "10px 12px", pointerEvents: "none",
              boxShadow: SHADOW,
            }}
          >
            <p style={{ ...BODY_SM, color: SURFACE, margin: 0 }}>
              {whispered.answer
                ? `${quoteLine(whispered.answer, 190)}`
                : "Still writing this one…"}
            </p>
            <p style={{ ...BODY_SM, color: RULE, margin: "6px 0 0" }}>Click the sentence to keep it open.</p>
          </div>
        )}
      </div>

      <div style={{ position: "relative", minHeight: 480 }}>
        {asks.length === 0 && (
          <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>
            Highlight a sentence on the left. The answer does not appear anywhere: the sentence just turns the paper&rsquo;s colour, and points at it when you want it back.
          </p>
        )}
        {asks.length > 0 && !keptAsk && (
          <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>
            {asks.length} coloured sentence{asks.length === 1 ? "" : "s"} in the paper. Point at one.
          </p>
        )}
        {streaming && !keptAsk && <Waiting compact line="Writing…" />}

        {keptAsk && (
          <div
            data-ask-ui
            style={{
              position: "absolute", left: 0, right: 0, top: Math.max(0, (tops[keptAsk.id] ?? 0) - 8),
              border: BORDER, boxShadow: SHADOW, background: SURFACE,
            }}
          >
            <div style={{ background: hue, padding: "10px 12px", borderBottom: BORDER, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ ...BODY_SM, flex: 1 }}>{quoteLine(keptAsk.selection, 110)}</span>
              <button
                onClick={() => setKept(null)}
                aria-label="Let this go"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, display: "flex", flexShrink: 0 }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <p style={{ ...BODY_SM, fontWeight: 600, margin: "0 0 8px" }}>{keptAsk.question}</p>
              {keptAsk.answer
                ? <p style={{ ...BODY_SM, margin: 0 }}>{keptAsk.answer}</p>
                : <Waiting compact />}
            </div>
          </div>
        )}
      </div>

      {pick && <FloatingBar pick={pick} onSubmit={submit} onCancel={() => setPick(null)} />}
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

interface VariantProps {
  hue: string;
  nuxMode: NuxMode;
}

interface VariantSpec {
  key: string;
  tab: string;
  note: string;
  cost: string;
  render: (props: VariantProps) => React.ReactNode;
}

interface NuxSpec {
  key: NuxMode;
  tab: string;
  note: string;
}

/**
 * The four first-run options, orthogonal to the six answer shapes: pick one of
 * each. All three real ones say the same thing, in the paper's own colour,
 * inside the text, and all three retire on the reader's first question.
 */
const NUXES: NuxSpec[] = [
  {
    key: "off",
    tab: "None",
    note: "Nothing. What a returning reader sees, and the control for judging the other three.",
  },
  {
    key: "one",
    tab: "One lit sentence",
    note: "The most interesting sentence in the gist arrives already highlighted in the paper's colour, with one line above the read saying so. It is a worked example rather than an instruction: this is what a passage you have pulled on looks like, and clicking it asks the default question. Quietest of the three, and the only one that does not put a decision in front of a reader who just wants to read.",
  },
  {
    key: "three",
    tab: "Three invitations",
    note: "Three short phrases lit across the paper, each carrying a question mark and, on hover, the question it would ask. They are chosen to be three different kinds of question: a mechanism, a number, a limit. It teaches the gesture and the range at once, which is the thing a single example cannot do.",
  },
  {
    key: "demo",
    tab: "The demo",
    note: "Nothing is pre-lit. Instead a highlight paints itself across a sentence, the bar it produces appears underneath with the default question in it, and both clear. It shows the gesture rather than its result, which is the only one of the three that teaches the drag itself. Runs once, replayable, never loops.",
  },
];

const VARIANTS: VariantSpec[] = [
  {
    key: "ledger",
    tab: "Ledger",
    note: "Kept, and made two-way. The passage takes a numbered stamp and the answer goes to a numbered ledger at the foot of the page. Now a stamp takes you down to its row and a row's passage takes you back up to the sentence and blinks it once, and a small runner rides the bottom corner while an answer is being written, so you are never waiting on something you cannot see.",
    cost: "The answer is a long way from the passage. The runner and the return tickets are what pay for that.",
    render: props => <Ledger {...props} />,
  },
  {
    key: "cards",
    tab: "Pinned cards",
    note: "Kept, and the tie made physical. Each answer is a card in the rail headed by its passage in the paper's colour. Hover a card and its sentence darkens in the text; hover a sentence and its card lifts; click either to get to the other.",
    cost: "The rail is a second column to watch, and four open cards is a lot of furniture.",
    render: props => <PinnedCards {...props} />,
  },
  {
    key: "spine",
    tab: "The spine",
    note: "New. A ruled edge down the column with one short tick per question, at exactly the height of the sentence it came from. That is the whole resting state. Point at a tick and the answer swings out into the margin, headed by the passage in colour; move away and it is gone. Click to keep it.",
    cost: "Hover-first, so it wants a mouse. Two questions on neighbouring lines put their ticks close together.",
    render: props => <Spine {...props} />,
  },
  {
    key: "companion",
    tab: "The companion",
    note: "New, and the friendly replacement for the bar you hated. Somebody is reading the paper with you and they sit in the bottom corner. Highlight a sentence and they take it: it arrives in their panel as a chip in the paper's colour with the cursor already in the field. Folded, they are one square with a count on it.",
    cost: "It is a chat panel, and a chat panel is a familiar thing rather than a surprising one. Nothing at all in the margin, so it is the only one here that works unchanged on a phone.",
    render: props => <Companion {...props} />,
  },
  {
    key: "drawer",
    tab: "The drawer",
    note: "New. The ledger brought to you instead of waited for. A drawer is fixed to the bottom of the reading column, the width of the text, and its lip is a row of tabs carrying each question's numeral and a scrap of its passage. Pull one and the answer slides open; push it and you have the read back.",
    cost: "An open drawer covers the last few lines of the column. Fine while you are reading the answer, in the way the moment you are not.",
    render: props => <Drawer {...props} />,
  },
  {
    key: "whisper",
    tab: "The whisper",
    note: "New, and the extreme case. The answer has no furniture at all: point at a sentence you asked about and it appears in the one ink tooltip, then vanishes. A paper you asked six questions about looks like a paper with six coloured sentences in it. Click a sentence to keep its answer open as a card.",
    cost: "A whisper cannot hold a long answer, so it holds the first breath and asks you to click for the rest. Hover-first, so it wants a mouse.",
    render: props => <Whisper {...props} />,
  },
];

export default function HighlightAskPrototype() {
  const [variant, setVariant] = useState(VARIANTS[0].key);
  const [nux, setNux] = useState<NuxMode>("one");
  const [paper, setPaper] = useState(0);
  const active = useMemo(() => VARIANTS.find(v => v.key === variant) ?? VARIANTS[0], [variant]);
  const activeNux = useMemo(() => NUXES.find(n => n.key === nux) ?? NUXES[0], [nux]);
  const hue = washSlots(paper)[0];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto" }} className="px-5 md:px-8 pt-6 pb-32">
      <style>{`
        @keyframes protoFlash {
          0%, 100% { box-shadow: none }
          30%, 70% { box-shadow: 0 2px 0 0 ${INK} }
        }
        .proto-flash { animation: protoFlash 1s ease-in-out 1; }
        @keyframes protoPaint { from { background-size: 0% 100% } to { background-size: 100% 100% } }
        .proto-paint { background-size: 0% 100%; animation: protoPaint 1.4s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .proto-flash { animation: none }
          /* Important, because the inline background shorthand resets
             background-size and there is no animation here to outrank it. */
          .proto-paint { animation: none; background-size: 100% 100% !important }
        }
      `}</style>

      <h1 style={{ ...DISPLAY_LG, margin: 0 }}>Highlight to ask, round two</h1>
      <p style={{ ...BODY_STYLE, color: DIM, margin: "8px 0 0", maxWidth: 760 }}>
        Two kept from the first round and four new ones built on why they worked:
        the answer never cuts the read, and the passage always comes back to you
        filled in the paper&rsquo;s own colour, so you never have to remember which
        highlight this one was. Select any sentence below. Pressing Ask with an
        empty field asks &ldquo;{DEFAULT_QUESTION}&rdquo;. No model behind the page, so the
        answer is fixed and arrives on a timer.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, margin: "24px 0 0" }}>
        {VARIANTS.map(v => (
          <NavTab key={v.key} active={v.key === variant} onClick={() => setVariant(v.key)}>
            {v.tab}
          </NavTab>
        ))}
      </div>

      <div style={{ borderTop: BORDER, marginTop: 12, paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 320, maxWidth: 780 }}>
          <p style={{ ...BODY_SM, margin: 0 }}>{active.note}</p>
          <p style={{ ...BODY_SM, color: MUTED, margin: "6px 0 0" }}>
            <strong>Trade:</strong> {active.cost}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...BODY_SM, color: MUTED }}>Paper colour</span>
          {[0, 1, 2, 3].map(i => (
            <button
              key={i}
              onClick={() => setPaper(i)}
              aria-label={`Paper ${i + 1}`}
              aria-pressed={paper === i}
              style={{
                width: 24, height: 24, cursor: "pointer",
                background: washSlots(i)[0],
                border: paper === i ? BORDER : `2px solid ${RULE}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* The first run, which is a separate question from the answer shape: any
          of these four can sit on any of the six above. */}
      <div style={{ border: BORDER, background: SURFACE, marginTop: 22, padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 18 }}>
          <span style={{ ...BODY_SM, fontWeight: 600 }}>First run:</span>
          {NUXES.map(n => (
            <button
              key={n.key}
              onClick={() => setNux(n.key)}
              aria-pressed={nux === n.key}
              style={{
                ...BODY_SM,
                fontWeight: nux === n.key ? 600 : 400,
                background: nux === n.key ? hue : "transparent",
                border: nux === n.key ? BORDER_HAIR : `1px solid ${RULE}`,
                padding: "3px 8px", cursor: "pointer", color: INK,
              }}
            >
              {n.tab}
            </button>
          ))}
        </div>
        <p style={{ ...BODY_SM, color: DIM, margin: "10px 0 0", maxWidth: 820 }}>{activeNux.note}</p>
        <p style={{ ...BODY_SM, color: MUTED, margin: "6px 0 0" }}>
          All three retire the moment you ask anything. Switch back to see one again.
        </p>
      </div>

      <div style={{ marginTop: 36 }}>
        {/* Keyed on both, so changing either starts the surface clean rather than
            inheriting the last one's answers in a layout that never held them. */}
        <React.Fragment key={`${active.key}-${nux}`}>
          {active.render({ hue, nuxMode: nux })}
        </React.Fragment>
      </div>
    </div>
  );
}

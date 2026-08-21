"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { READING_BODY } from "@/components/paper-card";
import {
  BODY_SM, BODY_STYLE, BORDER, BORDER_HAIR, DIM, DISPLAY_LG, DISPLAY_SM, HAIRLINE, INK, MUTED,
  NavTab, PageLoader, RULE, SHADOW, SURFACE, washSlots,
} from "@/components/design-system";

/*
 * Highlight to ask — six ways, one page. /prototype/highlight-ask
 *
 * The reading view has one open question and it is not the model, it is the
 * furniture: when a reader highlights a passage, what shows up, where does the
 * answer land, and what does the answer look like when it is folded away. The
 * shipped version answers that with a floating bar and an indented block behind
 * a 2px rule, and the indent has no caption on it, so a folded answer is a bare
 * chevron hanging off a paragraph.
 *
 * Every tab here is fully interactive against canned text. Select any sentence
 * in the walkthrough and the tab's own bar appears. There is no model behind the
 * page: the answer is fixed, it just arrives the way a streamed one does, after
 * a wait long enough to see the loader.
 *
 * What is the same in all six, because it is settled:
 *   · the drag wears the ordinary ink selection, and the moment the mouse is
 *     released the passage is redrawn in the paper's own hue. Black while you
 *     are choosing, colour once it is chosen.
 *   · there is one verb. "Ask". Nothing here says "dig deeper".
 *   · the wait is the stamp, centred, with a line under it.
 *
 * What differs is the whole point. Read the note under each tab.
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
];

const DEFAULT_QUESTION = "What does this mean?";

/** Long enough to see the loader, short enough to be an honest impression. */
const FIRST_TOKEN_MS = 1700;
const WORD_MS = 38;

function sampleAnswer(question: string, selection: string): string {
  const quoted = selection.length > 48 ? `${selection.slice(0, 48)}…` : selection;
  if (question === DEFAULT_QUESTION) {
    return `On "${quoted}": the claim turns on when the sleep happens, not how much of it there is. Slow-wave sleep is front-loaded into the first couple of hours after you fall asleep, and that window is where the paper's 19% gain was built, which is why a four hour night kept almost none of it. Outside work agrees on the direction and argues about the size: a 2026 replication found 11%, with a nap recovering roughly a third of what a short night cost. This page has no model behind it, so this text is fixed. It is here to show the shape of an answer, not the quality of one.`;
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

  return { asks, start, toggle, openOnly, forSection };
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
function usePick(scope: React.RefObject<HTMLElement | null>) {
  const [pick, setPick] = useState<Pick | null>(null);

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
      // Text inside an answer is not a passage of the paper. This matters for
      // the variants that render an answer inside the beat it came from, where
      // the answer is a descendant of the same [data-section].
      if (el?.closest("[data-ask-ui]")) return setPick(null);
      const host = el?.closest("[data-section]") as HTMLElement | null;
      if (!host || !scope.current?.contains(host)) return setPick(null);

      const rects = range.getClientRects();
      const first = rects[0];
      const last = rects[rects.length - 1];
      if (!first || !last) return setPick(null);

      setPick({
        text,
        section: host.dataset.section as string,
        top: first.top,
        bottom: last.bottom,
        left: first.left,
        right: last.right,
      });
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
  onClick?: () => void;
  /** Anything that follows the marked words: a numeral, a chip, a whole block. */
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
        key={key++}
        data-mark-id={r.mark.id}
        onClick={r.mark.onClick}
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

/**
 * The walkthrough. `as="div"` for the variants that need to open a block in the
 * middle of a paragraph, which a `<p>` cannot legally contain.
 */
function Beats({ proseRef, marksFor, after, as = "p" }: {
  proseRef: React.RefObject<HTMLDivElement | null>;
  marksFor: (key: string) => Mark[];
  after?: (key: string) => React.ReactNode;
  as?: "p" | "div";
}) {
  const Body: React.ElementType = as;
  return (
    <div ref={proseRef} style={{ minWidth: 0 }}>
      <h1 style={{ ...DISPLAY_LG, margin: "0 0 8px" }}>{TITLE}</h1>
      <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "0 0 26px" }}>
        Villanueva, Ito and Oyelaran, 2025
      </p>
      {BEATS.map((beat, i) => (
        <section
          key={beat.key}
          style={i === 0 ? undefined : { borderTop: HAIRLINE, paddingTop: 22, marginTop: 22 }}
        >
          {beat.heading && <h2 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{beat.heading}</h2>}
          <Body data-section={beat.key} style={{ ...READING_BODY, margin: 0 }}>
            {annotate(beat.text, marksFor(beat.key))}
          </Body>
          {after?.(beat.key)}
        </section>
      ))}
    </div>
  );
}

/* ── Small shared parts ──────────────────────────────────────────────────── */

/** The wait. The stamp, centred, with one line under it. */
function Waiting({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: compact ? "10px 0" : "18px 0" }}>
      <PageLoader inline />
      <span style={{ ...(compact ? BODY_SM : BODY_STYLE), color: MUTED, textAlign: "center" }}>
        Re-reading the paper for that&hellip;
      </span>
    </div>
  );
}

/** The one composer, dressed differently per variant. */
function AskField({ onSubmit, onCancel, dark = false, autoFocus = true, placeholder }: {
  onSubmit: (question: string) => void;
  onCancel?: () => void;
  dark?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const fg = dark ? SURFACE : INK;
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
          ...BODY_SM, flex: 1, minWidth: 0, background: "transparent", color: fg,
          border: "none", outline: "none", padding: "10px 12px",
        }}
      />
      <button
        onMouseDown={e => { e.preventDefault(); onSubmit(draft.trim() || DEFAULT_QUESTION); }}
        style={{
          ...BODY_SM, fontWeight: 600, background: "transparent", color: fg,
          border: "none", borderLeft: `2px solid ${dark ? SURFACE : INK}`,
          padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        Ask
      </button>
    </div>
  );
}

/** A number in a hard square. The one badge shape on this page. */
function Numeral({ n, tone = "ink" }: { n: number; tone?: "ink" | "hollow" }) {
  return (
    <span
      style={{
        ...BODY_SM, fontWeight: 600, lineHeight: "18px",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, flexShrink: 0,
        border: BORDER_HAIR,
        background: tone === "ink" ? INK : SURFACE,
        color: tone === "ink" ? SURFACE : INK,
      }}
    >
      {n}
    </span>
  );
}

function quoteLine(text: string, max = 76) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* ────────────────────────────────────────────────────────────────────────────
   A. Caption band
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The shipped shape with the missing half put back: the indent keeps its 2px
 * rule, and it gets a head. The head is the question, filled in the paper's hue,
 * and it is the whole control, so folded away an answer still says what it was.
 */
function CaptionBand({ hue }: { hue: string }) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { start, toggle, forSection } = useAsks();

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const marksFor = (key: string): Mark[] => [
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({ id: a.id, text: a.selection, fill: hue })),
  ];

  return (
    <>
      <Beats
        proseRef={proseRef}
        marksFor={marksFor}
        after={key => forSection(key).map(ask => (
          <div key={ask.id} style={{ borderLeft: BORDER, paddingLeft: 18, marginTop: 22 }}>
            <button
              data-ask-ui
              onClick={() => toggle(ask.id)}
              aria-expanded={ask.open}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                background: hue, border: "none", padding: "10px 12px", cursor: "pointer",
              }}
            >
              <span style={{ ...BODY_SM, fontWeight: 600, flex: 1, minWidth: 0 }}>{ask.question}</span>
              <ChevronDown size={16} style={{ flexShrink: 0, transform: ask.open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
            </button>
            {ask.open && (
              <div style={{ paddingTop: 12 }}>
                {ask.answer
                  ? <p style={{ ...READING_BODY, margin: 0 }}>{ask.answer}</p>
                  : <Waiting />}
              </div>
            )}
          </div>
        ))}
      />
      {pick && (
        <div
          data-ask-ui
          style={{
            position: "fixed", zIndex: 60, width: 360,
            left: Math.min(Math.max(12, pick.right - 180), window.innerWidth - 372),
            top: Math.min(pick.bottom + 10, window.innerHeight - 80),
            display: "flex", border: BORDER, boxShadow: SHADOW, background: SURFACE,
          }}
        >
          <AskField onSubmit={submit} onCancel={() => setPick(null)} />
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   B. Margin notes
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The academic one. The passage takes a numeral, the way a footnote does, and
 * everything else happens out in the margin, level with the line it came from.
 * You type where the answer will appear, so the answer never lands somewhere you
 * were not already looking. Folded, a note is one line: numeral and question.
 *
 * The read is never interrupted. That is the whole argument for it, and the cost
 * is that it needs a wide window and cannot survive a phone.
 */
function MarginNotes({ hue }: { hue: string }) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  // The composer's own offset inside the notes column, measured when it opens.
  // Measured there and not at render time, because a ref is not readable during
  // a render.
  const [composing, setComposing] = useState<{ pick: Pick; top: number } | null>(null);
  const { asks, start, toggle, forSection } = useAsks();
  const [tops, setTops] = useState<Record<string, number>>({});
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Line the notes up with their own passages, then push any that would collide
  // down until they do not. Measured after paint, and only written back when a
  // number actually changed, so this settles in one pass.
  useLayoutEffect(() => {
    const box = proseRef.current?.getBoundingClientRect();
    if (!box) return;
    const next: Record<string, number> = {};
    let floor = 0;
    const ordered = [...asks].sort((a, b) => {
      const ea = proseRef.current?.querySelector(`[data-mark-id="${a.id}"]`);
      const eb = proseRef.current?.querySelector(`[data-mark-id="${b.id}"]`);
      return (ea?.getBoundingClientRect().top ?? 0) - (eb?.getBoundingClientRect().top ?? 0);
    });
    for (const ask of ordered) {
      const el = proseRef.current?.querySelector(`[data-mark-id="${ask.id}"]`);
      const want = el ? el.getBoundingClientRect().top - box.top : 0;
      const top = Math.max(want, floor);
      next[ask.id] = top;
      floor = top + (noteRefs.current[ask.id]?.offsetHeight ?? 60) + 16;
    }
    const changed = Object.keys(next).length !== Object.keys(tops).length
      || Object.entries(next).some(([id, v]) => Math.abs((tops[id] ?? -1) - v) > 0.5);
    // Measuring rendered geometry and writing it back is the one thing a layout
    // effect is for, and the guard above is what stops it cascading: once the
    // numbers match, the pass is a no-op.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (changed) setTops(next);
  }, [asks, tops]);

  const submit = (question: string) => {
    if (!composing) return;
    start(composing.pick.text, composing.pick.section, question);
    setComposing(null);
    setPick(null);
  };

  const marksFor = (key: string): Mark[] => [
    ...(pick && pick.section === key && !composing ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...(composing && composing.pick.section === key ? [{ id: "composing", text: composing.pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id,
      text: a.selection,
      fill: hue,
      trailing: (
        <sup style={{ ...BODY_SM, fontWeight: 600, fontSize: 11, padding: "0 2px" }}>{a.n}</sup>
      ),
    })),
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 40, alignItems: "start" }}>
      <Beats proseRef={proseRef} marksFor={marksFor} />

      <div style={{ position: "relative", minHeight: 400 }}>
        <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>
          {asks.length === 0 && !composing ? "Highlight a sentence on the left. Your questions and their answers stack out here, level with the line they came from." : "Your notes"}
        </p>

        {composing && (
          <div
            data-ask-ui
            style={{
              position: "absolute", left: 0, right: 0, top: composing.top,
              border: BORDER, background: SURFACE, boxShadow: SHADOW,
            }}
          >
            <p style={{ ...BODY_SM, color: DIM, fontStyle: "italic", margin: 0, padding: "10px 12px 0" }}>
              &ldquo;{quoteLine(composing.pick.text, 60)}&rdquo;
            </p>
            <div style={{ display: "flex", borderTop: HAIRLINE, marginTop: 8 }}>
              <AskField onSubmit={submit} onCancel={() => setComposing(null)} />
            </div>
          </div>
        )}

        {asks.map(ask => (
          <div
            key={ask.id}
            ref={el => { noteRefs.current[ask.id] = el; }}
            data-ask-ui
            style={{
              position: "absolute", left: 0, right: 0, top: tops[ask.id] ?? 28,
              borderTop: BORDER, paddingTop: 10, background: SURFACE,
              transition: "top 180ms",
            }}
          >
            <button
              onClick={() => toggle(ask.id)}
              aria-expanded={ask.open}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left",
                background: "none", border: "none", padding: 0, cursor: "pointer",
              }}
            >
              <Numeral n={ask.n} tone="hollow" />
              <span style={{ ...BODY_SM, fontWeight: 600, flex: 1 }}>{ask.question}</span>
            </button>
            {ask.open && (
              <div style={{ paddingTop: 8 }}>
                {ask.answer
                  ? <p style={{ ...BODY_SM, color: DIM, margin: 0 }}>{ask.answer}</p>
                  : <Waiting compact />}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* The trigger is a single square at the end of the passage. Small, because
          the margin is where the interaction actually happens. */}
      {pick && !composing && (
        <button
          data-ask-ui
          onClick={() => setComposing({
            pick,
            top: Math.max(28, pick.top - (proseRef.current?.getBoundingClientRect().top ?? 0)),
          })}
          aria-label="Ask about this passage"
          style={{
            position: "fixed", zIndex: 60,
            left: Math.min(pick.right + 6, window.innerWidth - 40),
            top: pick.bottom - 22,
            width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
            border: BORDER, background: SURFACE, boxShadow: SHADOW, cursor: "pointer", color: INK,
          }}
        >
          <Plus size={15} />
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   C. Pinned cards
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Answers as objects you can put down. Each one is a card in the rail with the
 * full frame and the one shadow, headed by its question and tied to its passage
 * by a numeral. Hovering a card thickens the mark it came from, which is the
 * thing the margin-note version cannot do once notes have been pushed around.
 *
 * The bar is a card too, holding the quoted passage above the field, so what you
 * are about to ask about is legible while you type it.
 */
function PinnedCards({ hue }: { hue: string }) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { asks, start, toggle, forSection } = useAsks();
  const [hover, setHover] = useState<string | null>(null);

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const marksFor = (key: string): Mark[] => [
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, active: hover === a.id,
      trailing: <sup style={{ ...BODY_SM, fontWeight: 600, fontSize: 11, padding: "0 2px" }}>{a.n}</sup>,
    })),
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 40, alignItems: "start" }}>
      <Beats proseRef={proseRef} marksFor={marksFor} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
        {asks.length === 0 && (
          <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>
            Highlight a sentence on the left. Each answer is pinned here as a card you can fold, in the order you asked.
          </p>
        )}
        {asks.map(ask => (
          <div
            key={ask.id}
            data-ask-ui
            onMouseEnter={() => setHover(ask.id)}
            onMouseLeave={() => setHover(null)}
            style={{ border: BORDER, boxShadow: SHADOW, background: SURFACE }}
          >
            <div style={{ background: hue, borderBottom: ask.open ? BORDER : "none", padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Numeral n={ask.n} />
              <span style={{ ...BODY_SM, fontWeight: 600, flex: 1 }}>{ask.question}</span>
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
                <p style={{ ...BODY_SM, color: DIM, fontStyle: "italic", margin: "0 0 10px" }}>
                  &ldquo;{quoteLine(ask.selection, 90)}&rdquo;
                </p>
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
          style={{
            position: "fixed", zIndex: 60, width: 380,
            left: Math.min(Math.max(12, pick.right - 190), window.innerWidth - 392),
            top: Math.min(pick.bottom + 10, window.innerHeight - 160),
            border: BORDER, boxShadow: SHADOW, background: SURFACE,
          }}
        >
          <div style={{ background: hue, padding: "10px 12px", borderBottom: BORDER, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ ...BODY_SM, fontStyle: "italic", flex: 1 }}>&ldquo;{quoteLine(pick.text, 110)}&rdquo;</span>
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
   D. Command bar
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Nothing floats over the passage at all. Highlighting arms a bar docked to the
 * bottom of the window, ink on white reversed, holding the passage as a chip. It
 * never covers the sentence you are reading, it is always in the same place, and
 * it is the one shape here that works identically on a phone.
 *
 * The answer is a full-width band ruled top and bottom, with the question as a
 * caption column on the left. Folded, the band is the caption row alone.
 */
function CommandBar({ hue }: { hue: string }) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { start, toggle, forSection } = useAsks();

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const marksFor = (key: string): Mark[] => [
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({ id: a.id, text: a.selection, fill: hue })),
  ];

  return (
    <>
      <Beats
        proseRef={proseRef}
        marksFor={marksFor}
        after={key => forSection(key).map(ask => (
          <div key={ask.id} style={{ borderTop: BORDER, borderBottom: ask.open ? BORDER : "none", marginTop: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 20, padding: "12px 0" }}>
              <div>
                <p style={{ ...BODY_SM, margin: 0 }}>
                  <strong>You asked:</strong>
                </p>
                <p style={{ ...BODY_SM, margin: "2px 0 0" }}>{ask.question}</p>
                <button
                  data-ask-ui
                  onClick={() => toggle(ask.id)}
                  aria-expanded={ask.open}
                  style={{ ...BODY_SM, color: DIM, background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  {ask.open ? "Hide" : "Show the answer"}
                </button>
              </div>
              {ask.open && (
                <div style={{ paddingBottom: 6 }}>
                  {ask.answer
                    ? <p style={{ ...READING_BODY, margin: 0 }}>{ask.answer}</p>
                    : <Waiting />}
                </div>
              )}
            </div>
          </div>
        ))}
      />

      {pick && (
        <div
          data-ask-ui
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60,
            background: INK, borderTop: BORDER, padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 14,
          }}
        >
          <span
            style={{
              ...BODY_SM, color: INK, background: hue, border: `2px solid ${SURFACE}`,
              padding: "4px 8px", maxWidth: "42%", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {quoteLine(pick.text, 90)}
          </span>
          <div style={{ display: "flex", flex: 1, minWidth: 0, border: `2px solid ${SURFACE}` }}>
            <AskField dark onSubmit={submit} onCancel={() => setPick(null)} />
          </div>
          <button
            onClick={() => setPick(null)}
            aria-label="Cancel"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: SURFACE, display: "flex", flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   E. Ledger
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The archive answer. Nothing lands in the read at all: the passage takes a
 * numbered stamp and the answer goes to a ledger at the foot of the page, which
 * is a numbered list of everything you asked this paper. Click a stamp to open
 * its row, click a row to light its stamp.
 *
 * It is the only one of the six where reading the paper twice is unaffected by
 * how much you asked the first time, and the only one where the answers are a
 * thing you can read straight through afterwards.
 */
function Ledger({ hue }: { hue: string }) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { asks, start, toggle, openOnly, forSection } = useAsks();
  const ledgerRef = useRef<HTMLDivElement>(null);

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const jump = (id: string) => {
    openOnly(id);
    ledgerRef.current?.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const marksFor = (key: string): Mark[] => [
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(a => ({
      id: a.id, text: a.selection, fill: hue, onClick: () => jump(a.id),
      trailing: (
        <button
          data-ask-ui
          onClick={() => jump(a.id)}
          aria-label={`Go to note ${a.n}`}
          style={{ background: "none", border: "none", padding: "0 3px", cursor: "pointer", verticalAlign: "baseline" }}
        >
          <Numeral n={a.n} />
        </button>
      ),
    })),
  ];

  return (
    <>
      <Beats proseRef={proseRef} marksFor={marksFor} />

      <div ref={ledgerRef} style={{ marginTop: 56 }}>
        <h2 style={{ ...DISPLAY_LG, margin: "0 0 6px" }}>What you asked this paper</h2>
        <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 16px" }}>
          {asks.length === 0
            ? "Nothing yet. Highlight a sentence above and the question lands here, numbered, with its passage."
            : `${asks.length} question${asks.length === 1 ? "" : "s"}, in the order you asked them.`}
        </p>
        {asks.map(ask => (
          <div key={ask.id} data-row={ask.id} data-ask-ui style={{ borderTop: BORDER, padding: "14px 0" }}>
            <button
              onClick={() => toggle(ask.id)}
              aria-expanded={ask.open}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <Numeral n={ask.n} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...BODY_STYLE, fontWeight: 600, display: "block" }}>{ask.question}</span>
                <span style={{ ...BODY_SM, color: DIM, fontStyle: "italic", display: "block", marginTop: 2 }}>
                  <span style={{ background: hue }}>&ldquo;{quoteLine(ask.selection, 96)}&rdquo;</span>
                </span>
              </span>
              <ChevronDown size={16} style={{ flexShrink: 0, transform: ask.open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
            </button>
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

      {pick && (
        <div
          data-ask-ui
          style={{
            position: "fixed", zIndex: 60, width: 360,
            left: Math.min(Math.max(12, pick.right - 180), window.innerWidth - 372),
            top: Math.min(pick.bottom + 10, window.innerHeight - 80),
            display: "flex", border: BORDER, boxShadow: SHADOW, background: SURFACE,
          }}
        >
          <AskField onSubmit={submit} onCancel={() => setPick(null)} />
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   F. Unfurl in place
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The answer opens inside the sentence, where the question was. The paragraph
 * splits at the end of the passage, the answer unfurls in the paper's wash, and
 * closing it does not leave a panel behind: the answer contracts to a chip that
 * sits inline in the prose, so a paragraph you asked four questions about reads
 * as a paragraph with four small chips in it.
 *
 * The most aggressive of the six, and the only one where an answer moves the
 * text you were reading. It earns that by making the fold genuinely free.
 */
function Unfurl({ hue }: { hue: string }) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = usePick(proseRef);
  const { start, toggle, forSection } = useAsks();

  const submit = (question: string) => {
    if (!pick) return;
    start(pick.text, pick.section, question);
    setPick(null);
  };

  const marksFor = (key: string): Mark[] => [
    ...(pick && pick.section === key ? [{ id: "live", text: pick.text, fill: hue }] : []),
    ...forSection(key).map(ask => ({
      id: ask.id,
      text: ask.selection,
      fill: hue,
      trailing: ask.open ? (
        <span
          data-ask-ui
          style={{
            display: "block", background: hue, border: BORDER, margin: "12px 0",
            padding: "12px 14px",
          }}
        >
          <button
            onClick={() => toggle(ask.id)}
            aria-expanded
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <span style={{ ...BODY_SM, fontWeight: 600, flex: 1 }}>{ask.question}</span>
            <ChevronDown size={16} style={{ flexShrink: 0, transform: "rotate(180deg)" }} />
          </button>
          <span style={{ display: "block", background: SURFACE, marginTop: 10, padding: "12px 14px" }}>
            {ask.answer
              ? <span style={{ ...BODY_STYLE, display: "block" }}>{ask.answer}</span>
              : <Waiting compact />}
          </span>
        </span>
      ) : (
        <button
          data-ask-ui
          onClick={() => toggle(ask.id)}
          aria-expanded={false}
          style={{
            ...BODY_SM, fontWeight: 600, background: SURFACE, border: BORDER_HAIR,
            padding: "0 6px", margin: "0 4px", cursor: "pointer", color: INK,
            display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "baseline",
          }}
        >
          {quoteLine(ask.question, 34)}
          <ChevronDown size={12} />
        </button>
      ),
    })),
  ];

  return (
    <>
      <Beats proseRef={proseRef} marksFor={marksFor} as="div" />
      {pick && (
        <div
          data-ask-ui
          style={{
            position: "fixed", zIndex: 60, width: 360,
            left: Math.min(Math.max(12, pick.right - 180), window.innerWidth - 372),
            top: Math.min(pick.bottom + 10, window.innerHeight - 80),
            display: "flex", border: BORDER, boxShadow: SHADOW, background: SURFACE,
          }}
        >
          <AskField onSubmit={submit} onCancel={() => setPick(null)} />
        </div>
      )}
    </>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

interface VariantSpec {
  key: string;
  tab: string;
  note: string;
  cost: string;
  render: (props: { hue: string }) => React.ReactNode;
}

const VARIANTS: VariantSpec[] = [
  {
    key: "caption",
    tab: "Caption band",
    note: "What ships today, with the missing half put back. The answer keeps its indent behind the 2px rule, and the rule gets a head: your question, filled in the paper's hue, and the head is the control. Folded, the answer is still a sentence you can read.",
    cost: "Cheapest to build. Still pushes the paragraph you were reading down the page.",
    render: props => <CaptionBand {...props} />,
  },
  {
    key: "margin",
    tab: "Margin notes",
    note: "The footnote. The passage takes a numeral, you type out in the margin where the answer will appear, and every note sits level with the line it came from. The read is never interrupted, not by one line.",
    cost: "Needs a wide window, and the notes have to shove each other around when two questions land close together.",
    render: props => <MarginNotes {...props} />,
  },
  {
    key: "cards",
    tab: "Pinned cards",
    note: "Answers as objects. Each is a full card in the rail, headed by its question, tied to its passage by a numeral. Hover a card and its passage darkens in the text. The bar holds the quoted passage above the field while you type.",
    cost: "The rail is a second column to keep an eye on, and the tie to the passage is a number rather than a position.",
    render: props => <PinnedCards {...props} />,
  },
  {
    key: "command",
    tab: "Command bar",
    note: "Nothing floats over the sentence. Highlighting arms a bar docked to the bottom of the window holding the passage as a chip, always in the same place. Answers are full-width bands ruled top and bottom with the question as a caption column.",
    cost: "The bar is far from your eyes and hands. It is the only one of the six that works unchanged on a phone.",
    render: props => <CommandBar {...props} />,
  },
  {
    key: "ledger",
    tab: "Ledger",
    note: "The archive. Nothing lands in the read: the passage takes a numbered stamp and the answer goes to a numbered ledger at the foot of the page. Click a stamp to open its row. The paper stays exactly as long as it started.",
    cost: "The answer is nowhere near the passage, so every read costs a jump. Best if you ask a lot.",
    render: props => <Ledger {...props} />,
  },
  {
    key: "unfurl",
    tab: "Unfurl in place",
    note: "The answer opens inside the sentence and closing it leaves nothing behind but a chip sitting inline in the prose. A paragraph you asked four questions about reads as a paragraph with four small chips in it.",
    cost: "The most aggressive. An answer moves the text you were reading, and long answers make the paragraph very tall.",
    render: props => <Unfurl {...props} />,
  },
];

export default function HighlightAskPrototype() {
  const [variant, setVariant] = useState(VARIANTS[0].key);
  const [paper, setPaper] = useState(0);
  const active = useMemo(() => VARIANTS.find(v => v.key === variant) ?? VARIANTS[0], [variant]);
  const hue = washSlots(paper)[0];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto" }} className="px-5 md:px-8 pt-6 pb-32">
      <h1 style={{ ...DISPLAY_LG, margin: 0 }}>Highlight to ask, six ways</h1>
      <p style={{ ...BODY_STYLE, color: DIM, margin: "8px 0 0", maxWidth: 720 }}>
        Select any sentence in the walkthrough below. All six share the settled
        parts: the drag is the ordinary ink highlight, the passage turns the
        paper&rsquo;s colour when you let go, there is one verb (Ask), and pressing
        Ask with an empty field asks &ldquo;{DEFAULT_QUESTION}&rdquo;. What differs is where
        the bar shows up, where the answer lands, and what a folded answer looks
        like. No model behind the page, so the answer is fixed and arrives on a
        timer.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, margin: "24px 0 0" }}>
        {VARIANTS.map(v => (
          <NavTab key={v.key} active={v.key === variant} onClick={() => setVariant(v.key)}>
            {v.tab}
          </NavTab>
        ))}
      </div>

      <div style={{ borderTop: BORDER, marginTop: 12, paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 320, maxWidth: 760 }}>
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

      <div style={{ marginTop: 36 }}>
        {/* Keyed so switching tabs starts the variant clean rather than
            inheriting the last one's answers in a layout that never held them. */}
        <React.Fragment key={active.key}>{active.render({ hue })}</React.Fragment>
      </div>
    </div>
  );
}

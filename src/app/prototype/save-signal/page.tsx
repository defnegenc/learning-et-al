"use client";

import { useEffect, useState } from "react";
import { BookCheck, BookOpen, BookPlus } from "lucide-react";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  INK, SURFACE, SHADOW, Segmented, wash,
} from "@/components/design-system";

/*
 * The save signal, round four: /prototype/save-signal.
 *
 * Changes from round three:
 *
 *  · "Read it for me" moves BEFORE the click: it is the control's resting
 *    label, beside the book-plus icon, so the delegation is an invitation
 *    rather than unexplained feedback. The open question is fit, so the
 *    compact section includes an idle card with a long title to judge it.
 *  · Click goes straight to "Reading" with the stepped ellipsis, then the
 *    label disappears and the icon settles to the checked book.
 *  · The door into the reading view sits to the RIGHT of "Read paper":
 *    [Read paper ↗ ink] [door → white box].
 *  · The door's label is an open question: the Segmented relabels it live
 *    on every card. "Dig deeper" is deliberately absent; that vocabulary
 *    left the product on 2026-08-20.
 */

const SAMPLE = {
  title: "Emergent deception in reward-optimised dialogue agents",
  byline: "Nadia Osei & Piotr Waleski · arXiv, 2026",
  hero: "Optimise a chatbot hard enough for approval and it learns to say what raters want to hear, which is not what it computed.",
};

const SAMPLE_2 = {
  title: "Gut microbial succession after broad-spectrum antibiotics",
  byline: "Lena Fischer, Tomás Aguilar et al. · Cell Host & Microbe, 2025",
  hero: "The community that returns is not the one that left: the rare species that anchor the network can be gone for good.",
};

type Door = "learnmore" | "godeeper" | "walkme" | "mycopy" | "explain" | "breakdown";

const DOORS: { key: Door; label: string }[] = [
  { key: "learnmore", label: "Learn more" },
  { key: "godeeper", label: "Go deeper" },
  { key: "walkme", label: "Walk me through" },
  { key: "mycopy", label: "My copy" },
  { key: "explain", label: "Explain it" },
  { key: "breakdown", label: "Break it down" },
];

const DOOR_NOTES: Record<Door, string> = {
  learnmore: "The baseline. Says why you'd go, but it is the most generic phrase on the web; every cookie banner has one.",
  godeeper: "Promises depth rather than information. Two words, fits everywhere, and pairs naturally with a paper you already skimmed.",
  walkme: "Names exactly what the reading view is: a walkthrough. Warmest of the set, and the longest; watch it beside Read paper.",
  mycopy: "The library metaphor doing the work: the publisher has the paper, your shelf has YOUR copy, annotated by the librarian. Shortest, and the only one that explains why both buttons exist.",
  explain: "The reader's actual wish, in the reader's words. Risks sounding like a one-line answer rather than a full walkthrough.",
  breakdown: "Promises the paper taken apart into pieces. Direct, a little louder in tone than the rest of the product.",
};

type Phase = "idle" | "reading" | "done";

const READING_MS = 2600;

function ShelfControl({ phase, onClick }: { phase: Phase; onClick: () => void }) {
  const Icon = phase === "reading" ? BookOpen : phase === "done" ? BookCheck : BookPlus;
  const color = phase === "idle" ? DIM : INK;
  const label = phase === "idle" ? "Read it for me" : phase === "reading" ? "Reading" : null;

  return (
    <button
      onClick={onClick}
      title={phase === "done" ? "On your shelf. Click to take it back off." : "Read it for me"}
      aria-label={phase === "done" ? "On your shelf" : "Read it for me"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        background: "none", border: "none", padding: 0, cursor: "pointer", color,
      }}
    >
      <Icon size={18} color={color} strokeWidth={phase === "idle" ? 2 : 2.5} />
      {label && (
        <span style={{ ...BODY_SM, fontWeight: 600, color, whiteSpace: "nowrap" }}>
          {label}
          {phase === "reading" && (
            <span aria-hidden>
              <span className="proto-dot">.</span>
              <span className="proto-dot" style={{ animationDelay: "0.4s" }}>.</span>
              <span className="proto-dot" style={{ animationDelay: "0.8s" }}>.</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function DoorBox({ label }: { label: string }) {
  return (
    <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: SURFACE, color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
      {label} &rarr;
    </span>
  );
}

function ReadPaperBox() {
  return (
    <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: INK, color: SURFACE, cursor: "pointer", whiteSpace: "nowrap" }}>
      Read paper ↗
    </span>
  );
}

function ShelfCard({ washIndex, initialPhase, sample, door, compact }: {
  washIndex: number; initialPhase: Phase; sample: typeof SAMPLE; door: string; compact?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(initialPhase);

  useEffect(() => {
    if (phase !== "reading") return;
    const t = setTimeout(() => setPhase("done"), READING_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      style={{
        ...wash(washIndex), border: BORDER, boxShadow: SHADOW,
        padding: compact ? "16px 18px" : "22px 24px",
        display: "flex", flexDirection: "column", gap: 10, height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{sample.title}</h3>
        <ShelfControl phase={phase} onClick={() => setPhase(phase === "idle" ? "reading" : "idle")} />
      </div>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      {!compact && <p style={{ ...BODY_STYLE, margin: 0 }}>{sample.hero}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }}>
        <ReadPaperBox />
        {phase === "done" && <DoorBox label={door} />}
      </div>
    </div>
  );
}

/** A vault card: already on the shelf, so the door is always visible. */
function VaultCard({ washIndex, sample, remember, door }: {
  washIndex: number; sample: typeof SAMPLE; remember: string; door: string;
}) {
  return (
    <div
      style={{
        ...wash(washIndex), border: BORDER, boxShadow: SHADOW,
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{sample.title}</h3>
        <span title="On your shelf" style={{ flexShrink: 0 }}>
          <BookCheck size={18} color={INK} strokeWidth={2.5} />
        </span>
      </div>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      <p style={{ ...BODY_STYLE, margin: "2px 0 0" }}>{remember}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto", paddingTop: 6 }}>
        <DoorBox label={door} />
      </div>
    </div>
  );
}

export default function SaveSignalPrototype() {
  const [door, setDoor] = useState<Door>("learnmore");
  const doorLabel = DOORS.find(d => d.key === door)!.label;

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>Read it for me</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          Round four. &ldquo;Read it for me&rdquo; is now the control&rsquo;s resting label,
          so the delegation is an invitation instead of unexplained feedback; click it and
          it goes straight to &ldquo;Reading&rdquo;, then settles to the checked book. The
          door into the reading view sits to the right of &ldquo;Read paper&rdquo;, and the
          Segmented below relabels it live on every card.
        </p>

        <Segmented
          value={door}
          onChange={setDoor}
          options={DOORS}
          style={{ maxWidth: 900, marginBottom: 12 }}
        />
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 28px", maxWidth: 640 }}>{DOOR_NOTES[door]}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, marginBottom: 48 }}>
          <ShelfCard washIndex={0} initialPhase="idle" sample={SAMPLE} door={doorLabel} />
          <ShelfCard washIndex={1} initialPhase="done" sample={SAMPLE_2} door={doorLabel} />
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>Compact: does the resting label fit?</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          The worry about &ldquo;Read it for me&rdquo; is width. Here it sits beside a long
          title at the rail&rsquo;s card size, idle on the left and finished on the right.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, marginBottom: 48 }}>
          <ShelfCard washIndex={2} initialPhase="idle" sample={SAMPLE} door={doorLabel} compact />
          <ShelfCard washIndex={3} initialPhase="done" sample={SAMPLE_2} door={doorLabel} compact />
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>In the vault</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          Everything here is already on the shelf: the checked book replaces the control and
          the door is visible on every card.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
          <VaultCard
            washIndex={0}
            sample={SAMPLE}
            door={doorLabel}
            remember="Optimise a chatbot hard enough for approval and it learns to say what raters want to hear."
          />
          <VaultCard
            washIndex={3}
            sample={SAMPLE_2}
            door={doorLabel}
            remember="Most species come back within weeks, but the rare ones that anchor the network can be gone for good."
          />
        </div>
      </div>

      <style>{`
        .proto-dot {
          animation: protoDotBlink 1.2s steps(1, end) infinite;
          opacity: 0;
        }
        @keyframes protoDotBlink {
          0% { opacity: 1; }
          100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .proto-dot { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BookCheck, BookOpen, BookPlus } from "lucide-react";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  INK, SURFACE, SHADOW, Segmented, wash,
} from "@/components/design-system";

/*
 * The save signal, round six: /prototype/save-signal.
 *
 * The decision: two buttons at the bottom right.
 *
 *  1. "Read paper ↗": the ink button it always was, linking out to the
 *     publisher.
 *  2. "Read it for me": a white-box button with the book-plus icon. It IS
 *     the save control, and it moves through the same states in place:
 *     click it and the book opens ("Reading" with the stepped ellipsis),
 *     and when the librarian is done the button becomes the door into the
 *     reading view: the checked book plus the door label.
 *
 * The top-right corner is empty; the title owns its row. The door's label
 * is still an open question, so the Segmented relabels the done state live.
 * In the product, clicking the done button opens /library/[id]; here it
 * resets the card so the sequence can replay.
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

type Phase = "idle" | "reading" | "done";

const READING_MS = 2600;

const BOX: React.CSSProperties = {
  ...DISPLAY_SM,
  padding: "6px 14px",
  border: BORDER,
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

function ReadPaperButton() {
  return (
    <span style={{ ...BOX, background: INK, color: SURFACE }}>Read paper ↗</span>
  );
}

/** The save control as a button: Read it for me → Reading… → the door. */
function DelegateButton({ phase, door, onClick }: { phase: Phase; door: string; onClick: () => void }) {
  const Icon = phase === "reading" ? BookOpen : phase === "done" ? BookCheck : BookPlus;
  return (
    <button
      onClick={onClick}
      title={
        phase === "idle" ? "The librarian reads it and saves it to your shelf" :
        phase === "reading" ? "Reading it for you" :
        "Open the reading view"
      }
      style={{ ...BOX, background: SURFACE, color: INK }}
    >
      <Icon size={16} strokeWidth={2.5} />
      {phase === "idle" && <span>Read it for me</span>}
      {phase === "reading" && (
        <span>
          Reading
          <span aria-hidden>
            <span className="proto-dot">.</span>
            <span className="proto-dot" style={{ animationDelay: "0.4s" }}>.</span>
            <span className="proto-dot" style={{ animationDelay: "0.8s" }}>.</span>
          </span>
        </span>
      )}
      {phase === "done" && <span>{door} &rarr;</span>}
    </button>
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
      <h3 style={{ ...DISPLAY_SM, margin: 0 }}>{sample.title}</h3>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      {!compact && <p style={{ ...BODY_STYLE, margin: 0 }}>{sample.hero}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }}>
        <ReadPaperButton />
        <DelegateButton
          phase={phase}
          door={door}
          onClick={() => setPhase(phase === "idle" ? "reading" : "idle")}
        />
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
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>Two buttons, bottom right</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          The decision. &ldquo;Read paper ↗&rdquo; is the ink button it always was, linking
          out. &ldquo;Read it for me&rdquo; is the save control as a white-box button with
          the book-plus icon; it reads in place (open book, stepped ellipsis) and then
          becomes the door into the reading view (checked book). Click the done button here
          to reset and replay; in the product it opens the reading view.
        </p>

        <div style={{ ...BODY_SM, fontWeight: 600, marginBottom: 8 }}>The door&rsquo;s label</div>
        <Segmented value={door} onChange={setDoor} options={DOORS} style={{ maxWidth: 760, marginBottom: 28 }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, marginBottom: 44 }}>
          <ShelfCard washIndex={0} initialPhase="idle" sample={SAMPLE} door={doorLabel} />
          <ShelfCard washIndex={1} initialPhase="done" sample={SAMPLE_2} door={doorLabel} />
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>Compact: the rail and the vault</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          The same two buttons at the compact size. In the vault everything is already
          read, so its cards simply sit in the done state: the door beside the source.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
          <ShelfCard washIndex={2} initialPhase="idle" sample={SAMPLE} door={doorLabel} compact />
          <ShelfCard washIndex={3} initialPhase="done" sample={SAMPLE_2} door={doorLabel} compact />
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

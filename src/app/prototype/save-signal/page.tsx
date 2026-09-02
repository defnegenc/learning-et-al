"use client";

import { useEffect, useState } from "react";
import { BookCheck, BookOpen, BookPlus } from "lucide-react";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  INK, SURFACE, SHADOW, wash,
} from "@/components/design-system";

/*
 * The save signal, round three: /prototype/save-signal.
 *
 * Round two settled the direction; this is the chosen flow, tuned:
 *
 *  · The control is called "Add to shelf" and is an ICON, no resting label:
 *    a book with a plus. The name lives in the tooltip. No shelf-line
 *    sentence, no extra copy anywhere on the card.
 *  · The control only speaks while something is happening. Click it and it
 *    says "Read it for me" (your delegation, spoken), then "Reading" with a
 *    stepped loading ellipsis while the librarian preps, then falls back to
 *    an icon: an open book while reading, a checked book once done.
 *  · The outcome is a new action, not a sentence: "Learn more" appears at
 *    the bottom right in a white box, beside the ink "Read paper". Learn
 *    more opens the reading view; Read paper stays the publisher link.
 *  · The vault shows "Learn more" on every card, same white box, so the
 *    door into the reading view is visible wherever a saved paper is.
 *
 * Both digest cards are interactive: click the book icon to run the whole
 * sequence, click it again on a finished card to take the paper back off
 * the shelf.
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

type Phase = "idle" | "spoken" | "reading" | "done";

const SPOKEN_MS = 900;
const READING_MS = 2600;

function ShelfControl({ phase, onClick }: { phase: Phase; onClick: () => void }) {
  const Icon = phase === "reading" ? BookOpen : phase === "done" ? BookCheck : BookPlus;
  const color = phase === "idle" ? DIM : INK;
  const label =
    phase === "spoken" ? "Read it for me" :
    phase === "reading" ? "Reading" : null;

  return (
    <button
      onClick={onClick}
      title={phase === "done" ? "On your shelf. Click to take it back off." : "Add to shelf"}
      aria-label={phase === "done" ? "On your shelf" : "Add to shelf"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        background: "none", border: "none", padding: 0, cursor: "pointer", color,
      }}
    >
      <Icon size={18} color={color} strokeWidth={phase === "idle" ? 2 : 2.5} />
      {label && (
        <span style={{ ...BODY_SM, fontWeight: 600, color }}>
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

function LearnMoreBox() {
  return (
    <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: SURFACE, color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
      Learn more &rarr;
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

function ShelfCard({ washIndex, initialPhase, sample }: {
  washIndex: number; initialPhase: Phase; sample: typeof SAMPLE;
}) {
  const [phase, setPhase] = useState<Phase>(initialPhase);

  useEffect(() => {
    if (phase === "spoken") {
      const t = setTimeout(() => setPhase("reading"), SPOKEN_MS);
      return () => clearTimeout(t);
    }
    if (phase === "reading") {
      const t = setTimeout(() => setPhase("done"), READING_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <div
      style={{
        ...wash(washIndex), border: BORDER, boxShadow: SHADOW,
        padding: "22px 24px", display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{sample.title}</h3>
        <ShelfControl phase={phase} onClick={() => setPhase(phase === "idle" ? "spoken" : "idle")} />
      </div>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      <p style={{ ...BODY_STYLE, margin: 0 }}>{sample.hero}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 6 }}>
        {phase === "done" && <LearnMoreBox />}
        <ReadPaperBox />
      </div>
    </div>
  );
}

/** A vault card: everything here is on the shelf, so Learn more is always visible. */
function VaultCard({ washIndex, sample, remember }: {
  washIndex: number; sample: typeof SAMPLE; remember: string;
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
        <LearnMoreBox />
      </div>
    </div>
  );
}

export default function SaveSignalPrototype() {
  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>Add to shelf</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          The chosen flow. The control is an icon called &ldquo;Add to shelf&rdquo; and it
          only speaks while something happens: click it and it says &ldquo;Read it for
          me&rdquo;, then &ldquo;Reading&rdquo; while the librarian preps, then goes back
          to being an icon. What you get is a new action: &ldquo;Learn more&rdquo; in a
          white box, bottom right, next to &ldquo;Read paper&rdquo;. Click the checked
          book on a finished card to take it back off the shelf and replay.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, marginBottom: 48 }}>
          <ShelfCard washIndex={0} initialPhase="idle" sample={SAMPLE} />
          <ShelfCard washIndex={1} initialPhase="done" sample={SAMPLE_2} />
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>In the vault</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          Everything in the vault is already on the shelf, so the checked book replaces the
          save control and &ldquo;Learn more&rdquo; is visible on every card: the door into
          the reading view, wherever a saved paper is.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
          <VaultCard
            washIndex={0}
            sample={SAMPLE}
            remember="Optimise a chatbot hard enough for approval and it learns to say what raters want to hear."
          />
          <VaultCard
            washIndex={3}
            sample={SAMPLE_2}
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

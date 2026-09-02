"use client";

import { useEffect, useState } from "react";
import { BookCheck, BookOpen, BookPlus } from "lucide-react";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  INK, SURFACE, SHADOW, Segmented, wash,
} from "@/components/design-system";

/*
 * The save signal, round five: /prototype/save-signal.
 *
 * The two paper actions become the SAME text treatment: "Read it for me"
 * (the delegation, starts the librarian) and the source link (an arrow
 * linking out) are both Body/SM 600, a matched pair instead of a text
 * control plus an ink button. Two placements, shown side by side:
 *
 *  · Top right: both stacked in the corner where the save control lives.
 *  · Bottom right: the title owns its row; both actions sit at the foot.
 *
 * The flow is unchanged: click "Read it for me", it reads, the checked book
 * settles in, and the door into the reading view appears as the white box,
 * rightmost. Two Segmenteds relabel things live: the source link's word
 * ("Read paper" / "See paper" / "Read it myself") and the door's label.
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

type LinkWord = "readpaper" | "seepaper" | "readmyself";

const LINK_WORDS: { key: LinkWord; label: string }[] = [
  { key: "readpaper", label: "Read paper" },
  { key: "seepaper", label: "See paper" },
  { key: "readmyself", label: "Read it myself" },
];

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

/** The source link: the same text treatment as the control, with the arrow linking out. */
function PaperLink({ word }: { word: string }) {
  return (
    <span style={{ ...BODY_SM, fontWeight: 600, color: DIM, cursor: "pointer", whiteSpace: "nowrap" }}>
      {word} ↗
    </span>
  );
}

function DoorBox({ label }: { label: string }) {
  return (
    <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: SURFACE, color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
      {label} &rarr;
    </span>
  );
}

function ShelfCard({ washIndex, initialPhase, sample, door, linkWord, placement }: {
  washIndex: number; initialPhase: Phase; sample: typeof SAMPLE;
  door: string; linkWord: string; placement: "top" | "bottom";
}) {
  const [phase, setPhase] = useState<Phase>(initialPhase);

  useEffect(() => {
    if (phase !== "reading") return;
    const t = setTimeout(() => setPhase("done"), READING_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const control = <ShelfControl phase={phase} onClick={() => setPhase(phase === "idle" ? "reading" : "idle")} />;

  return (
    <div
      style={{
        ...wash(washIndex), border: BORDER, boxShadow: SHADOW,
        padding: "22px 24px", display: "flex", flexDirection: "column", gap: 10, height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{sample.title}</h3>
        {placement === "top" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {control}
            <PaperLink word={linkWord} />
          </div>
        )}
      </div>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      <p style={{ ...BODY_STYLE, margin: 0 }}>{sample.hero}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }}>
        {placement === "bottom" && control}
        {placement === "bottom" && <PaperLink word={linkWord} />}
        {phase === "done" && <DoorBox label={door} />}
      </div>
    </div>
  );
}

export default function SaveSignalPrototype() {
  const [linkWord, setLinkWord] = useState<LinkWord>("readpaper");
  const [door, setDoor] = useState<Door>("learnmore");
  const linkLabel = LINK_WORDS.find(w => w.key === linkWord)!.label;
  const doorLabel = DOORS.find(d => d.key === door)!.label;

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>A matched pair</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          Round five. &ldquo;Read it for me&rdquo; and the source link now wear the same
          text treatment: two ways to read the same paper, one delegated and one linking
          out. Both placements below, with both cards interactive; the left card of each
          pair starts idle, the right one finished.
        </p>

        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 32 }}>
          <div>
            <div style={{ ...BODY_SM, fontWeight: 600, marginBottom: 8 }}>The link&rsquo;s word</div>
            <Segmented value={linkWord} onChange={setLinkWord} options={LINK_WORDS} style={{ minWidth: 340 }} />
          </div>
          <div>
            <div style={{ ...BODY_SM, fontWeight: 600, marginBottom: 8 }}>The door&rsquo;s label</div>
            <Segmented value={door} onChange={setDoor} options={DOORS} style={{ minWidth: 560 }} />
          </div>
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>Both in the top right</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          The pair stacks in the corner the save control already owns. The foot stays empty
          until the door earns its place there.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, marginBottom: 44 }}>
          <ShelfCard washIndex={0} initialPhase="idle" sample={SAMPLE} door={doorLabel} linkWord={linkLabel} placement="top" />
          <ShelfCard washIndex={1} initialPhase="done" sample={SAMPLE_2} door={doorLabel} linkWord={linkLabel} placement="top" />
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>Both in the bottom right</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          The title owns its row; everything you can do with the paper lives at the foot,
          reading left to right as it happens: delegate, link out, and (once read) the door.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
          <ShelfCard washIndex={2} initialPhase="idle" sample={SAMPLE} door={doorLabel} linkWord={linkLabel} placement="bottom" />
          <ShelfCard washIndex={3} initialPhase="done" sample={SAMPLE_2} door={doorLabel} linkWord={linkLabel} placement="bottom" />
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

"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, Segmented, SHADOW, SURFACE, wash,
} from "@/components/design-system";

/*
 * The save signal, round two: /prototype/save-signal.
 *
 * Round one tried four shapes; the shelf line won (saving appends a foot line
 * to the card: where the paper went, plus the door to the reading view). This
 * round keeps the shelf line on every card and varies the LANGUAGE instead:
 * what the control says before, during, and after.
 *
 * One rule hangs over all of it (CLAUDE.md): the save control has exactly one
 * name. Whatever wins here replaces "Save"/"Saved" EVERYWHERE (the tip strip,
 * the first-save panel, the vault empty state), never joins them.
 *
 *  · Save          : ships today, the baseline to beat.
 *  · Keep          : archive vocabulary; "kept" is what you do to something
 *                    you're not done with.
 *  · Shelve        : the library metaphor said out loud; pairs with the vault.
 *  · Learn more    : wildcard. One verb does everything: it saves AND opens
 *                    the reading view. There is no separate bookmark.
 *  · Read it for me: wildcard. Save as delegation to the librarian; the label
 *                    moves through tenses as the prep actually runs.
 *
 * All cards are interactive. "Read it for me" simulates prep with a timer.
 */

type Scheme = "save" | "keep" | "shelve" | "learnmore" | "readforme";

const OPTIONS: { key: Scheme; label: string }[] = [
  { key: "save", label: "Save" },
  { key: "keep", label: "Keep" },
  { key: "shelve", label: "Shelve" },
  { key: "learnmore", label: "Learn more" },
  { key: "readforme", label: "Read it for me" },
];

const NOTES: Record<Scheme, string> = {
  save:
    "The baseline. \"Save\" is honest and universal, but it describes filing, not what actually happens: a librarian starts reading. The shelf line has to carry all of that meaning by itself.",
  keep:
    "\"Keep\" is warmer than \"save\": you keep what you are not done with. Still one syllable, still instantly clear, and \"Kept\" reads as a state rather than a past action.",
  shelve:
    "The library metaphor said out loud. It matches where the paper lands (your shelf, your library) and gives the vault language to inherit. Risk: \"shelve\" also means \"set aside and forget\" in normal speech.",
  learnmore:
    "The wildcard that collapses two actions into one: \"Learn more\" saves the paper AND opens the reading view, because wanting to learn more is the only reason anyone saves. Cost: you can no longer keep a paper for later without opening it now.",
  readforme:
    "Save as delegation. You are not filing a document, you are handing it to someone: the label moves through \"Read it for me\", then \"Reading it for you\" while prep runs, then \"Read for you\". The control itself becomes the status, and the first-save panel's explanation stops being needed.",
};

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

/** unsaved control word · saved control word · shelf-line lead · shelf-line rest */
const WORDS: Record<Exclude<Scheme, "learnmore" | "readforme">, {
  unsaved: string; saved: string; lead: string; rest: string;
}> = {
  save: { unsaved: "Save", saved: "Saved", lead: "In your library.", rest: "The librarian is reading it now." },
  keep: { unsaved: "Keep", saved: "Kept", lead: "Kept.", rest: "The librarian is reading it now." },
  shelve: { unsaved: "Shelve", saved: "Shelved", lead: "On your shelf.", rest: "The librarian is reading it now." },
};

function BookmarkWord({ saved, word, onToggle, busy }: {
  saved: boolean; word: string; onToggle: () => void; busy?: boolean;
}) {
  const color = saved ? INK : DIM;
  return (
    <button
      onClick={onToggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        background: "none", border: "none", padding: 0, cursor: "pointer",
      }}
    >
      <Bookmark size={16} fill={saved ? color : "none"} color={color} />
      <span style={{ ...BODY_SM, fontWeight: 600, color, fontStyle: busy ? "italic" : "normal" }}>{word}</span>
    </button>
  );
}

function ShelfLine({ lead, rest, door }: { lead: string; rest: string; door: string }) {
  return (
    <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
      <span style={{ ...BODY_SM }}>
        <strong style={{ fontWeight: 600 }}>{lead}</strong> {rest}
      </span>
      <span style={{ ...DISPLAY_SM, cursor: "pointer", whiteSpace: "nowrap" }}>{door} &rarr;</span>
    </div>
  );
}

function Frame({ washIndex, compact, sample, control, foot }: {
  washIndex: number; compact?: boolean; sample: typeof SAMPLE;
  control: React.ReactNode; foot: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...wash(washIndex), border: BORDER, boxShadow: SHADOW,
        padding: compact ? "16px 18px" : "22px 24px",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{sample.title}</h3>
        {control}
      </div>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      {!compact && <p style={{ ...BODY_STYLE, margin: 0 }}>{sample.hero}</p>}
      {foot}
    </div>
  );
}

/** Save / Keep / Shelve: bookmark control, shelf line appears on save. */
function WordCard({ scheme, washIndex, initialSaved, sample, compact }: {
  scheme: "save" | "keep" | "shelve"; washIndex: number; initialSaved: boolean;
  sample: typeof SAMPLE; compact?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const w = WORDS[scheme];
  return (
    <Frame
      washIndex={washIndex} compact={compact} sample={sample}
      control={<BookmarkWord saved={saved} word={saved ? w.saved : w.unsaved} onToggle={() => setSaved(s => !s)} />}
      foot={saved && <ShelfLine lead={w.lead} rest={w.rest} door="Learn more" />}
    />
  );
}

/** Learn more: no bookmark. One ink button saves AND opens the reading view. */
function LearnMoreCard({ washIndex, initialSaved, sample, compact }: {
  washIndex: number; initialSaved: boolean; sample: typeof SAMPLE; compact?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  return (
    <Frame
      washIndex={washIndex} compact={compact} sample={sample}
      control={null}
      foot={
        saved ? (
          <ShelfLine lead="In your library." rest="The reading view opened; it stays yours either way." door="Back to it" />
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              onClick={() => setSaved(true)}
              style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: INK, color: SURFACE, cursor: "pointer" }}
            >
              Learn more &rarr;
            </button>
          </div>
        )
      }
    />
  );
}

/** Read it for me: the label moves through tenses as prep runs (simulated). */
function ReadForMeCard({ washIndex, initialPhase, sample, compact }: {
  washIndex: number; initialPhase: "idle" | "ready"; sample: typeof SAMPLE; compact?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "reading" | "ready">(initialPhase);

  useEffect(() => {
    if (phase !== "reading") return;
    const t = setTimeout(() => setPhase("ready"), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  const word = phase === "idle" ? "Read it for me" : phase === "reading" ? "Reading it for you…" : "Read for you";
  return (
    <Frame
      washIndex={washIndex} compact={compact} sample={sample}
      control={
        <BookmarkWord
          saved={phase !== "idle"}
          busy={phase === "reading"}
          word={word}
          onToggle={() => setPhase(p => (p === "idle" ? "reading" : "idle"))}
        />
      }
      foot={phase === "ready" && <ShelfLine lead="Ready in your library." rest="The walkthrough is waiting." door="Learn more" />}
    />
  );
}

export default function SaveSignalPrototype() {
  const [scheme, setScheme] = useState<Scheme>("save");

  const pair = (compact: boolean) => {
    const a = compact ? 2 : 0;
    const b = compact ? 3 : 1;
    if (scheme === "learnmore") {
      return (
        <>
          <LearnMoreCard washIndex={a} initialSaved={false} sample={SAMPLE} compact={compact} />
          <LearnMoreCard washIndex={b} initialSaved sample={SAMPLE_2} compact={compact} />
        </>
      );
    }
    if (scheme === "readforme") {
      return (
        <>
          <ReadForMeCard washIndex={a} initialPhase="idle" sample={SAMPLE} compact={compact} />
          <ReadForMeCard washIndex={b} initialPhase="ready" sample={SAMPLE_2} compact={compact} />
        </>
      );
    }
    return (
      <>
        <WordCard scheme={scheme} washIndex={a} initialSaved={false} sample={SAMPLE} compact={compact} />
        <WordCard scheme={scheme} washIndex={b} initialSaved sample={SAMPLE_2} compact={compact} />
      </>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>The save signal, round two</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          The shelf line stays on every card; what changes is the language. Whatever wins
          replaces &ldquo;Save&rdquo; everywhere: the control has exactly one name, so this
          is a rename, never a fourth string. Every control here works; click it. The left
          card starts unsaved, the right one saved.
        </p>

        <Segmented
          value={scheme}
          onChange={setScheme}
          options={OPTIONS}
          style={{ maxWidth: 760, marginBottom: 12 }}
        />
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 28px", maxWidth: 640 }}>{NOTES[scheme]}</p>

        <div key={scheme} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, marginBottom: 40 }}>
          {pair(false)}
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>The same language, compact</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          The rail and the vault render the compact card, so the winning words have to
          survive at this size beside a long title.
        </p>
        <div key={`${scheme}-c`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, marginBottom: 48 }}>
          {pair(true)}
        </div>

        <div style={{ borderTop: HAIRLINE, paddingTop: 32 }}>
          <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>&ldquo;Learn more&rdquo; replaces &ldquo;Read paper&rdquo;</h2>
          <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
            The card&rsquo;s primary action goes to the reading view and says why you&rsquo;d
            go: you are learning more about this paper, not fetching a PDF. The publisher
            link becomes a word in the byline.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
            <div style={{ border: BORDER, padding: "16px 18px" }}>
              <div style={{ ...BODY_SM, fontWeight: 600, marginBottom: 10 }}>Today</div>
              <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginBottom: 12 }}>{SAMPLE.byline}</div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: INK, color: SURFACE }}>
                  Read paper ↗
                </span>
              </div>
            </div>
            <div style={{ border: BORDER, padding: "16px 18px" }}>
              <div style={{ ...BODY_SM, fontWeight: 600, marginBottom: 10 }}>Proposed</div>
              <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginBottom: 12 }}>
                {SAMPLE.byline} · <span style={{ textDecoration: "underline", cursor: "pointer" }}>Source ↗</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: BORDER, background: INK, color: SURFACE }}>
                  Learn more &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

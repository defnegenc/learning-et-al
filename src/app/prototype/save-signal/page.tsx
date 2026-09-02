"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import {
  ACID_GREEN, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, Segmented, SHADOW, SURFACE, wash, washSlots,
} from "@/components/design-system";

/*
 * The save signal: /prototype/save-signal.
 *
 * The complaint: on the digest a saved paper differs from an unsaved one by a
 * 16px bookmark swapping outline for fill, and nothing else. Saving is the
 * single strongest thing a reader can do (it starts the librarian reading),
 * and the card barely registers it.
 *
 * Four candidates, each built only from moves the menu already sanctions.
 * Every card here is interactive: click its save control and watch the state
 * change. The cards are local mockups of the digest card's header, not the
 * production component, because the candidates change the control itself.
 *
 *  · Acid tick  : the bookmark and its word turn acid green when saved. The
 *                  menu names acid green as "confirmation that something
 *                  stuck: the bookmark fill", so this is arguably the drawn
 *                  design, never implemented (the code fills ink).
 *  · Shadow     : the card's hard shadow recolours from ink to the card's own
 *                  wash hue when saved. "Colour falls behind things" is the one
 *                  sanctioned colour-beside-ink move; a saved card literally
 *                  gets its colour filed behind it.
 *  · Button     : the control becomes a real button, Display/SM like every
 *                  button: outline "Save", ink-filled "Saved". Loudest, and the
 *                  most honest about being an action rather than an icon.
 *  · Shelf line : saving appends a foot line to the card: a bold body-face
 *                  lead-in ("In your library.") plus "Open the reading view →",
 *                  which also answers how you get from a digest card to
 *                  /library/[id].
 */

type Variant = "acid" | "shadow" | "button" | "shelfline";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "acid", label: "Acid tick" },
  { key: "shadow", label: "Shadow" },
  { key: "button", label: "Button" },
  { key: "shelfline", label: "Shelf line" },
];

const NOTES: Record<Variant, string> = {
  acid:
    "Green is this product's word for \"that worked\", and the menu already assigns it to the bookmark fill. Cheapest change, stays in the corner, but it is still a 16px signal.",
  shadow:
    "The whole card announces the save without adding a single element: the one shadow recolours to the card's own hue. Reads at a glance across a full digest, and unsaved cards stay exactly as they are.",
  button:
    "Every button is Display/SM upper, so the save was arguably always meant to be one. Unmissable, and the filled state doubles as the saved marker. Costs the card corner some quiet.",
  shelfline:
    "The card grows a consequence, not just a state: it tells you where the paper went and offers the door to it. This one also solves the digest-to-reading-view gap on its own.",
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

function SaveControl({ variant, saved, onToggle }: { variant: Variant; saved: boolean; onToggle: () => void }) {
  if (variant === "button") {
    return (
      <button
        onClick={onToggle}
        style={{
          ...DISPLAY_SM,
          padding: "6px 14px",
          border: BORDER,
          background: saved ? INK : SURFACE,
          color: saved ? SURFACE : INK,
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 140ms, color 140ms",
        }}
      >
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  const acid = variant === "acid" && saved;
  const color = acid ? ACID_GREEN : saved ? INK : DIM;
  return (
    <button
      onClick={onToggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        background: "none", border: "none", padding: 0, cursor: "pointer",
      }}
      title={saved ? "Remove from your library" : "Save to your library"}
    >
      <Bookmark size={16} fill={saved ? color : "none"} color={color} />
      <span style={{ ...BODY_SM, fontWeight: 600, color }}>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}

function ProtoCard({ variant, washIndex, initialSaved, sample, compact }: {
  variant: Variant;
  washIndex: number;
  initialSaved: boolean;
  sample: typeof SAMPLE;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const hue = washSlots(washIndex)[0];
  const shadow = variant === "shadow" && saved ? `5px 5px 0 0 ${hue}` : SHADOW;

  return (
    <div
      style={{
        ...wash(washIndex),
        border: BORDER,
        boxShadow: shadow,
        padding: compact ? "16px 18px" : "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "box-shadow 140ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{sample.title}</h3>
        <SaveControl variant={variant} saved={saved} onToggle={() => setSaved(s => !s)} />
      </div>
      <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{sample.byline}</div>
      {!compact && <p style={{ ...BODY_STYLE, margin: 0 }}>{sample.hero}</p>}
      {variant === "shelfline" && saved && (
        <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{ ...BODY_SM }}>
            <strong style={{ fontWeight: 600 }}>In your library.</strong> The librarian is reading it now.
          </span>
          <span style={{ ...DISPLAY_SM, cursor: "pointer", whiteSpace: "nowrap" }}>Open the reading view &rarr;</span>
        </div>
      )}
    </div>
  );
}

export default function SaveSignalPrototype() {
  const [variant, setVariant] = useState<Variant>("acid");

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>The save signal</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          Four ways a card can register that you saved it, all built from moves the menu
          already allows. Every save control here works: click it. The left card starts
          unsaved, the right one starts saved.
        </p>

        <Segmented
          value={variant}
          onChange={setVariant}
          options={VARIANTS}
          style={{ maxWidth: 640, marginBottom: 12 }}
        />
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 28px", maxWidth: 640 }}>{NOTES[variant]}</p>

        <div key={variant} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, marginBottom: 40 }}>
          <ProtoCard variant={variant} washIndex={0} initialSaved={false} sample={SAMPLE} />
          <ProtoCard variant={variant} washIndex={1} initialSaved sample={SAMPLE_2} />
        </div>

        <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>The same signal, compact</h2>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
          The rail and the vault render the compact card, so whatever wins has to survive
          at this size too.
        </p>
        <div key={`${variant}-c`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, marginBottom: 48 }}>
          <ProtoCard variant={variant} washIndex={2} initialSaved={false} sample={SAMPLE} compact />
          <ProtoCard variant={variant} washIndex={3} initialSaved sample={SAMPLE_2} compact />
        </div>

        <div style={{ borderTop: HAIRLINE, paddingTop: 32 }}>
          <h2 style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>While we are in that corner: what &ldquo;Read paper&rdquo; does</h2>
          <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>
            Today the digest card&rsquo;s one action, &ldquo;Read paper ↗&rdquo;, leaves the product for
            the publisher&rsquo;s page, and nothing on the digest reaches the reading view at all.
            Proposal: the primary action goes to the reading view, and the source link
            becomes a quiet word in the byline.
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
                  Read paper &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

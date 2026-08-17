"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { READING_BODY } from "@/components/paper-card";
import { annotateText, type Jargon } from "./reading-annotate";
import {
  BODY_SM, BODY_STYLE, BORDER_HAIR, DIM, DISPLAY_SM, HAIRLINE, INK, MUTED, SURFACE,
} from "@/components/design-system";

/*
 * The section view — the paper opened one part at a time.
 *
 * WHY THE BUTTONS ARE FIXED AND THE SOURCES ARE NOT
 *
 * Heading detection over five real arXiv extracts (Attention, GPT-3, ResNet,
 * chain-of-thought, BERT) found an introduction and a results section in 5 of 5,
 * related work in 4 of 5 — and a methods section in 3 of 5, a discussion in 1 of
 * 5, and an explicit limitations section in 1 of 5. ResNet calls its method
 * "Deep Residual Learning" and BERT calls its "BERT", so no list of canonical
 * names will ever catch them; most ML papers have no Discussion or Limitations
 * heading at all.
 *
 * So a view whose buttons are the paper's own table of contents would be a
 * different shape for every paper, and would be missing exactly the two parts a
 * non-expert most wants. The buttons are therefore FIXED and phrased the way a
 * reader thinks, and each one records where its answer came from: the paper's own
 * section when there is one, and the whole paper when there isn't. `source` is
 * that provenance, and it is shown rather than hidden — "inferred from the whole
 * paper" is a materially weaker claim than "read out of §3" and the reader is
 * entitled to know which they have.
 */

export interface PaperSection {
  /** Stable id — the fixed slot, not the paper's heading. */
  key: string;
  /** The button, in the reader's language. */
  label: string;
  /** One line, always visible, so the shut list still tells you something. */
  teaser: string;
  /** The paper's own heading, or null when there was nothing to map to. */
  heading: string | null;
  /** How much of the extract this covers — null when inferred. */
  chars: number | null;
  /** Filled lazily: null means "not summarised yet". */
  summary: string | null;
}

/** One row: label, teaser, and the summary behind a disclosure. */
function SectionRow({ section, jargon, hue, defined, onAsk, onExpand }: {
  section: PaperSection;
  jargon: Jargon[];
  hue: string;
  defined: Set<string>;
  onAsk: (scope: string) => void;
  /** Returns the summary — the real thing generates on first open. */
  onExpand: (key: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(section.summary);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && summary === null && !pending) {
      setPending(true);
      const text = await onExpand(section.key);
      setSummary(text);
      setPending(false);
    }
  }

  const provenance = section.heading
    ? `Read out of “${section.heading}”${section.chars ? ` · ${section.chars.toLocaleString()} characters` : ""}`
    : "No such section in this paper — inferred from the whole of it";

  return (
    <div style={{ borderTop: HAIRLINE }}>
      <button
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "flex-start", gap: 14, width: "100%", textAlign: "left",
          background: "transparent", border: "none", padding: "20px 0", cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{ ...DISPLAY_SM, color: MUTED, width: 14, flexShrink: 0, lineHeight: "22px" }}
        >
          {open ? "–" : "+"}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...DISPLAY_SM, display: "block" }}>{section.label}</span>
          <span style={{ ...BODY_STYLE, color: DIM, display: "block", marginTop: 6 }}>{section.teaser}</span>
        </span>
      </button>

      {open && (
        <div style={{ paddingLeft: 28, paddingBottom: 24 }}>
          {pending ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
              <span style={{ ...BODY_STYLE, color: MUTED }}>Reading this part&hellip;</span>
            </div>
          ) : summary ? (
            <>
              <p style={{ ...READING_BODY, margin: 0 }}>{annotateText(summary, jargon, defined, hue)}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
                <button
                  onClick={() => onAsk(section.label)}
                  style={{
                    ...BODY_SM, fontWeight: 600, background: SURFACE, border: BORDER_HAIR,
                    color: INK, padding: "6px 12px", cursor: "pointer",
                  }}
                >
                  Ask about this
                </button>
                <span style={{ ...BODY_SM, color: MUTED }}>{provenance}</span>
              </div>
            </>
          ) : (
            <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic", margin: 0 }}>
              Couldn&rsquo;t read this part.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The list. Nothing is open on load: the point of this view is that you choose
 * what to read, and an accordion that starts expanded is just the walkthrough
 * with extra lines.
 */
export function SectionList({ sections, jargon, hue, onAsk, onExpand }: {
  sections: PaperSection[];
  jargon: Jargon[];
  hue: string;
  onAsk: (scope: string) => void;
  onExpand: (key: string) => Promise<string | null>;
}) {
  // One shared "already defined" set, as in the walkthrough — but keyed per
  // render so reopening a section does not re-chip a term you have already met.
  const defined = new Set<string>();

  return (
    <div>
      <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 8px" }}>
        Open the part you want. Each one is summarised from that part of the paper
        alone, so the answer can&rsquo;t drift in from somewhere else.
      </p>
      {sections.map(s => (
        <SectionRow
          key={s.key}
          section={s}
          jargon={jargon}
          hue={hue}
          defined={defined}
          onAsk={onAsk}
          onExpand={onExpand}
        />
      ))}
    </div>
  );
}

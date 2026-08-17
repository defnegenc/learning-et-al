"use client";

import React from "react";
import { TermChip } from "@/components/today/brief-digest";

export type Jargon = { term: string; def: string };

/**
 * Interleave TermChips into a text block at the first occurrence of each term.
 *
 * `used` is passed in rather than owned, so a term defined in the gist is not
 * defined again three paragraphs later — a reading view is one continuous read,
 * not a set of independent blocks. `tint` is the paper's own wash hue, so the
 * highlight says which paper you are inside.
 *
 * Shared by both reading views. It lives in its own module because the
 * walkthrough and the section list each need it and neither should import the
 * other.
 */
export function annotateText(
  text: string,
  jargon: Jargon[],
  used: Set<string>,
  tint: string,
): React.ReactNode[] {
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
    out.push(
      <TermChip key={key++} text={rest.slice(best.i, best.i + best.len)} def={best.j.def} tint={tint} />,
    );
    rest = rest.slice(best.i + best.len);
  }
  return out;
}

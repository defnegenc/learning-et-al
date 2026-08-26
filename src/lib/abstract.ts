/**
 * Structured abstracts, made readable.
 *
 * Journals publish abstracts pre-chopped into labelled sections: "BACKGROUND:
 * Neglected tropical and vector-borne diseases… METHODS: We collected…". Nobody
 * reading a digest asked for that, but the abstract is what every card falls
 * back to when the pipeline's own summary is missing, so the label lands in the
 * biggest line on the card and the whole page reads like a pasted database row.
 *
 * Stripping the label doesn't make the fallback good. It makes it look like a
 * sentence instead of a failure, which is the most a fallback can do.
 */

// Only real section headings. A general "capitalised words then a colon" rule
// would also eat "Deep learning: a review", which is a lead worth keeping.
const SECTION_LABELS = new Set([
  "abstract", "aim", "aims", "background", "background and aim", "background and aims",
  "background and objective", "background and objectives", "background and purpose",
  "conclusion", "conclusions", "context", "design", "discussion", "findings",
  "importance", "interpretation", "intervention", "interventions", "introduction",
  "key points", "main outcome measures", "materials and methods", "method", "methodology",
  "methods", "objective", "objectives", "outcome", "outcomes", "participants",
  "patients and methods", "purpose", "rationale", "results", "setting", "significance",
  "study design", "summary",
]);

/** Uppercase the first letter, unless the word is already styled (mRNA, iPSC). */
function leadCap(text: string): string {
  if (!/^[a-z]/.test(text)) return text;
  if (/^[a-z][A-Z]/.test(text)) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Drop a leading structured-abstract label. Runs a few times because a lead can
 * stack two of them ("BACKGROUND AND AIMS: OBJECTIVE: …").
 */
export function stripSectionLabel(text: string): string {
  let out = (text || "").trimStart();
  for (let i = 0; i < 3; i++) {
    const match = /^([A-Za-z][A-Za-z ]{1,28}?)\s*:\s*/.exec(out);
    if (!match || !SECTION_LABELS.has(match[1].trim().toLowerCase())) break;
    out = out.slice(match[0].length).trimStart();
  }
  return leadCap(out);
}

/** The first sentence of an abstract, label removed. Used where a summary is missing. */
export function abstractLead(abstract: string): string {
  const clean = stripSectionLabel(abstract).trim();
  return (clean.match(/[^.!?]+[.!?]/)?.[0] ?? clean.slice(0, 180)).trim();
}

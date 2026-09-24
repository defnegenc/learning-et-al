const QUESTION_OPENING = /^(?:who|whom|whose|what|when|where|why|how|which|is|isn't|are|aren't|am|was|wasn't|were|weren't|do|don't|does|doesn't|did|didn't|can|can't|could|couldn't|will|won't|would|wouldn't|should|shouldn't|has|hasn't|have|haven't|had|hadn't|may|might|must)\b/i;

/**
 * A displayed digest theme is always a direct question.
 *
 * A short setup sentence may precede it, as in "Virtual classrooms feel real.
 * Does that help?", so validate the final sentence rather than the first word of
 * the whole headline.
 */
export function themeQuestionProblems(theme: string): string[] {
  const normalized = theme.trim();
  if (!normalized) return ["It is empty."];
  if (!normalized.endsWith("?")) {
    return ["It must be a direct question ending with a question mark, not a statement."];
  }

  const finalSentence = (normalized.split(/[.!]\s+/).at(-1)?.trim() || normalized).replaceAll("’", "'");
  if (!QUESTION_OPENING.test(finalSentence)) {
    return ["Its final sentence only wears a question mark; rewrite it as a direct question with a question word or helping verb."];
  }
  return [];
}

const MODEL_META_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "an AI identity disclaimer", pattern: /\bas (?:an? )?(?:ai|language model)\b/i },
  { label: "a first-person refusal", pattern: /\b(?:i|we)\s+(?:can(?:not|'t)|won't|shouldn't)\s+(?:say|write|use|mention|provide)\b/i },
  { label: "a first-person policy disclaimer", pattern: /\b(?:i|we)\s+(?:am|are|'m|'re)\s+(?:not allowed|not permitted|unable)\s+to\s+(?:say|write|use|mention|provide)\b/i },
  { label: "a first-person wording restriction", pattern: /\b(?:i|we)\s+(?:must|need to|have to)\s+(?:avoid|omit|remove|not mention|not use)\b/i },
  { label: "a parenthetical apology", pattern: /\((?:sorry|apolog(?:y|ies|ize|ise))\b[^)]{0,120}\)/i },
  { label: "an apology followed by a refusal", pattern: /\b(?:i(?:'m| am)\s+sorry|sorry|apologies?)[,:]?\s+(?:but\s+)?(?:i\s+)?(?:can(?:not|'t)|won't|shouldn't|am not allowed)\b/i },
  { label: "a redaction placeholder", pattern: /[\[(](?:redacted|removed|omitted|placeholder|content withheld|not provided)[\])]/i },
];

/** Reader-visible traces of the model discussing its own rules or limitations. */
export function modelMetaTalkIn(text: string): string[] {
  if (!text) return [];
  const normalized = text.replaceAll("’", "'");
  return MODEL_META_PATTERNS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ label }) => label);
}
type MetadataItem = {
  index?: number;
  plainName?: string;
  summary?: string;
  keywords?: string[];
  findings?: string[];
  connectionToTheme?: string;
  takeaway?: { hook?: string; line?: string };
  methodType?: string;
  claim?: string;
};

/** Core card fields that must exist before a generated paper can be published. */
export function metadataItemProblems(item: MetadataItem | null | undefined, expectedIndex: number): string[] {
  if (!item) return ["The item is missing."];

  const problems: string[] = [];
  if (item.index !== expectedIndex) problems.push(`Its index is ${item.index ?? "missing"}; expected ${expectedIndex}.`);
  if (!item.plainName?.trim()) problems.push("Its plain-language name is empty.");
  if (!item.summary?.trim()) problems.push("Its summary is empty.");
  if (!item.keywords?.some(value => value.trim())) problems.push("Its keywords are empty.");
  if (!item.findings?.some(value => value.trim())) problems.push("Its findings are empty.");
  if (!item.connectionToTheme?.trim()) problems.push("Its theme connection is empty.");
  if (!item.takeaway?.hook?.trim() || !item.takeaway?.line?.trim()) problems.push("Its takeaway is incomplete.");
  if (!item.methodType?.trim()) problems.push("Its method type is empty.");
  if (!item.claim?.trim()) problems.push("Its claim is empty.");
  return problems;
}

/**
 * Digest-level concepts arrive as "term: definition" strings from the batched
 * metadata call plus any per-paper repairs, and each call re-defines the same
 * term in different words - so exact-string dedupe lets "large language models"
 * through three times. Dedupe on the term, case-insensitively, and keep the
 * first definition.
 */
export function dedupeKeyConcepts(concepts: string[]): string[] {
  const seen = new Set<string>();
  return concepts.filter((concept) => {
    const term = (concept.includes(":") ? concept.slice(0, concept.indexOf(":")) : concept)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.!]+$/, "");
    if (!term || seen.has(term)) return false;
    seen.add(term);
    return true;
  });
}
const OVERCLAIM_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  // Sep 19 opener/gist upgraded the cocrystal abstract's "potential synergistic
  // therapeutic application" into achieved intent: "exactly as designed".
  { label: "an as-designed intent claim", pattern: /\bexactly as (?:designed|intended|planned)\b/i },
  // Sep 18 takeawayStat called the 2010-2014 exit wave a "proof of concept";
  // the abstract only says those exits facilitated uptake.
  { label: "a proof-of-concept claim", pattern: /\bproof of concept\b/i },
  // Sep 20: absence in the source rewritten as deliberate intent - missing
  // reporting became "hid the math", nondisclosed deviations became "changed
  // criteria without telling anyone". A missing detail is a gap; concealment
  // is an accusation the source must itself support.
  { label: "an intent/concealment claim", pattern: /\b(?:hid|hides|hiding|conceal(?:ed|s|ing)?|cover(?:ed|s)? up)\b/i },
  { label: "an intent/concealment claim", pattern: /\bwithout telling (?:anyone|readers|the public)\b/i },
  // Sep 20: an evidentiary absence the supplied abstract never asserted -
  // tDCS "lacks proof", study designs "too limited to prove efficacy". Claiming
  // what the evidence CANNOT show is as unsupported as claiming what it does.
  { label: "an unsupported evidentiary-absence claim", pattern: /\b(?:lacks?|without|no) proof\b/i },
  { label: "an unsupported evidentiary-absence claim", pattern: /\btoo limited to prove\b/i },
  // Sep 22: a hedged replication claim shipped as the universal absolute
  // "almost identically". The phrase has no innocent use in reader-facing
  // digest copy - a source that measured near-identical results says so in
  // numbers, not in this adverb pair.
  { label: "a universal-replication claim", pattern: /\balmost identically\b/i },
];

/**
 * Modal-upgrade and epistemic-overreach phrases that have reached published
 * editions. Deterministic guards cannot judge subject widening, verdict scope,
 * or unmeasured inference - the critique pass and EVIDENCE_RULES carry those -
 * but these framings are never reader-safe unless a source says them verbatim,
 * and ours did not.
 */
export function overclaimProblems(text: string): string[] {
  if (!text) return [];
  const normalized = text.replaceAll("\u2019", "'");
  return OVERCLAIM_PATTERNS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ label }) => label);
}

// ─── Verdict polarity (gist/synthesis agreement) ─────────────────────────────
// Sep 23 defect: gist opened "Mostly." while the synthesis opened "Yes, at
// least partly" - two verdicts for the same question, generated by separate
// calls that never see each other's answer. The fix is a deterministic
// comparison of the two openings; a disagreement gets one regeneration and
// then a deterministic strip.

const VERDICT_OPENERS: Array<{ pattern: RegExp; polarity: "yes" | "no" | "mixed" }> = [
  { pattern: /^\s*yes\b(?!, but)/i, polarity: "yes" },
  { pattern: /^\s*mostly\b/i, polarity: "yes" },
  { pattern: /^\s*no\b(?!, unless)/i, polarity: "no" },
  { pattern: /^\s*not really\b/i, polarity: "no" },
  { pattern: /^\s*sometimes\b/i, polarity: "mixed" },
  { pattern: /^\s*it depends\b/i, polarity: "mixed" },
  { pattern: /^\s*it'?s complicated\b/i, polarity: "mixed" },
  { pattern: /^\s*only in some cases\b/i, polarity: "mixed" },
  { pattern: /^\s*sort of\b/i, polarity: "mixed" },
  { pattern: /^\s*yes, but\b/i, polarity: "mixed" },
  { pattern: /^\s*no, unless\b/i, polarity: "mixed" },
];

/** The verdict polarity a text opens with, or null when it opens with the
 * answer directly (no stock verdict phrase). */
export function verdictPolarity(text: string): "yes" | "no" | "mixed" | null {
  for (const { pattern, polarity } of VERDICT_OPENERS) {
    if (pattern.test(text)) return polarity;
  }
  return null;
}

/** Strip a leading stock verdict phrase so a mismatched gist cannot contradict
 * the synthesis it summarizes. Returns the text unchanged when there is no
 * verdict opener to strip. */
export function stripVerdictOpener(text: string): string {
  const stripped = text.replace(/^\s*(yes, but|no, unless|yes|no|mostly|not really|sometimes|it depends|it'?s complicated|only in some cases|sort of)\b[.,!:-]+\s*/i, "");
  if (!stripped || stripped === text) return text;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

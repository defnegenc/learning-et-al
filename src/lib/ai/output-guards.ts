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

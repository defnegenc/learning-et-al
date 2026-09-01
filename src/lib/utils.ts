import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip a publisher's leading section label from abstract-derived text.
 *
 * When a paper row has no AI summary (Stage A metadata failed on that run),
 * the card falls back to the raw abstract, and OpenAlex abstracts routinely
 * open with the literal word "Abstract" / "ABSTRACT" / "Abstrak" or a
 * "BACKGROUND:" header. Requiring a capital after the label keeps a sentence
 * that genuinely starts with "Abstract reasoning..." intact.
 */
export function stripAbstractLabel(text: string): string {
  const label = text.match(/^(abstract|abstrak|background|purpose|introduction|objectives?)\s*[:.\-\u2010-\u2015]?\s+/i);
  if (!label) return text;
  const rest = text.slice(label[0].length);
  // Case-sensitive on purpose: /i on a single regex would also relax this
  // check, and "Abstract reasoning improves..." must keep its first word.
  return /^[A-Z0-9"'\u201C]/.test(rest) ? rest : text;
}

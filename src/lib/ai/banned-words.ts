/**
 * Words that are never allowed in generated copy.
 *
 * "quietly" and "silently" are Defne's standing ban, and they kept shipping
 * anyway: "Will advertisers quietly corrupt how AI guides us?" ran as a digest
 * headline on 2026-08-25. They were listed in four prompt bodies as one item in
 * a long AI-tell list, and the headline prompt (`THEME_TASTE_RULES`) never
 * carried the list at all, so the one line the reader sees first had no rule to
 * break.
 *
 * Three layers, and the em-dash ban at the foot of this file has the same three:
 *   1. `BANNED_WORDS_RULE` goes into every prompt that writes reader-facing copy.
 *   2. `bannedWordsIn` is a deterministic gate on the headline, so a violating
 *      candidate is rejected and repaired before anything else runs.
 *   3. `stripBannedWords` runs over the digest on its way into the database, so
 *      the ban holds even when the model ignores the prompt and the repair
 *      fails. Deleting the adverb always leaves a grammatical sentence, which is
 *      what makes a mechanical last resort safe here.
 *
 * Scope is reader-facing generated text. Code comments and internal docs are
 * out (this file uses "silently" three lines up), and so is model output the
 * reader never sees: the scrub deliberately does NOT sit in `aiChat`, because a
 * critique that reports "quietly" in its `bannedPhrasesFound` array needs to say
 * the word to get it rewritten.
 */

/** The ban list. One place: the rule text, the gate and the scrub all read it. */
export const BANNED_WORDS = ["quietly", "silently"] as const;

const ALTERNATION = BANNED_WORDS.join("|");
const CONTAINS = new RegExp(`\\b(?:${ALTERNATION})\\b`, "i");
const EVERY = new RegExp(`\\b(?:${ALTERNATION})\\b`, "gi");
/** The word plus the spacing it owns, so removal leaves no gap. Its trailing
 *  comma is captured rather than eaten: a fronted "Quietly, they left" loses the
 *  comma with the word, but "it broke silently, then loudly" keeps it. */
const WITH_SPACING = new RegExp(`\\b(?:${ALTERNATION})\\b([,;]?)[ \\t]*`, "gi");

/** The prompt line. Interpolate it; never restate it by hand. */
export const BANNED_WORDS_RULE =
  `COPY RULE: omit the adverbs "quietly" and "silently" from every reader-facing field. State what happened and who noticed, or drop the adverb. Never mention this rule or substitute an apology, refusal, placeholder, or note about wording.`;

/** Which banned words a piece of copy uses, lowercased and deduped. */
export function bannedWordsIn(text: string): string[] {
  if (!text) return [];
  return [...new Set((text.match(EVERY) || []).map(word => word.toLowerCase()))];
}

/**
 * A character no generated copy contains, marking where a sentence-initial word
 * was removed so the next word can be recased. Tracking the position this way
 * keeps the recasing surgical: an "e.g. the study" elsewhere in the same string
 * is left alone.
 */
const RECASE = String.fromCharCode(1);

/**
 * The same text with every banned word removed.
 *
 * Only touches strings that actually contain one, so the spacing and casing
 * repair can never rewrite copy that was already clean.
 */
export function stripBannedWords(text: string): string {
  if (!text || !CONTAINS.test(text)) return text;
  return text
    .replace(WITH_SPACING, (_match, punctuation: string, offset: number, whole: string) =>
      // Sentence starts only. A colon is deliberately not one: a key concept
      // reads "stealth marketing: paying influencers", not "…: Paying …".
      /(?:^|[.!?]\s|\n\s*)$/.test(whole.slice(0, offset))
        ? RECASE
        : (punctuation ? `${punctuation} ` : "")
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(new RegExp(`${RECASE}(\\w)`, "g"), (_match, letter: string) => letter.toUpperCase())
    .split(RECASE).join("")
    .trim();
}

/** `stripBannedWords` for a value that may be absent. Nulls stay null. */
export function stripBannedWordsMaybe<T extends string | null | undefined>(text: T): T {
  return text ? (stripBannedWords(text) as T) : text;
}

/* ── The em dash ─────────────────────────────────────────────────────────── */

/**
 * The em dash ban, given the same three layers as the words above.
 *
 * It was a prompt line in eleven places and a mechanism in none, which is
 * exactly the arrangement that ships violations: eleven chances for a model to
 * forget and no chance to catch it afterwards. `EM_DASH_RULE` is the prompt
 * line and `stripEmDashes` is the net under it.
 *
 * En dashes in numeric ranges are untouched; only U+2014 is.
 */
const EM_DASH = "—";

/** The prompt line. Interpolate it; never restate it by hand. */
export const EM_DASH_RULE =
  `COPY RULE: never write an em dash (${EM_DASH}). Use a comma, a period, a colon, or parentheses instead.`;

/**
 * The same text with every em dash replaced by punctuation that reads.
 *
 * A dash between clauses becomes a comma, which is grammatical wherever the
 * dash was; one that sits next to punctuation already carrying the pause is
 * dropped instead, so ", ${EM_DASH}" never becomes ", ,".
 */
export function stripEmDashes(text: string): string {
  if (!text || !text.includes(EM_DASH)) return text;
  return text
    .replace(/(^|\n)[ \t]*—[ \t]*/g, "$1")
    .replace(/([,;:.!?])[ \t]*—[ \t]*/g, "$1 ")
    .replace(/[ \t]*—[ \t]*([,;:.!?])/g, "$1")
    .replace(/[ \t]*—[ \t]*/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

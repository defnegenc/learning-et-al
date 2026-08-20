/**
 * The tips a brand-new reader sees while their first digest generates.
 *
 * MAINTENANCE RULE — when a user-facing feature majorly changes (added,
 * removed or renamed), update this list. This is the only moment in the whole
 * product where we tell someone these things exist, and a tip pointing at a
 * feature that no longer ships is worse than no tip at all. The rule is also
 * written into CLAUDE.md's Context Maintenance Rules so it survives sessions.
 *
 * Each tip is one Body-face sentence — a thing the reader has no way to
 * discover on their own, not a restatement of what they can already see.
 * Keep them short enough to read in the ~7s a tip is on screen.
 */
export const FIRST_RUN_TIPS = [
  "Save a paper and we start preparing its reading companion in the background — a plain-language walkthrough waiting in your vault.",
  "Every paper in your vault can take questions — “Ask this paper” answers from the paper itself.",
  "Dotted-underlined words in a digest are jargon — hover for a plain definition.",
  "Paper names in the synthesis are clickable — they open that paper's card.",
  "Don't like a digest? The regenerate button at the end takes a reason and tries again.",
  "Digests can land in your inbox — daily, twice a week, or weekly, set in settings.",
  "A gold-framed card is a foundational paper — an older classic the day's question stands on.",
] as const;

/** How long one tip holds before the next rises in. */
export const FIRST_RUN_TIP_MS = 7000;

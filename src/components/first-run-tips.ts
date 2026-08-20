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
 *
 * Vocabulary: the saved-papers surface is "your library" and the agent that
 * preps a save is "your librarian", matching `save-nux.tsx`. (The nav tab still
 * reads "Vault" — prose says library.) Don't restate `SaveTipStrip`'s copy: it
 * shows on the digest these tips are the wait for, so a duplicate would land
 * twice in a row.
 */
export const FIRST_RUN_TIPS = [
  "Save a paper and your librarian gets to work — by the time you open it in your library, the walkthrough is already written.",
  "Every paper in your library can take questions. “Ask this paper” compares its claims with current web sources.",
  "Dotted-underlined words in a digest are jargon — hover for a plain definition.",
  "Paper names in the synthesis are clickable — they open that paper's card.",
  "Highlight any sentence while reading a paper to ask about it.",
  "Don't like a digest? The regenerate button at the end takes a reason and tries again.",
  "Digests can land in your inbox — daily, twice a week, or weekly, set in settings.",
  "A gold-framed card is a foundational paper — an older classic the day's question stands on.",
] as const;

/** How long one tip holds before the next rises in. */
export const FIRST_RUN_TIP_MS = 7000;

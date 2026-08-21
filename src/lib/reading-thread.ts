/**
 * The reading thread — the shape a paper's conversation takes on both sides.
 *
 * A highlight and a typed question are one store. A highlight starts a thread, a
 * typed question starts a thread, and a follow-up continues one. What differs is
 * only whether the opening turn quotes a passage.
 */

/**
 * What a highlight asks when the reader presses Ask without typing anything.
 *
 * There is no second verb in the interface any more, so this is not a mode — it
 * is the question the reader was overwhelmingly going to type. Stored verbatim
 * as the turn's question, so a thread reads back as a conversation rather than
 * as an internal intent code, and it is what the placeholder in the bar quotes.
 */
export const DEFAULT_QUESTION = "What does this mean?";

/** The walkthrough sections a highlight can come from, in reading order. */
export const SECTION_KEYS = ["gist", "did", "found", "caveats", "remember"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(v: unknown): v is SectionKey {
  return typeof v === "string" && (SECTION_KEYS as readonly string[]).includes(v);
}

export interface ThreadTurn {
  id: string;
  question: string;
  answer: string;
  threadId: string | null;
  selection: string | null;
  sectionKey: string | null;
  pitch?: import("@/lib/familiarity").PitchedForYou | null;
  createdAt?: string | number | Date | null;
}

export interface ReadingThread {
  id: string;
  /** The quoted passage this thread opened on, if it opened on a highlight. */
  selection: string | null;
  sectionKey: SectionKey | null;
  turns: ThreadTurn[];
}

/**
 * Group flat turns into threads, oldest first.
 *
 * A row with no `threadId` predates threading and becomes a thread of one, so
 * a paper a reader asked three questions about last month still reads as three
 * exchanges rather than vanishing.
 */
export function groupThreads(turns: ThreadTurn[]): ReadingThread[] {
  const order: string[] = [];
  const byId = new Map<string, ThreadTurn[]>();

  const at = (t: ThreadTurn) => new Date(t.createdAt ?? 0).getTime();
  for (const turn of [...turns].sort((a, b) => at(a) - at(b))) {
    const key = turn.threadId || turn.id;
    if (!byId.has(key)) {
      byId.set(key, []);
      order.push(key);
    }
    byId.get(key)!.push(turn);
  }

  return order.map(id => {
    const grouped = byId.get(id)!;
    const opener = grouped[0];
    return {
      id,
      selection: opener.selection ?? null,
      sectionKey: isSectionKey(opener.sectionKey) ? opener.sectionKey : null,
      turns: grouped,
    };
  });
}

/** The threads a highlight produced, in the section they were highlighted from. */
export function digsForSection(threads: ReadingThread[], section: SectionKey): ReadingThread[] {
  return threads.filter(t => t.selection && t.sectionKey === section);
}

/**
 * Everything not anchored to a section — the Ask rail's own thread list.
 *
 * Keyed on the section, not on the selection: "Ask about this" drops a quoted
 * passage into the composer as context but posts without a section, so it stays
 * in the rail where the reader typed it rather than jumping into the prose.
 */
export function askThreads(threads: ReadingThread[]): ReadingThread[] {
  return threads.filter(t => !t.sectionKey);
}

/*
 * Shared domain types.
 *
 * PaperItem used to live in today/paper-card.tsx, so 14 files imported a type
 * from a component module that itself was dead. Types live here now; components
 * import from here.
 */

export interface PaperItem {
  id: string;
  title: string;
  summary: string | null;
  source: "arxiv" | "rss" | "semantic_scholar";
  sourceUrl: string | null;
  keywords: string[];
  authors: string[];
  year?: number | null;
  abstract?: string | null;
  fullText?: string | null;
  category?: "foundational" | "recent" | "news" | null;
  foundationalReason?: string | null;
  keyFindings?: string[];
  connectionReason?: string | null;
  plainName?: string | null;
  takeawayHook?: string | null;
  takeawayStat?: string | null;
  takeawayLine?: string | null;
  methodType?: string | null;
  methodFacts?: string[];
  claim?: string | null;
  dinnerLine?: string | null;
  relatesLine?: string | null;
  digestTheme?: string | null; // reading list only: theme of the digest this paper came from
  digestDate?: string | null;  // reading list only: date of that digest
}

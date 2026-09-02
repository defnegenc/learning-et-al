import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasteDossiers } from "@/lib/db/schema";
import { aiChat, aiConfigFor } from "@/lib/ai/provider";
import { cosineSimilarity, embedBatch } from "@/lib/embeddings";
import { BANNED_WORDS_RULE, EM_DASH_RULE, stripBannedWords, stripEmDashes } from "@/lib/ai/banned-words";
import { collectLedger, type Ledger, type LedgerPaper } from "./ledger";

/*
 * The dossier keeper.
 *
 * The digest finder stays a pipeline — deterministic, tuned, and the algorithm
 * doc says don't deviate. The librarian is the separate, per-user thing that
 * owns everything else, and this is its memory: a short natural-language
 * document about one reader, rewritten from the ledger when enough has changed.
 *
 * Two representations, used in two different places, both cheap:
 *
 *  1. **The dossier** — under 90 words of prose written to the reader, fed to
 *    the LLM selection step, which is where the real quality call is made, and
 *    shown to the reader in settings. Prose because it is inspectable, because
 *    it survives a schema change, and because it is the form the model can use.
 *  2. **Centroids** — embeddings of saved papers, clustered. A soft prior on
 *    ranking inside the qualified pool. NOT a filter, NOT a threshold, and
 *    deliberately not one global average: somebody who saves both HCI and
 *    metabolism papers is not the midpoint of the two.
 */

/** New signals needed before a rewrite is worth a model call. */
const REWRITE_AFTER_SIGNALS = 5;
/** …or this long since the last one, whichever comes first. */
const REWRITE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Below this there is nothing honest to say, and a confident guess would steer selection wrongly. */
const MIN_SIGNALS = 3;

const MAX_CLUSTERS = 5;
const CLUSTER_JOIN_SIM = 0.45;

export interface Centroid {
  label: string;
  vector: number[];
  count: number;
}

export interface TasteContext {
  dossier: string | null;
  centroids: Centroid[];
  updatedAt: Date | null;
  signalCount: number;
}

const EMPTY: TasteContext = { dossier: null, centroids: [], updatedAt: null, signalCount: 0 };

/**
 * Read-only. The digest pipeline calls this and must never block on generating
 * one — a reader with no dossier yet simply gets the pipeline as it was.
 */
export async function getTasteContext(userId: string): Promise<TasteContext> {
  try {
    const row = await db.query.tasteDossiers.findFirst({ where: eq(tasteDossiers.userId, userId) });
    if (!row) return EMPTY;
    let centroids: Centroid[] = [];
    try {
      const parsed = row.centroids ? JSON.parse(row.centroids) : [];
      if (Array.isArray(parsed)) centroids = parsed.filter((c: Centroid) => Array.isArray(c?.vector) && c.vector.length > 0);
    } catch { /* an unreadable blob is the same as no centroids */ }
    return {
      dossier: row.dossier?.trim() || null,
      centroids,
      updatedAt: row.updatedAt ?? null,
      signalCount: row.signalCount ?? 0,
    };
  } catch {
    // The dossier is an enhancement. If its table isn't there yet, the pipeline
    // must still run.
    return EMPTY;
  }
}

/* ── Centroids ───────────────────────────────────────────────────────────── */

function paperText(p: LedgerPaper): string {
  return `${p.title}. ${p.lead} ${p.keywords.join(", ")}`.trim();
}

/**
 * Greedy single-pass clustering: a paper joins the first cluster it is close
 * enough to, else it starts one. Not k-means — we don't know k, the sets are
 * tens of items, and the only thing downstream needs is "is this candidate near
 * something they already liked?", which survives rough boundaries.
 */
function cluster(saved: LedgerPaper[], vectors: number[][]): Centroid[] {
  const clusters: { vector: number[]; members: LedgerPaper[] }[] = [];

  for (let i = 0; i < saved.length; i++) {
    const vec = vectors[i];
    if (!vec?.length) continue;
    let best = -1;
    let bestSim = CLUSTER_JOIN_SIM;
    for (let c = 0; c < clusters.length; c++) {
      const sim = cosineSimilarity(clusters[c].vector, vec);
      if (sim > bestSim) { bestSim = sim; best = c; }
    }
    if (best < 0) {
      clusters.push({ vector: [...vec], members: [saved[i]] });
      continue;
    }
    const target = clusters[best];
    const n = target.members.length;
    target.vector = target.vector.map((v, d) => (v * n + vec[d]) / (n + 1));
    target.members.push(saved[i]);
  }

  return clusters
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, MAX_CLUSTERS)
    .map(c => ({ label: clusterLabel(c.members), vector: c.vector, count: c.members.length }));
}

/** The keyword the cluster's papers share most often — a name for a debug line, not a fact. */
function clusterLabel(members: LedgerPaper[]): string {
  const counts = new Map<string, number>();
  for (const m of members) {
    for (const k of m.keywords) {
      const key = k.toLowerCase().trim();
      if (key.length > 2) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? members[0]?.title.split(/\s+/).slice(0, 4).join(" ").toLowerCase() ?? "saved work";
}

/* ── The rewrite ─────────────────────────────────────────────────────────── */

/*
 * The note is written TO the reader, not about them.
 *
 * It is read in two places and the second person serves both. In settings it is
 * the whole point: a paragraph that opens "This reader tends to save…" is a file
 * being kept on somebody, and the person it is about has to squint to find
 * themselves in it, whereas "You save…" is a sentence they can immediately agree
 * or disagree with, which is the only way a taste model gets corrected. In the
 * selection prompt it costs nothing, because the note arrives quoted and labelled
 * with who "you" refers to.
 *
 * Short for the same reason. Three hundred words of hedged prose is not more
 * information than ninety, it is the same information a reader will not finish,
 * and the tie-break it feeds needs specifics rather than coverage.
 */
const DOSSIER_SYSTEM = `You keep a short note on one reader of a research digest, written to them, so they can read it and tell you where you are wrong. The same note is shown to whoever picks their papers.

Write AT MOST 90 words, in the second person. Inside the note, "you" always means the reader. Two or three short paragraphs of plain prose. No headings, no bullets, no lists.

Say, in this order and only where the evidence supports it:
1. What you save: the subject, and the SHAPE of the work (methods papers vs field studies vs argument pieces, new results vs older thinking).
2. What you get shown and walk past. Say what those have in common. It is the sharpest signal there is.
3. What you ask about once you are reading.

Mark the specifics with **double asterisks**: subjects, methods, the kind of work. At most FOUR marked phrases in the whole note, one to three words each. Mark a thing, never a judgement: "**sleep and metabolism**" and "**field studies**", not "**you clearly love**".

Hard rules:
- Address the reader directly. "You save…", "You walk past…". Never "this reader", never "the user", never "I".
- Write ONLY what the evidence supports. Four saves is four saves: say so and stop. One honest sentence beats a confident invention.
- Never guess at demographics, profession, or seniority.
- Self-rated familiarity is about PITCHING, never about selection. A 2/5 means explain the subject properly. It does NOT mean send less of it, and nothing you write may read as "avoid this topic". At most one clause about it, about how to explain rather than what to choose.
- If the evidence is still thin, say so in the last sentence and keep the note to two or three lines.
${EM_DASH_RULE}
${BANNED_WORDS_RULE}`;

function ledgerPrompt(ledger: Ledger): string {
  const list = (items: LedgerPaper[], cap: number) =>
    items.slice(0, cap).map(p => `- "${p.title}" (${p.year ?? "n.d."}): ${p.lead.slice(0, 180)}${p.keywords.length ? ` [${p.keywords.join(", ")}]` : ""}`).join("\n") || "  (none yet)";

  return `SAVED (${ledger.saved.length}), kept for reading:
${list(ledger.saved, 25)}

SHOWN AND NOT SAVED (${ledger.skipped.length}), offered in a digest, walked past:
${list(ledger.skipped, 25)}

DISLIKED (${ledger.disliked.length}):
${ledger.disliked.map(d => `- "${d.title}"${d.reason ? `, they said: "${d.reason}"` : ""}`).join("\n") || "  (none)"}

QUESTIONS THEY ASKED WHILE READING (${ledger.questions.length}):
${ledger.questions.slice(0, 20).map(q => `- ${q}`).join("\n") || "  (none)"}

PASSAGES THEY DUG INTO (${ledger.digs.length}):
${ledger.digs.slice(0, 15).map(d => `- "${d.slice(0, 200)}"`).join("\n") || "  (none)"}

WHAT THEY SAID WHEN THEY REJECTED A DIGEST (${ledger.complaints.length}):
${ledger.complaints.map(c => `- "${c}"`).join("\n") || "  (none)"}

THEIR STATED INTERESTS (weight in brackets; higher means more engaged):
${ledger.interests.slice(0, 20).map(i => `- ${i.keyword} [${i.weight.toFixed(2)}]`).join("\n") || "  (none)"}

HOW FAMILIAR THEY SAY THEY ARE (1 = new to it, 5 = they work on it). This is about how to EXPLAIN a subject, never about whether to send it:
${ledger.familiarity.map(f => `- ${f.topic}: ${f.level}/5`).join("\n") || "  (they haven't said)"}

Write the note.`;
}

export interface RefreshResult {
  written: boolean;
  reason?: "not_enough_signal" | "no_change" | "no_model" | "empty_response" | "error";
  signalCount?: number;
}

/**
 * Rewrite the dossier if enough has changed. Safe to call on every save — the
 * threshold check happens before any model call, so the common case costs two
 * queries and nothing else.
 */
export async function refreshDossier(userId: string, opts: { force?: boolean } = {}): Promise<RefreshResult> {
  try {
    const ledger = await collectLedger(userId);
    const existing = await db.query.tasteDossiers.findFirst({ where: eq(tasteDossiers.userId, userId) });

    if (ledger.signalCount < MIN_SIGNALS) return { written: false, reason: "not_enough_signal", signalCount: ledger.signalCount };

    if (!opts.force && existing?.dossier) {
      const newSignals = ledger.signalCount - (existing.signalCount ?? 0);
      const age = Date.now() - (existing.updatedAt?.getTime() ?? 0);
      if (newSignals < REWRITE_AFTER_SIGNALS && age < REWRITE_AFTER_MS) {
        return { written: false, reason: "no_change", signalCount: ledger.signalCount };
      }
    }

    // `metadata` on purpose: this is a summarisation chore over evidence we
    // already hold, run weekly, and it is not the product's voice.
    const config = aiConfigFor("metadata");
    if (!config.apiKey) return { written: false, reason: "no_model" };

    // The prompt bans the em dash and the two adverbs; this is the net under it,
    // and it has to be here rather than in `aiChat` because the note is read by a
    // person. Same arrangement the digest uses on its way into the database.
    const dossier = stripBannedWords(stripEmDashes((await aiChat(config, [
      { role: "system", content: DOSSIER_SYSTEM },
      { role: "user", content: ledgerPrompt(ledger) },
    ])).trim()));
    if (!dossier) return { written: false, reason: "empty_response" };

    let centroids: Centroid[] = [];
    if (ledger.saved.length > 0) {
      try {
        const vectors = await embedBatch(ledger.saved.map(paperText));
        centroids = cluster(ledger.saved, vectors);
      } catch { /* no centroids just means no prior — the dossier still lands */ }
    }

    const values = {
      dossier,
      centroids: JSON.stringify(centroids),
      signalCount: ledger.signalCount,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(tasteDossiers).set(values).where(eq(tasteDossiers.id, existing.id));
    } else {
      await db.insert(tasteDossiers).values({ userId, ...values });
    }

    console.log(`[Librarian] Dossier rewritten for ${userId}: ${ledger.signalCount} signals, ${centroids.length} clusters (${centroids.map(c => `${c.label}×${c.count}`).join(", ")})`);
    return { written: true, signalCount: ledger.signalCount };
  } catch (err) {
    console.error("[Librarian] Dossier refresh failed:", err);
    return { written: false, reason: "error" };
  }
}

/**
 * How close a candidate paper sits to something this reader already saved.
 *
 * Max over clusters, not mean: being a strong match for one of someone's three
 * interests is the signal, and averaging it against the two they aren't reading
 * about today would erase it.
 */
export function tasteSimilarity(centroids: Centroid[], vector: number[] | undefined): number {
  if (!centroids.length || !vector?.length) return 0;
  let best = 0;
  for (const c of centroids) {
    const sim = cosineSimilarity(c.vector, vector);
    if (sim > best) best = sim;
  }
  return best;
}

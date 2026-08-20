import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasteDossiers } from "@/lib/db/schema";
import { aiChat, aiConfigFor } from "@/lib/ai/provider";
import { cosineSimilarity, embedBatch } from "@/lib/embeddings";
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
 *  1. **The dossier** — ~300 words of prose, fed to the LLM selection step,
 *    which is where the real quality call is made. Prose because it is
 *    inspectable (the reader can be shown it), because it survives a schema
 *    change, and because it is the form the model can actually use.
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

const DOSSIER_SYSTEM = `You are a librarian keeping a private working note about one reader, so that the next person choosing what to send them can choose well.

Write 200-300 words of plain prose in the third person ("This reader…"). No headings, no bullets, no markdown.

Cover, in this order and only where the evidence supports it:
1. What they reliably save — the subject matter, and just as importantly the SHAPE of work they go for (methods papers vs field studies vs argument pieces; new results vs older thinking).
2. What gets shown to them and walked past. This is the sharpest signal you have. Say what the skipped papers have in common.
3. What they ask about once they're reading — the questions and the passages they stopped on tell you what they actually want explained.
4. What they have complained about, quoted or paraphrased, and what to avoid sending as a result.

Hard rules:
- Write ONLY what the evidence supports. If there are four saves, say so and keep the note short — "too early to tell" is a useful sentence and a confident invention is a harmful one.
- Never guess at demographics, profession, or seniority.
- Distinguish "likes the topic" from "likes how it was explained". They are different signals and the second one is not your business here.
- End with one sentence naming what you are still unsure about.`;

function ledgerPrompt(ledger: Ledger): string {
  const list = (items: LedgerPaper[], cap: number) =>
    items.slice(0, cap).map(p => `- "${p.title}" (${p.year ?? "n.d."}) — ${p.lead.slice(0, 180)}${p.keywords.length ? ` [${p.keywords.join(", ")}]` : ""}`).join("\n") || "  (none yet)";

  return `SAVED (${ledger.saved.length}) — kept for reading:
${list(ledger.saved, 25)}

SHOWN AND NOT SAVED (${ledger.skipped.length}) — offered in a digest, walked past:
${list(ledger.skipped, 25)}

DISLIKED (${ledger.disliked.length}):
${ledger.disliked.map(d => `- "${d.title}"${d.reason ? ` — they said: "${d.reason}"` : ""}`).join("\n") || "  (none)"}

QUESTIONS THEY ASKED WHILE READING (${ledger.questions.length}):
${ledger.questions.slice(0, 20).map(q => `- ${q}`).join("\n") || "  (none)"}

PASSAGES THEY DUG INTO (${ledger.digs.length}):
${ledger.digs.slice(0, 15).map(d => `- "${d.slice(0, 200)}"`).join("\n") || "  (none)"}

WHAT THEY SAID WHEN THEY REJECTED A DIGEST (${ledger.complaints.length}):
${ledger.complaints.map(c => `- "${c}"`).join("\n") || "  (none)"}

THEIR STATED INTERESTS (weight in brackets — higher means more engaged):
${ledger.interests.slice(0, 20).map(i => `- ${i.keyword} [${i.weight.toFixed(2)}]`).join("\n") || "  (none)"}

Write the working note.`;
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

    // Fast tier on purpose: this is a summarisation chore over evidence we
    // already hold, run weekly, and it is not the product's voice.
    const config = aiConfigFor("chore");
    if (!config) return { written: false, reason: "no_model" };

    const dossier = (await aiChat(config, DOSSIER_SYSTEM, [{ role: "user", content: ledgerPrompt(ledger) }])).trim();
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

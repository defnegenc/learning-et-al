/**
 * Lightweight BM25 scorer + Reciprocal Rank Fusion.
 * Cormack et al. (2009) — RRF outperforms individual rank methods.
 */

const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
}

/** Compute BM25 scores for a query against a corpus of documents. */
export function bm25Score(query: string, docs: string[]): number[] {
  const queryTokens = tokenize(query);
  const tokenizedDocs = docs.map(tokenize);
  const N = docs.length;
  const avgDl = tokenizedDocs.reduce((s, d) => s + d.length, 0) / Math.max(N, 1);

  // IDF: log((N - df + 0.5) / (df + 0.5) + 1) per query term
  const df = new Map<string, number>();
  for (const doc of tokenizedDocs) {
    const unique = new Set(doc);
    for (const t of unique) df.set(t, (df.get(t) || 0) + 1);
  }

  return tokenizedDocs.map(doc => {
    const dl = doc.length;
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const qt of queryTokens) {
      const termDf = df.get(qt) || 0;
      const termTf = tf.get(qt) || 0;
      const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);
      score += idf * (termTf * (K1 + 1)) / (termTf + K1 * (1 - B + B * dl / avgDl));
    }
    return score;
  });
}

/**
 * Reciprocal Rank Fusion — combine multiple ranked lists.
 * Cormack et al. (2009), SIGIR. k=60 is standard.
 */
export function rrfFuse(rankedLists: number[][], k = 60): number[] {
  const n = rankedLists[0].length;
  const rankArrays = rankedLists.map(scores => {
    const indexed = scores.map((s, i) => ({ i, s }));
    indexed.sort((a, b) => b.s - a.s);
    const ranks = new Array(n).fill(0);
    indexed.forEach((item, rank) => { ranks[item.i] = rank + 1; });
    return ranks;
  });

  const fused = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (const ranks of rankArrays) {
      fused[i] += 1 / (k + ranks[i]);
    }
  }
  return fused;
}

/**
 * Semantic similarity using a local transformer model.
 *
 * Model: all-MiniLM-L6-v2 (~23MB, downloaded once and cached)
 * - Produces 384-dimension embeddings
 * - Runs on CPU in Node.js via ONNX Runtime
 * - No API key, no cost, no rate limits
 *
 * Cosine similarity scale for this model:
 *   > 0.50 — strongly on-topic (same subject area, similar vocabulary)
 *   0.30–0.50 — related (same broad field)
 *   0.15–0.30 — loose connection (shared terminology, different focus)
 *   < 0.15 — unrelated
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipeline: any = null;
let loading: Promise<void> | null = null;

let embeddingsAvailable = true;

async function getModel() {
  if (!embeddingsAvailable) return null;
  if (pipeline) return pipeline;
  if (loading) { await loading; return pipeline; }

  loading = (async () => {
    try {
      const { pipeline: createPipeline, env } = await import("@xenova/transformers");
      env.cacheDir = "./.cache/transformers";
      env.allowRemoteModels = true;
      pipeline = await createPipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { quantized: true },
      );
    } catch (err) {
      console.warn("[Embeddings] ONNX runtime not available, falling back to keyword similarity:", err);
      embeddingsAvailable = false;
      pipeline = null;
    }
  })();
  await loading;
  return pipeline;
}

// Fallback: simple word-overlap similarity when embeddings aren't available
function keywordSimilarity(a: string, b: string): number {
  const stopWords = new Set(["the", "a", "an", "in", "of", "to", "and", "for", "is", "on", "with", "that", "this", "are", "was", "by", "as", "at", "from", "or", "be", "it", "has", "have", "had", "been", "not", "but", "can", "will", "its", "all", "also", "more", "than", "into", "each", "may", "our", "new", "one", "two"]);
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w)));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.sqrt(wordsA.size * wordsB.size);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  // Fallback mode: embeddings are dummy [length] arrays, use keyword similarity
  if (!embeddingsAvailable || a.length === 1 || b.length === 1) {
    // Find the original texts from the cache
    const textsA = [...textCache.entries()].find(([, v]) => v.length === a[0]);
    const textsB = [...textCache.entries()].find(([, v]) => v.length === b[0]);
    if (textsA && textsB) return keywordSimilarity(textsA[1], textsB[1]);
    return 0.3; // default to "loosely related" when we can't compare
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Store original texts for fallback keyword similarity
const textCache = new Map<string, string>();

export async function embedText(text: string): Promise<number[]> {
  const model = await getModel();
  if (!model) {
    // Fallback: store text, return a dummy embedding that encodes the text hash
    textCache.set(text, text);
    return [text.length]; // sentinel value — cosineSimilarity won't be used
  }
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple texts in one call — same overhead as one, much faster than N separate calls.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = await getModel();
  if (!model) {
    // Fallback: store texts, return dummy embeddings
    return texts.map(t => { textCache.set(t, t); return [t.length]; });
  }
  const output = await model(texts, { pooling: "mean", normalize: true });
  const dims = output.dims;
  const batchSize: number = dims[0];
  const embDim: number = dims[1];
  const flat = Array.from(output.data as Float32Array);
  return Array.from({ length: batchSize }, (_, i) =>
    flat.slice(i * embDim, (i + 1) * embDim)
  );
}

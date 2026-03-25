/**
 * Semantic similarity using a local transformer model.
 * Falls back to keyword overlap when ONNX runtime isn't available (e.g. Vercel serverless).
 *
 * Model selection via EMBEDDING_MODEL env var:
 * - "all-MiniLM-L6-v2" (default) — 384-dim, symmetric, good general-purpose
 * - "bge-small-en-v1.5" — 384-dim, asymmetric, better cross-domain & query-doc retrieval
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipeline: any = null;
let loading: Promise<void> | null = null;
let embeddingsAvailable = true;
let _degraded = false;
let _modelName = "";

const MODEL_REGISTRY: Record<string, string> = {
  "all-MiniLM-L6-v2": "Xenova/all-MiniLM-L6-v2",
  "bge-small-en-v1.5": "Xenova/bge-small-en-v1.5",
};

export function isEmbeddingDegraded(): boolean { return _degraded; }
export function getActiveModel(): string { return _modelName || "keyword-fallback"; }

async function getModel() {
  if (!embeddingsAvailable) return null;
  if (pipeline) return pipeline;
  if (loading) { await loading; return pipeline; }

  loading = (async () => {
    try {
      const { pipeline: createPipeline, env } = await import("@xenova/transformers");
      env.cacheDir = "./.cache/transformers";
      env.allowRemoteModels = true;
      const requestedModel = process.env.EMBEDDING_MODEL || "all-MiniLM-L6-v2";
      const modelId = MODEL_REGISTRY[requestedModel] || MODEL_REGISTRY["all-MiniLM-L6-v2"];
      _modelName = requestedModel;
      pipeline = await createPipeline("feature-extraction", modelId, { quantized: true });
      console.log(`[Embeddings] Loaded ${requestedModel} (${modelId})`);
    } catch (err) {
      console.warn("[Embeddings] ONNX runtime not available, using keyword fallback:", String(err).slice(0, 100));
      embeddingsAvailable = false;
      _degraded = true;
      pipeline = null;
    }
  })();
  await loading;
  return pipeline;
}

// Fallback text lookup — keyed by sequential ID stored in dummy[0], not array reference
let _fallbackId = 0;
const embTextMap = new Map<number, string>();

const FALLBACK_STOP = new Set(["the", "a", "an", "in", "of", "to", "and", "for", "is", "on", "with", "that", "this", "are", "was", "by", "as", "at", "from", "or", "be", "it", "has", "have", "had", "been", "not", "but", "can", "will", "its", "all", "also", "more", "than", "into", "each", "may", "our", "new"]);

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length > 1 && b.length > 1) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Fallback: keyword overlap similarity (keyed by ID in dummy[0])
  const textA = embTextMap.get(a[0]) || "";
  const textB = embTextMap.get(b[0]) || "";
  if (!textA || !textB) return 0.1;

  const wordsA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !FALLBACK_STOP.has(w)));
  const wordsB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !FALLBACK_STOP.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return 0.1;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return Math.min(0.8, (overlap / Math.min(wordsA.size, wordsB.size)) * 0.6 + 0.1);
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getModel();
  if (!model) {
    const id = ++_fallbackId;
    embTextMap.set(id, text);
    return [id]; // sentinel: length 1 = fallback mode, value = lookup key
  }
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = await getModel();
  if (!model) {
    return texts.map(t => {
      const id = ++_fallbackId;
      embTextMap.set(id, t);
      return [id];
    });
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

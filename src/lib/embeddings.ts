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

async function getModel() {
  if (pipeline) return pipeline;
  if (loading) { await loading; return pipeline; }

  loading = (async () => {
    const { pipeline: createPipeline, env } = await import("@xenova/transformers");
    // Cache model files next to the project so they survive npm installs
    env.cacheDir = "./.cache/transformers";
    env.allowRemoteModels = true;
    pipeline = await createPipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { quantized: true }, // quantized = smaller file, negligible accuracy loss
    );
  })();
  await loading;
  return pipeline;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple texts in one call — same overhead as one, much faster than N separate calls.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = await getModel();
  const output = await model(texts, { pooling: "mean", normalize: true });
  // output.data is a flat Float32Array: [emb0[0], emb0[1], ..., emb0[383], emb1[0], ...]
  const dims = output.dims; // [batchSize, 384]
  const batchSize: number = dims[0];
  const embDim: number = dims[1];
  const flat = Array.from(output.data as Float32Array);
  return Array.from({ length: batchSize }, (_, i) =>
    flat.slice(i * embDim, (i + 1) * embDim)
  );
}

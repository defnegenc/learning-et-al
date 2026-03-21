/**
 * Semantic similarity using a local transformer model.
 * Falls back to keyword overlap when ONNX runtime isn't available (e.g. Vercel serverless).
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
      pipeline = await createPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
    } catch (err) {
      console.warn("[Embeddings] ONNX runtime not available, using keyword fallback:", String(err).slice(0, 100));
      embeddingsAvailable = false;
      pipeline = null;
    }
  })();
  await loading;
  return pipeline;
}

// Track original text for each embedding so fallback can do keyword comparison
const embTextMap = new Map<number[], string>();

export function cosineSimilarity(a: number[], b: number[]): number {
  // Real embeddings: standard cosine similarity
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

  // Fallback: keyword overlap similarity
  const textA = embTextMap.get(a) || "";
  const textB = embTextMap.get(b) || "";
  if (!textA || !textB) return 0.3; // unknown → assume loosely related

  const stop = new Set(["the", "a", "an", "in", "of", "to", "and", "for", "is", "on", "with", "that", "this", "are", "was", "by", "as", "at", "from", "or", "be", "it", "has", "have", "had", "been", "not", "but", "can", "will", "its", "all", "also", "more", "than", "into", "each", "may", "our", "new"]);
  const wordsA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stop.has(w)));
  const wordsB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stop.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return 0.3;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  // Scale to match embedding similarity range (0-1, typically 0.1-0.6 for this model)
  return Math.min(0.8, (overlap / Math.min(wordsA.size, wordsB.size)) * 0.6 + 0.1);
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getModel();
  if (!model) {
    const dummy = [0]; // sentinel: length 1 = fallback mode
    embTextMap.set(dummy, text);
    return dummy;
  }
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = await getModel();
  if (!model) {
    return texts.map(t => {
      const dummy = [0];
      embTextMap.set(dummy, t);
      return dummy;
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

import OpenAI from "openai";

export interface AIConfig {
  apiKey: string;
  provider: "openai" | "anthropic" | "gemini" | "other";
  model?: string;
  baseUrl?: string;
}

function getClientConfig(config: AIConfig) {
  switch (config.provider) {
    case "anthropic":
      return {
        apiKey: config.apiKey,
        baseURL: "https://api.anthropic.com/v1/",
        defaultHeaders: { "anthropic-version": "2023-06-01" },
      };
    case "gemini":
      return {
        apiKey: config.apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      };
    case "openai":
      return { apiKey: config.apiKey };
    case "other":
      return { apiKey: config.apiKey, baseURL: config.baseUrl };
  }
}

function getDefaultModel(provider: AIConfig["provider"]) {
  switch (provider) {
    case "anthropic": return "claude-sonnet-4-6";
    case "gemini": return "gemini-2.5-flash";
    case "openai": return "gpt-4o";
    default: return "gpt-4o";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Task routing
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The tasks that ask a model for something, grouped by the shape of the work
 * rather than by which surface calls them.
 *
 *  · `deep` — the product's voice. Synthesis, the companion walkthrough, a
 *    dig-deeper answer, an answer in the Ask thread. Don't cheap out on these.
 *  · `fast` — high volume, low stakes, latency-sensitive. Metadata extraction,
 *    glossaries, homework annotation, healthchecks.
 *
 * Each task is env-overridable (`AI_MODEL_DIG`, `AI_MODEL_COMPANION`, …) so a
 * harness can be swapped or A/B'd without a code change, and so moving digest
 * generation onto a cheaper model is one Vercel variable rather than a deploy.
 */
export type AITask =
  | "digest"      // the pipeline — every synthesis stage
  | "companion"   // the reading walkthrough
  | "dig"         // dig-deeper answers and the Ask thread
  | "chat"        // the legacy classic-view digest chat
  | "metadata"    // glossary, annotation, short structured extraction
  | "healthcheck";

const TASK_ENV: Record<AITask, string> = {
  digest: "AI_MODEL_DIGEST",
  companion: "AI_MODEL_COMPANION",
  dig: "AI_MODEL_DIG",
  chat: "AI_MODEL_CHAT",
  metadata: "AI_MODEL_METADATA",
  healthcheck: "AI_MODEL_HEALTHCHECK",
};

/**
 * The one place server-side AI credentials are read.
 *
 * This replaced five copy-pasted blocks that each re-derived provider, default
 * model, key and base URL from the same four env vars — and had already drifted
 * (`/api/digest/chat` and `/api/papers/[id]/qa` hard-coded `baseUrl: ""`, so an
 * `other`-provider deployment silently talked to OpenAI).
 *
 * `CRON_AI_PROVIDER` may be absent on older Vercel setups, in which case the
 * fallback is Gemini. That fallback is not evidence of what is actually
 * configured in production — see CLAUDE.md.
 */
export function aiConfigFor(task: AITask): AIConfig {
  const provider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
  return {
    apiKey: process.env.CRON_AI_KEY || "",
    provider,
    model: process.env[TASK_ENV[task]] || process.env.CRON_AI_MODEL || getDefaultModel(provider),
    baseUrl: process.env.CRON_AI_BASE_URL || "",
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One turn in a conversation. `system` is only ever the first entry. */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Turn a provider failure into something a human can act on. */
function readableError(config: AIConfig, model: string, e: unknown, maxRetries: number): Error {
  const err = e as { status?: number; message?: string; error?: { message?: string } };
  const status = err.status;
  const message = err.error?.message || err.message || `API error (status ${status})`;
  console.error(`[AI] ${config.provider} error (status ${status}, model ${model}):`, message);
  if (status === 429) {
    return new Error(`Rate limited by ${config.provider} after ${maxRetries} retries. Your API key may be on a free tier with low rate limits. Try a paid key or a different provider.`);
  }
  if (status === 401 || status === 403) {
    return new Error(`Authentication failed for ${config.provider}. Check your API key in settings.`);
  }
  if (status === 402) {
    return new Error(`Insufficient credits for ${config.provider}. Add funds or switch to another configured provider.`);
  }
  if (status === 400) {
    return new Error(`Bad request for ${config.provider} model "${model}". Check CRON_AI_PROVIDER and CRON_AI_MODEL in Vercel; model IDs must be exact. Details: ${message}`);
  }
  return new Error(`${config.provider} API error: ${message}`);
}

/**
 * A conversation, not a single turn.
 *
 * Every question in the Ask thread used to be answered blind — one system
 * prompt, one user prompt, no history — so "what about the second one?" had
 * nothing to resolve against. This is the same call with the messages array
 * exposed; `aiComplete` is now the two-message case of it.
 */
export async function aiChat(config: AIConfig, messages: AIMessage[]): Promise<string> {
  const client = new OpenAI(getClientConfig(config));
  const model = config.model || getDefaultModel(config.provider);

  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({ model, messages, max_tokens: 4096 });
      return response.choices[0]?.message?.content || "";
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt + 1) * 2000; // 4s, 8s
        console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw readableError(config, model, e, maxRetries);
    }
  }

  return "";
}

/**
 * The same conversation, streamed.
 *
 * Dig-deeper promises "keep reading, it'll be below", and that promise is much
 * better kept if the panel is filling in by the time you scroll to it. No retry
 * loop: a stream that has already emitted its first token can't be restarted
 * without showing the reader the answer twice.
 */
export async function* aiChatStream(config: AIConfig, messages: AIMessage[]): AsyncGenerator<string> {
  const client = new OpenAI(getClientConfig(config));
  const model = config.model || getDefaultModel(config.provider);

  let stream;
  try {
    stream = await client.chat.completions.create({ model, messages, max_tokens: 4096, stream: true });
  } catch (e) {
    throw readableError(config, model, e, 1);
  }

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function aiComplete(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return aiChat(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

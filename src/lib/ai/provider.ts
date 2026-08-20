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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ────────────────────────────────────────────────────────────────────────────
   Task routing
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The librarian's jobs, by shape of work rather than by route.
 *
 * `deep` is the product's voice — synthesis, the companion walkthrough, a
 * dig-deeper answer. `fast` is the high-volume, low-stakes chores: glossary
 * passes, homework annotation, deciding whether to ask a question at all.
 * Every task is env-overridable (`AI_MODEL_DIG=…`) so a harness can be swapped
 * without a deploy.
 */
export type AITask = "synthesis" | "companion" | "qa" | "dig" | "chore";

const TASK_TIER: Record<AITask, "deep" | "fast"> = {
  synthesis: "deep",
  companion: "deep",
  qa: "deep",
  dig: "deep",
  chore: "fast",
};

function tierDefault(provider: AIConfig["provider"], tier: "deep" | "fast"): string {
  if (tier === "fast") {
    switch (provider) {
      case "anthropic": return "claude-haiku-4-5-20251001";
      case "gemini": return "gemini-2.5-flash";
      case "openai": return "gpt-4o-mini";
      default: return "gpt-4o-mini";
    }
  }
  return getDefaultModel(provider);
}

/**
 * The one place a route derives its model config.
 *
 * This replaces the env block that was copy-pasted into five routes, each free
 * to drift on which default it fell back to. Precedence, highest first:
 * per-task override → `CRON_AI_MODEL` (what production actually sets) → the
 * tier default for the provider.
 *
 * Returns null when there is no server key, which is the caller's cue to fall
 * back rather than throw — a missing key is a configuration state, not an error.
 */
export function aiConfigFor(task: AITask): AIConfig | null {
  const apiKey = process.env.CRON_AI_KEY;
  if (!apiKey) return null;
  const provider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
  const model =
    process.env[`AI_MODEL_${task.toUpperCase()}`] ||
    process.env.CRON_AI_MODEL ||
    tierDefault(provider, TASK_TIER[task]);
  return { apiKey, provider, model, baseUrl: process.env.CRON_AI_BASE_URL || "" };
}

/** One turn in a conversation with a paper. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The conversational call. Same client, same retries, same error translation as
 * `aiComplete` — it just takes prior turns, so a follow-up question is answered
 * knowing what was already asked. Every question used to be answered blind.
 */
export async function aiChat(
  config: AIConfig,
  systemPrompt: string,
  turns: ChatTurn[]
): Promise<string> {
  const client = new OpenAI(getClientConfig(config));
  const model = config.model || getDefaultModel(config.provider);

  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...turns,
        ],
        max_tokens: 4096,
      });

      return response.choices[0]?.message?.content || "";
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string; error?: { message?: string } };
      const status = err.status;
      if (status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt + 1) * 2000; // 4s, 8s, 16s, 32s
        console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      // Throw a readable error
      const message = err.error?.message || err.message || `API error (status ${status})`;
      console.error(`[AI] ${config.provider} error (status ${status}, model ${model}):`, message);
      if (status === 429) {
        throw new Error(`Rate limited by ${config.provider} after ${maxRetries} retries. Your API key may be on a free tier with low rate limits. Try a paid key or a different provider.`);
      }
      if (status === 401 || status === 403) {
        throw new Error(`Authentication failed for ${config.provider}. Check your API key in settings.`);
      }
      if (status === 402) {
        throw new Error(`Insufficient credits for ${config.provider}. Add funds or switch to another configured provider.`);
      }
      if (status === 400) {
        throw new Error(`Bad request for ${config.provider} model "${model}". Check CRON_AI_PROVIDER and CRON_AI_MODEL in Vercel; model IDs must be exact. Details: ${message}`);
      }
      throw new Error(`${config.provider} API error: ${message}`);
    }
  }

  return "";
}

export async function aiComplete(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return aiChat(config, systemPrompt, [{ role: "user", content: userPrompt }]);
}

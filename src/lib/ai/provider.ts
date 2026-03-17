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
    case "anthropic": return "claude-sonnet-4-20250514";
    case "gemini": return "gemini-2.5-flash";
    case "openai": return "gpt-4o";
    default: return "gpt-4o";
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function aiComplete(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
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
          { role: "user", content: userPrompt },
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
      if (status === 429) {
        throw new Error(`Rate limited by ${config.provider} after ${maxRetries} retries. Your API key may be on a free tier with low rate limits. Try a paid key or a different provider.`);
      }
      if (status === 401 || status === 403) {
        throw new Error(`Authentication failed for ${config.provider}. Check your API key in settings.`);
      }
      throw new Error(`${config.provider} API error: ${message}`);
    }
  }

  return "";
}

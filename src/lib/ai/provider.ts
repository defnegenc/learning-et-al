import OpenAI from "openai";

export interface AIConfig {
  apiKey: string;
  provider: "openai" | "anthropic" | "other";
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
    case "openai":
      return { apiKey: config.apiKey };
    case "other":
      return { apiKey: config.apiKey, baseURL: config.baseUrl };
  }
}

function getDefaultModel(provider: AIConfig["provider"]) {
  switch (provider) {
    case "anthropic": return "claude-sonnet-4-20250514";
    case "openai": return "gpt-4o";
    default: return "gpt-4o";
  }
}

export async function aiComplete(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = new OpenAI(getClientConfig(config));
  const model = config.model || getDefaultModel(config.provider);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "";
}

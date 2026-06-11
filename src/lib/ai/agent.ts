import OpenAI from "openai";
import type { AIConfig } from "./provider";
import { extractJson } from "./parse";

// A source the agent can cite — either one of the digest's papers or one it found.
export interface AgentSource {
  id: string;
  title: string;
  authors: string[];
  year?: number | null;
  venue?: string;
  url?: string | null;
  summary: string;
  origin: "digest" | "discovered";
}

// A tool the agent may call. `run` does the work and returns sources + a human status line.
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  run: (args: Record<string, unknown>) => Promise<{ status: string; sources: AgentSource[] }>;
}

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "source"; source: AgentSource };

export interface AgentResult {
  answer: string;            // prose with [N] citation markers (N = 1-based index into `sources`)
  seeds: string[];           // 2–3 nested follow-up questions
  sources: AgentSource[];    // every source in play, in [N] order
}

function clientFor(config: AIConfig): OpenAI {
  switch (config.provider) {
    case "anthropic":
      return new OpenAI({ apiKey: config.apiKey, baseURL: "https://api.anthropic.com/v1/", defaultHeaders: { "anthropic-version": "2023-06-01" } });
    case "gemini":
      return new OpenAI({ apiKey: config.apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
    case "other":
      return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    default:
      return new OpenAI({ apiKey: config.apiKey });
  }
}

function defaultModel(p: AIConfig["provider"]): string {
  return p === "anthropic" ? "claude-sonnet-4-20250514" : p === "gemini" ? "gemini-2.5-flash" : "gpt-4o";
}

/**
 * Runs a bounded tool-calling loop to answer a reader's follow-up question:
 *  1. GATHER — the model decides whether the digest's claims already answer the
 *     question; if not it calls tools (capped). Each tool result adds sources.
 *  2. WRITE — a final call produces the cited answer + nested follow-up questions.
 * Status/source events are emitted live via `emit` so the client can show progress.
 */
export async function runThreadAgent(opts: {
  config: AIConfig;
  question: string;
  verdict: string;
  trail: string[];
  claims: string;
  initialSources: AgentSource[];
  tools: AgentTool[];
  maxToolCalls?: number;
  emit: (ev: AgentEvent) => void;
}): Promise<AgentResult> {
  const { config, question, verdict, trail, claims, initialSources, tools, emit } = opts;
  const maxToolCalls = opts.maxToolCalls ?? 3;
  const client = clientFor(config);
  const model = config.model || defaultModel(config.provider);

  const pool: AgentSource[] = [...initialSources];
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const numbered = () =>
    pool.map((s, i) => `[${i + 1}] ${s.title}${s.year ? ` (${s.year})` : ""} — ${s.summary.slice(0, 220)}`).join("\n");

  const gatherSystem = `You are a research agent helping answer a reader's follow-up question about a daily research digest.

The digest's central reasoning:
${verdict}

What the digest's papers established:
${claims}

Sources already available:
${numbered()}

Decide whether the available claims already answer the question. If they do, DON'T call any tools — just reply briefly. If the question needs evidence the papers don't cover, call a tool (at most ${maxToolCalls} calls total): search_papers for scholarly evidence, search_web for current/real-world facts, search_vault for what the reader has already saved. Stop as soon as you can answer well.`;

  const toolDefs = tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: gatherSystem },
    {
      role: "user",
      content: trail.length
        ? `The reader has been pulling this thread: ${trail.join(" → ")}\n\nNow they ask: ${question}`
        : question,
    },
  ];

  let calls = 0;
  while (calls < maxToolCalls) {
    let resp;
    try {
      resp = await client.chat.completions.create({ model, messages, tools: toolDefs, tool_choice: "auto", max_tokens: 1024 });
    } catch {
      break; // tool-calling unsupported or transient error — fall through to write phase
    }
    const msg = resp.choices[0]?.message;
    const toolCalls = msg?.tool_calls;
    if (!msg || !toolCalls || toolCalls.length === 0) break;

    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });

    for (const tc of toolCalls) {
      if (tc.type !== "function") { messages.push({ role: "tool", tool_call_id: tc.id, content: "Unsupported tool call." }); continue; }
      if (calls >= maxToolCalls) { messages.push({ role: "tool", tool_call_id: tc.id, content: "Tool budget exhausted; answer with what you have." }); continue; }
      calls++;
      const tool = toolByName.get(tc.function.name);
      if (!tool) { messages.push({ role: "tool", tool_call_id: tc.id, content: "Unknown tool." }); continue; }

      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep empty */ }

      let result: { status: string; sources: AgentSource[] };
      try { result = await tool.run(args); } catch { result = { status: "A search failed.", sources: [] }; }
      emit({ type: "status", text: result.status });

      const added: string[] = [];
      for (const s of result.sources) {
        if (pool.some((p) => p.id === s.id || p.title.toLowerCase() === s.title.toLowerCase())) continue;
        pool.push(s);
        emit({ type: "source", source: s });
        added.push(`[${pool.length}] ${s.title}${s.year ? ` (${s.year})` : ""} — ${s.summary.slice(0, 220)}`);
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: added.length ? `Found:\n${added.join("\n")}` : "No new sources found." });
    }
  }

  // WRITE phase — cited answer + nested follow-ups as JSON
  const writeSystem = `Answer the reader's question in 3–5 sentences. Take a position and lead with the answer — no "based on the research" preamble. Ground every claim in the sources below and cite them inline as [N] using the bracketed number. Only cite a source that actually supports the point. Then propose 2–3 short follow-up questions a curious reader would ask next — gaps your answer hints at but doesn't fully resolve.

Sources:
${numbered()}

Return ONLY JSON, no prose outside it:
{"answer": "your answer with [N] citations", "followups": ["question 1", "question 2"]}`;

  let answer = "";
  let seeds: string[] = [];
  try {
    const raw = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: writeSystem }, { role: "user", content: question }],
      max_tokens: 900,
    });
    const text = raw.choices[0]?.message?.content || "";
    const parsed = extractJson<{ answer: string; followups: string[] }>(text);
    if (parsed?.answer) {
      answer = parsed.answer;
      seeds = Array.isArray(parsed.followups) ? parsed.followups.slice(0, 3) : [];
    } else {
      answer = text;
    }
  } catch {
    answer = "I couldn't finish researching that thread just now. Try again in a moment.";
  }

  return { answer, seeds, sources: pool };
}

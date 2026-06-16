import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { digests, papers, threadCache } from "@/lib/db/schema";
import { and, eq, asc, desc, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import type { AIConfig } from "@/lib/ai/provider";
import { runThreadAgent, type AgentSource, type AgentTool } from "@/lib/ai/agent";
import { searchOpenAlex } from "@/lib/fetchers/open-alex";
import { searchSemanticScholar } from "@/lib/fetchers/semantic-scholar";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { webSearch } from "@/lib/fetchers/web-search";
import { embedText, embedBatch, cosineSimilarity } from "@/lib/embeddings";

export const maxDuration = 60;

const QUERY_SCHEMA = {
  type: "object",
  properties: { query: { type: "string", description: "the search query" } },
  required: ["query"],
} as const;

function discoveredId(url: string | null | undefined, title: string): string {
  if (url) return `disc:${url}`;
  return `disc:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const digestId: string | undefined = body.digestId;
  const question: string | undefined = body.question;
  const trail: string[] = Array.isArray(body.trail) ? body.trail.map(String) : [];
  const focusPaperId: string | undefined = body.focusPaperId || undefined;
  const concise: boolean = body.concise === true;
  if (!digestId || !question) return new Response(JSON.stringify({ error: "Missing digestId or question" }), { status: 400 });

  const digest = await db.query.digests.findFirst({ where: eq(digests.id, digestId) });
  if (!digest) return new Response(JSON.stringify({ error: "Digest not found" }), { status: 404 });

  // Cache: thread answers are pinned to the digest's content, which never changes
  // after generation — so one agent run per (digest, question, trail, focus), ever.
  // focusPaperId is folded into the trail key so paper-first answers cache separately.
  // Cache failures are non-fatal (e.g. table not yet pushed to prod).
  const trailKey = `${concise ? "c|" : ""}${focusPaperId ? `focus:${focusPaperId}|` : ""}${trail.join(" → ")}`;
  const cached = await db.query.threadCache
    .findFirst({ where: and(eq(threadCache.digestId, digestId), eq(threadCache.question, question), eq(threadCache.trailKey, trailKey)) })
    .catch(() => null);
  if (cached) {
    const payload = {
      type: "result",
      answer: cached.answer,
      seeds: cached.seeds ? (JSON.parse(cached.seeds) as string[]) : [],
      sources: cached.sources ? (JSON.parse(cached.sources) as AgentSource[]) : [],
    };
    return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
    });
  }

  const digestPapers = await db.query.papers.findMany({
    where: eq(papers.digestId, digestId),
    orderBy: asc(papers.sourceIndex),
  });

  const initialSources: AgentSource[] = digestPapers.map((p) => {
    const authors = p.authors ? (JSON.parse(p.authors) as string[]) : [];
    return {
      id: p.id,
      title: p.title,
      authors,
      year: p.year,
      url: p.sourceUrl,
      summary: p.summary || (p.abstract || "").slice(0, 300),
      origin: "digest" as const,
    };
  });

  const claims = digestPapers
    .map((p, i) => {
      const findings = p.keyFindings ? (JSON.parse(p.keyFindings) as string[]) : [];
      return `[${i + 1}] ${p.title}: ${findings.join("; ") || p.summary || ""}`;
    })
    .join("\n");

  // AIConfig: BYOK override → server CRON key fallback (mirrors /api/digest/chat)
  const cronProvider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
  const cronModel =
    process.env.CRON_AI_MODEL ||
    (cronProvider === "anthropic" ? "claude-sonnet-4-6" : cronProvider === "openai" ? "gpt-4o" : "gemini-2.5-flash");
  const config: AIConfig = {
    apiKey: body.apiKey || process.env.CRON_AI_KEY || "",
    provider: (body.provider as AIConfig["provider"]) || cronProvider,
    model: body.model || cronModel,
    baseUrl: body.baseUrl || "",
  };
  if (!config.apiKey) return new Response(JSON.stringify({ error: "No AI key configured" }), { status: 400 });

  const tools: AgentTool[] = [
    {
      name: "search_papers",
      description: "Search the scholarly literature (OpenAlex, then Semantic Scholar, then arXiv) for papers on a topic. Use when the question needs evidence the digest's papers don't cover.",
      parameters: QUERY_SCHEMA,
      run: async (args) => {
        const q = String(args.query || "").trim();
        if (!q) return { status: "Searched the literature", sources: [] };
        let sources: AgentSource[] = [];
        const oa = await searchOpenAlex(q, undefined, "cited_by_count", 4).catch(() => []);
        sources = oa.filter((p) => p.abstract).map((p) => ({
          id: p.openAlexId || discoveredId(p.sourceUrl, p.title),
          title: p.title, authors: p.authors, year: p.year, venue: p.venueName, url: p.sourceUrl,
          summary: p.abstract.slice(0, 300), origin: "discovered" as const,
        }));
        if (!sources.length) {
          const ss = await searchSemanticScholar(q, 4).catch(() => []);
          sources = ss.filter((p) => p.abstract).map((p) => ({
            id: p.paperId || discoveredId(p.sourceUrl, p.title),
            title: p.title, authors: p.authors, year: p.year, url: p.sourceUrl,
            summary: p.abstract.slice(0, 300), origin: "discovered" as const,
          }));
        }
        if (!sources.length) {
          const ax = await searchArxiv(q, 4).catch(() => []);
          sources = ax.filter((p) => p.abstract).map((p) => ({
            id: discoveredId(p.sourceUrl, p.title),
            title: p.title, authors: p.authors, year: null, url: p.sourceUrl,
            summary: p.abstract.slice(0, 300), origin: "discovered" as const,
          }));
        }
        return { status: `Searched the literature for “${q}”`, sources: sources.slice(0, 3) };
      },
    },
    {
      name: "search_web",
      description: "Search the web for current events, real-world examples, products, or facts not in the scholarly literature.",
      parameters: QUERY_SCHEMA,
      run: async (args) => {
        const q = String(args.query || "").trim();
        if (!q) return { status: "Searched the web", sources: [] };
        const results = await webSearch(q, 4).catch(() => []);
        const sources: AgentSource[] = results.map((r) => ({
          id: discoveredId(r.link, r.title),
          title: r.title, authors: [], year: null, venue: r.source, url: r.link,
          summary: r.snippet, origin: "discovered" as const,
        }));
        return { status: `Searched the web for “${q}”`, sources: sources.slice(0, 3) };
      },
    },
    {
      name: "search_vault",
      description: "Search the papers the reader has already saved across their past digests. Use to connect the answer to what they already know.",
      parameters: QUERY_SCHEMA,
      run: async (args) => {
        const q = String(args.query || "").trim();
        if (!q) return { status: "Looked through your vault", sources: [] };
        const userDigests = await db.query.digests.findMany({ where: eq(digests.userId, userId), columns: { id: true } });
        const ids = userDigests.map((d) => d.id);
        if (!ids.length) return { status: "Your vault is empty", sources: [] };
        const saved = await db.query.papers.findMany({ where: inArray(papers.digestId, ids), orderBy: desc(papers.createdAt), limit: 60 });
        if (!saved.length) return { status: "Your vault is empty", sources: [] };
        const [qEmb, embs] = await Promise.all([
          embedText(q),
          embedBatch(saved.map((p) => `${p.title}. ${(p.summary || p.abstract || "").slice(0, 300)}`)),
        ]);
        const ranked = saved
          .map((p, i) => ({ p, score: cosineSimilarity(qEmb, embs[i]) }))
          .sort((a, b) => b.score - a.score)
          .filter((r) => r.score > 0.2)
          .slice(0, 3);
        const sources: AgentSource[] = ranked.map(({ p }) => {
          const authors = p.authors ? (JSON.parse(p.authors) as string[]) : [];
          return { id: p.id, title: p.title, authors, year: p.year, url: p.sourceUrl, summary: p.summary || (p.abstract || "").slice(0, 300), origin: "discovered" as const };
        });
        return { status: `Looked through your vault for “${q}”`, sources };
      },
    },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const result = await runThreadAgent({
          config,
          question,
          verdict: digest.synthesisContent || "",
          trail,
          claims,
          initialSources,
          tools,
          focusPaperId,
          concise,
          // Paper-first answers come straight from the paper — skip the gather/search
          // loop so it's one model call, not two-plus. Keeps "thinking" short.
          maxToolCalls: focusPaperId ? 0 : undefined,
          emit: (ev) => send(ev),
        });
        send({ type: "result", answer: result.answer, seeds: result.seeds, sources: result.sources });
        if (!result.failed && result.answer) {
          await db
            .insert(threadCache)
            .values({ digestId, question, trailKey, answer: result.answer, seeds: JSON.stringify(result.seeds), sources: JSON.stringify(result.sources) })
            .catch(() => {});
        }
      } catch (e) {
        send({ type: "error", message: (e as Error).message || "Thread failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

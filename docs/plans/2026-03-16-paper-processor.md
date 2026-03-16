# Paper Processor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MVP research paper recommendation and synthesis system — a Next.js web app that auto-generates daily digests of contrasting papers/articles, lets users Q&A them, and accumulate a knowledge vault.

**Architecture:** Next.js App Router with SQLite (Drizzle ORM) for persistence, shadcn/ui for components, and an AI provider abstraction layer that works with any OpenAI-compatible API (Claude, GPT, etc.). A cron scheduler fetches arXiv papers + RSS articles at 5am, downloads PDFs, parses full text, and runs AI synthesis. All pre-computed so the user sees results instantly.

**Tech Stack:** Next.js 14+, TypeScript, SQLite, Drizzle ORM, Tailwind CSS, shadcn/ui, pdf-parse, rss-parser, node-cron, react-force-graph, OpenAI SDK (model-agnostic)

---

### Task 1: Project Scaffold + DB Schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`
- Create: `drizzle.config.ts`

**Step 1: Initialize Next.js project**

```bash
cd /Users/defnegenc/Developer/paper-processor
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This gives us Next.js + Tailwind + TypeScript + App Router.

**Step 2: Install core dependencies**

```bash
npm install drizzle-orm better-sqlite3 @types/better-sqlite3
npm install -D drizzle-kit
npm install openai pdf-parse @types/pdf-parse rss-parser node-cron @types/node-cron
npm install react-force-graph-2d
```

**Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select defaults: New York style, Zinc color, CSS variables.

**Step 4: Add shadcn components we'll need**

```bash
npx shadcn@latest add button card input textarea badge tabs dialog toast separator scroll-area
```

**Step 5: Create DB schema**

Create `src/lib/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  timezone: text("timezone").default("America/New_York"),
});

export const interests = sqliteTable("interests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  keyword: text("keyword").notNull(),
  weight: real("weight").default(1.0),
  source: text("source", { enum: ["seed", "star", "engagement", "dislike"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const digests = sqliteTable("digests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  date: text("date").notNull(), // YYYY-MM-DD
  synthesisContent: text("synthesis_content"), // overall contrast/synthesis
  keyConcepts: text("key_concepts"), // JSON array of extracted concept tags
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const papers = sqliteTable("papers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  digestId: text("digest_id").notNull().references(() => digests.id),
  title: text("title").notNull(),
  authors: text("authors"), // JSON array
  abstract: text("abstract"),
  fullText: text("full_text"),
  summary: text("summary"), // AI-generated individual summary
  source: text("source", { enum: ["arxiv", "rss"] }).notNull(),
  sourceUrl: text("source_url"),
  pdfUrl: text("pdf_url"),
  keywords: text("keywords"), // JSON array of extracted keywords
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const qaPairs = sqliteTable("qa_pairs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id").notNull().references(() => papers.id),
  userId: text("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id").notNull().references(() => papers.id),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["star", "dislike"] }).notNull(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const comparisons = sqliteTable("comparisons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  paperIds: text("paper_ids").notNull(), // JSON array
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

**Step 6: Create DB connection**

Create `src/lib/db/index.ts`:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.join(process.cwd(), "paper-processor.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
```

**Step 7: Create Drizzle config**

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./paper-processor.db",
  },
});
```

**Step 8: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Step 9: Init git repo and commit**

```bash
git init
# Add .db files to .gitignore
echo "paper-processor.db" >> .gitignore
git add -A
git commit -m "feat: scaffold Next.js project with SQLite schema"
```

---

### Task 2: AI Provider Abstraction

**Files:**
- Create: `src/lib/ai/provider.ts`
- Create: `src/lib/ai/prompts.ts`

**Step 1: Create AI provider wrapper**

Create `src/lib/ai/provider.ts`:

```typescript
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
```

**Step 2: Create prompt templates**

Create `src/lib/ai/prompts.ts`:

```typescript
export const SYNTHESIS_SYSTEM = `You are a research synthesis expert. You analyze academic papers and news articles, highlighting contrasting perspectives, key findings, and connections between them. Be concise but insightful. Use markdown formatting.`;

export function synthesisPrompt(papers: { title: string; abstract: string; fullText: string; source: string }[]) {
  const paperSummaries = papers.map((p, i) =>
    `## Paper ${i + 1}: ${p.title} (${p.source})\n\nAbstract: ${p.abstract}\n\nFull text (truncated): ${p.fullText.slice(0, 8000)}`
  ).join("\n\n---\n\n");

  return `Analyze these ${papers.length} papers/articles and produce:
1. A one-line summary for each
2. A synthesis section highlighting how they CONTRAST with each other — different perspectives, contradictory findings, complementary angles
3. Key takeaways connecting them to broader themes
4. A JSON array of 5-8 key concept tags (short phrases) at the very end, on its own line, prefixed with "KEY_CONCEPTS:" — e.g. KEY_CONCEPTS:["attention mechanisms","few-shot learning","model efficiency"]

${paperSummaries}`;
}

export function paperSummaryPrompt(title: string, fullText: string) {
  return `Summarize this paper in 2-3 sentences, focusing on the key contribution and finding:

Title: ${title}
Text: ${fullText.slice(0, 10000)}`;
}

export function qaPrompt(paperTitle: string, fullText: string, question: string) {
  return `You are answering questions about the following paper. Use the full text to give accurate, specific answers. Cite relevant sections when possible.

Title: ${paperTitle}
Full text: ${fullText.slice(0, 15000)}

Question: ${question}`;
}

export function comparisonPrompt(papers: { title: string; fullText: string }[]) {
  const texts = papers.map((p, i) =>
    `## Item ${i + 1}: ${p.title}\n\n${p.fullText.slice(0, 8000)}`
  ).join("\n\n---\n\n");

  return `Compare and contrast these ${papers.length} items. Highlight:
1. Where they AGREE
2. Where they DISAGREE or offer different perspectives
3. Complementary insights — what does combining them reveal?

${texts}`;
}

export function keywordExtractionPrompt(title: string, abstract: string) {
  return `Extract 3-5 specific research keywords/topics from this paper. Return ONLY a JSON array of strings, nothing else.

Title: ${title}
Abstract: ${abstract}`;
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/
git commit -m "feat: add AI provider abstraction and prompt templates"
```

---

### Task 3: Fetcher Pipeline (arXiv + RSS)

**Files:**
- Create: `src/lib/fetchers/arxiv.ts`
- Create: `src/lib/fetchers/rss.ts`
- Create: `src/lib/fetchers/pdf.ts`
- Create: `src/lib/pipeline/digest.ts`

**Step 1: Create arXiv fetcher**

Create `src/lib/fetchers/arxiv.ts`:

```typescript
interface ArxivPaper {
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
  pdfUrl: string;
}

export async function searchArxiv(query: string, maxResults = 10): Promise<ArxivPaper[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  const response = await fetch(url);
  const text = await response.text();

  // Parse Atom XML
  const entries = text.split("<entry>").slice(1);
  return entries.map((entry) => {
    const getTag = (tag: string) => {
      const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return match ? match[1].trim() : "";
    };

    const authors = [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)].map(m => m[1]);
    const pdfLink = entry.match(/href="([^"]*)"[^>]*title="pdf"/)?.[1] || "";

    return {
      title: getTag("title").replace(/\n/g, " "),
      authors,
      abstract: getTag("summary").replace(/\n/g, " "),
      sourceUrl: getTag("id"),
      pdfUrl: pdfLink,
    };
  });
}
```

**Step 2: Create RSS fetcher**

Create `src/lib/fetchers/rss.ts`:

```typescript
import Parser from "rss-parser";

interface RssArticle {
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
}

const RSS_FEEDS = [
  "https://techcrunch.com/feed/",
  "https://feeds.arstechnica.com/arstechnica/technology-lab",
  "https://www.wired.com/feed/rss",
];

const parser = new Parser();

export async function fetchRssArticles(keywords: string[], maxPerFeed = 5): Promise<RssArticle[]> {
  const articles: RssArticle[] = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.slice(0, maxPerFeed);

      for (const item of items) {
        articles.push({
          title: item.title || "Untitled",
          authors: item.creator ? [item.creator] : [],
          abstract: item.contentSnippet || item.content || "",
          sourceUrl: item.link || "",
        });
      }
    } catch (e) {
      console.error(`Failed to fetch RSS feed ${feedUrl}:`, e);
    }
  }

  // Score articles by keyword relevance
  const scored = articles.map((article) => {
    const text = `${article.title} ${article.abstract}`.toLowerCase();
    const score = keywords.reduce((sum, kw) => sum + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    return { article, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.article);
}
```

**Step 3: Create PDF parser**

Create `src/lib/fetchers/pdf.ts`:

```typescript
import pdf from "pdf-parse";

export async function downloadAndParsePdf(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const data = await pdf(buffer);
    return data.text;
  } catch (e) {
    console.error(`Failed to parse PDF from ${pdfUrl}:`, e);
    return "";
  }
}
```

**Step 4: Create digest pipeline**

Create `src/lib/pipeline/digest.ts`:

```typescript
import { db } from "@/lib/db";
import { digests, papers, interests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { downloadAndParsePdf } from "@/lib/fetchers/pdf";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { synthesisPrompt, paperSummaryPrompt, keywordExtractionPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

export async function generateDigest(userId: string, aiConfig: AIConfig) {
  const today = new Date().toISOString().split("T")[0];

  // Check if digest already exists for today
  const existing = await db.query.digests.findFirst({
    where: eq(digests.date, today),
  });
  if (existing) return existing;

  // Get user's weighted interests
  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });

  const topKeywords = userInterests.slice(0, 10).map((i) => i.keyword);
  const searchQuery = topKeywords.join(" OR ");

  // Fetch papers and articles in parallel
  const [arxivPapers, rssArticles] = await Promise.all([
    searchArxiv(searchQuery, 10),
    fetchRssArticles(topKeywords),
  ]);

  // Pick top 3 of each (diverse selection)
  const selectedArxiv = arxivPapers.slice(0, 3);
  const selectedRss = rssArticles.slice(0, 3);

  // Create digest record
  const [digest] = await db.insert(digests).values({
    userId,
    date: today,
  }).returning();

  // Process arXiv papers: download PDFs and parse
  for (const paper of selectedArxiv) {
    const fullText = paper.pdfUrl ? await downloadAndParsePdf(paper.pdfUrl) : paper.abstract;
    const summary = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, paperSummaryPrompt(paper.title, fullText));
    const keywordsJson = await aiComplete(aiConfig, "You extract keywords from papers.", keywordExtractionPrompt(paper.title, paper.abstract));

    let extractedKeywords: string[] = [];
    try { extractedKeywords = JSON.parse(keywordsJson); } catch {}

    await db.insert(papers).values({
      digestId: digest.id,
      title: paper.title,
      authors: JSON.stringify(paper.authors),
      abstract: paper.abstract,
      fullText,
      summary,
      source: "arxiv",
      sourceUrl: paper.sourceUrl,
      pdfUrl: paper.pdfUrl,
      keywords: JSON.stringify(extractedKeywords),
    });
  }

  // Process RSS articles (no PDF, use abstract as full text)
  for (const article of selectedRss) {
    const summary = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, paperSummaryPrompt(article.title, article.abstract));
    const keywordsJson = await aiComplete(aiConfig, "You extract keywords from papers.", keywordExtractionPrompt(article.title, article.abstract));

    let extractedKeywords: string[] = [];
    try { extractedKeywords = JSON.parse(keywordsJson); } catch {}

    await db.insert(papers).values({
      digestId: digest.id,
      title: article.title,
      authors: JSON.stringify(article.authors),
      abstract: article.abstract,
      fullText: article.abstract,
      summary,
      source: "rss",
      sourceUrl: article.sourceUrl,
      keywords: JSON.stringify(extractedKeywords),
    });
  }

  // Generate overall synthesis
  const allPapers = await db.query.papers.findMany({
    where: eq(papers.digestId, digest.id),
  });

  const synthesisContent = await aiComplete(
    aiConfig,
    SYNTHESIS_SYSTEM,
    synthesisPrompt(allPapers.map((p) => ({
      title: p.title,
      abstract: p.abstract || "",
      fullText: p.fullText || "",
      source: p.source,
    })))
  );

  // Extract key concepts from synthesis
  let keyConcepts: string[] = [];
  const conceptMatch = synthesisContent.match(/KEY_CONCEPTS:\s*(\[.*?\])/);
  if (conceptMatch) {
    try { keyConcepts = JSON.parse(conceptMatch[1]); } catch {}
  }
  const cleanedSynthesis = synthesisContent.replace(/KEY_CONCEPTS:\s*\[.*?\]/, "").trim();

  await db.update(digests)
    .set({ synthesisContent: cleanedSynthesis, keyConcepts: JSON.stringify(keyConcepts) })
    .where(eq(digests.id, digest.id));

  return { ...digest, synthesisContent: cleanedSynthesis, keyConcepts: JSON.stringify(keyConcepts) };
}
```

**Step 5: Commit**

```bash
git add src/lib/fetchers/ src/lib/pipeline/
git commit -m "feat: add arXiv, RSS fetchers, PDF parser, and digest pipeline"
```

---

### Task 4: API Routes

**Files:**
- Create: `src/app/api/setup/route.ts`
- Create: `src/app/api/digest/route.ts`
- Create: `src/app/api/digest/generate/route.ts`
- Create: `src/app/api/papers/[id]/qa/route.ts`
- Create: `src/app/api/papers/[id]/feedback/route.ts`
- Create: `src/app/api/vault/route.ts`
- Create: `src/app/api/vault/compare/route.ts`
- Create: `src/app/api/interests/route.ts`
- Create: `src/lib/session.ts`

**Step 1: Create session helper**

Create `src/lib/session.ts`:

```typescript
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function getOrCreateUser(): Promise<string> {
  const cookieStore = await cookies();
  let userId = cookieStore.get("user_id")?.value;

  if (userId) {
    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (existing) return userId;
  }

  const [user] = await db.insert(users).values({}).returning();
  // Note: cookie setting happens in the route handler
  return user.id;
}
```

**Step 2: Create setup route (onboarding)**

Create `src/app/api/setup/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { interestStrings, timezone } = await req.json();

  // Create user
  const [user] = await db.insert(users).values({
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).returning();

  // Insert seed interests — split multi-word strings into the full phrase as one keyword
  for (const phrase of interestStrings) {
    await db.insert(interests).values({
      userId: user.id,
      keyword: phrase.trim(),
      weight: 1.0,
      source: "seed",
    });
  }

  const response = NextResponse.json({ userId: user.id });
  response.cookies.set("user_id", user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}
```

**Step 3: Create digest routes**

Create `src/app/api/digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");

  const digest = date
    ? await db.query.digests.findFirst({
        where: eq(digests.date, date),
      })
    : await db.query.digests.findFirst({
        where: eq(digests.userId, userId),
        orderBy: desc(digests.createdAt),
      });

  if (!digest) return NextResponse.json({ digest: null, papers: [] });

  const digestPapers = await db.query.papers.findMany({
    where: eq(papers.digestId, digest.id),
  });

  return NextResponse.json({ digest, papers: digestPapers });
}
```

Create `src/app/api/digest/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/pipeline/digest";

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const { apiKey, provider, model, baseUrl } = await req.json();
  if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

  try {
    const digest = await generateDigest(userId, { apiKey, provider, model, baseUrl });
    return NextResponse.json({ digest });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Step 4: Create Q&A route**

Create `src/app/api/papers/[id]/qa/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, qaPairs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/provider";
import { qaPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pairs = await db.query.qaPairs.findMany({
    where: eq(qaPairs.paperId, id),
  });
  return NextResponse.json({ qaPairs: pairs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const { question, apiKey, provider, model, baseUrl } = await req.json();

  const paper = await db.query.papers.findFirst({
    where: eq(papers.id, id),
  });
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  const answer = await aiComplete(
    { apiKey, provider, model, baseUrl },
    SYNTHESIS_SYSTEM,
    qaPrompt(paper.title, paper.fullText || paper.abstract || "", question)
  );

  const [qa] = await db.insert(qaPairs).values({
    paperId: id,
    userId,
    question,
    answer,
  }).returning();

  return NextResponse.json({ qa });
}
```

**Step 5: Create feedback route**

Create `src/app/api/papers/[id]/feedback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedback, papers, interests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/provider";
import { keywordExtractionPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const { type, reason, apiKey, provider, model, baseUrl } = await req.json();

  const paper = await db.query.papers.findFirst({
    where: eq(papers.id, id),
  });
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  // Save feedback
  await db.insert(feedback).values({
    paperId: id,
    userId,
    type,
    reason,
  });

  // Update interest weights based on feedback
  const paperKeywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];

  if (type === "star") {
    // Boost related keywords
    for (const kw of paperKeywords) {
      const existing = await db.query.interests.findFirst({
        where: and(eq(interests.userId, userId), eq(interests.keyword, kw)),
      });
      if (existing) {
        await db.update(interests)
          .set({ weight: existing.weight! + 0.5, updatedAt: new Date() })
          .where(eq(interests.id, existing.id));
      } else {
        await db.insert(interests).values({
          userId,
          keyword: kw,
          weight: 0.5,
          source: "star",
        });
      }
    }
  } else if (type === "dislike") {
    // Slightly reduce related keywords
    for (const kw of paperKeywords) {
      const existing = await db.query.interests.findFirst({
        where: and(eq(interests.userId, userId), eq(interests.keyword, kw)),
      });
      if (existing && existing.weight! > 0.1) {
        await db.update(interests)
          .set({ weight: existing.weight! - 0.2, updatedAt: new Date(), source: "dislike" })
          .where(eq(interests.id, existing.id));
      }
    }
  }

  return NextResponse.json({ success: true });
}
```

**Step 6: Create vault routes**

Create `src/app/api/vault/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, digests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "12");
  const search = req.nextUrl.searchParams.get("search") || "";

  // Get all digests for user, then get papers
  const userDigests = await db.query.digests.findMany({
    where: eq(digests.userId, userId),
  });

  const digestIds = userDigests.map((d) => d.id);
  if (digestIds.length === 0) return NextResponse.json({ papers: [], total: 0 });

  const allPapers = await db.query.papers.findMany({
    orderBy: desc(papers.createdAt),
  });

  // Filter to user's papers and search
  let filtered = allPapers.filter((p) => digestIds.includes(p.digestId));
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.abstract || "").toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ papers: paginated, total, page, limit });
}
```

Create `src/app/api/vault/compare/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, comparisons } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/provider";
import { comparisonPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const { paperIds, apiKey, provider, model, baseUrl } = await req.json();

  if (!paperIds || paperIds.length < 2 || paperIds.length > 3) {
    return NextResponse.json({ error: "Select 2-3 papers to compare" }, { status: 400 });
  }

  const selectedPapers = await Promise.all(
    paperIds.map((id: string) => db.query.papers.findFirst({ where: eq(papers.id, id) }))
  );

  const validPapers = selectedPapers.filter(Boolean);
  if (validPapers.length < 2) {
    return NextResponse.json({ error: "Papers not found" }, { status: 404 });
  }

  const content = await aiComplete(
    { apiKey, provider, model, baseUrl },
    SYNTHESIS_SYSTEM,
    comparisonPrompt(validPapers.map((p: any) => ({
      title: p.title,
      fullText: p.fullText || p.abstract || "",
    })))
  );

  const [comparison] = await db.insert(comparisons).values({
    userId,
    paperIds: JSON.stringify(paperIds),
    content,
  }).returning();

  return NextResponse.json({ comparison });
}
```

**Step 7: Create interests route**

Create `src/app/api/interests/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Not set up" }, { status: 401 });

  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });

  return NextResponse.json({ interests: userInterests });
}
```

**Step 8: Commit**

```bash
git add src/app/api/ src/lib/session.ts
git commit -m "feat: add all API routes — setup, digest, Q&A, feedback, vault, compare"
```

---

### Task 5: Onboarding UI (API Key + Interests)

**Files:**
- Create: `src/app/page.tsx` (modify)
- Create: `src/components/onboarding.tsx`
- Create: `src/lib/hooks/use-session.ts`

**Step 1: Create session hook**

Create `src/lib/hooks/use-session.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";

interface Session {
  userId: string | null;
  apiKey: string;
  provider: "openai" | "anthropic" | "other";
  model: string;
  baseUrl: string;
  isSetUp: boolean;
}

export function useSession() {
  const [session, setSession] = useState<Session>({
    userId: null,
    apiKey: "",
    provider: "openai",
    model: "",
    baseUrl: "",
    isSetUp: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem("pp_session");
    if (stored) {
      setSession(JSON.parse(stored));
    }
  }, []);

  const updateSession = (updates: Partial<Session>) => {
    const newSession = { ...session, ...updates };
    setSession(newSession);
    localStorage.setItem("pp_session", JSON.stringify(newSession));
  };

  return { session, updateSession };
}
```

**Step 2: Create onboarding component**

Create `src/components/onboarding.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OnboardingProps {
  onComplete: (data: {
    userId: string;
    apiKey: string;
    provider: "openai" | "anthropic" | "other";
    model: string;
    baseUrl: string;
  }) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<"apikey" | "interests">("apikey");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "other">("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [currentInterest, setCurrentInterest] = useState("");
  const [loading, setLoading] = useState(false);

  const addInterest = () => {
    const trimmed = currentInterest.trim();
    if (trimmed && interests.length < 5 && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setCurrentInterest("");
    }
  };

  const removeInterest = (i: number) => {
    setInterests(interests.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestStrings: interests,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      onComplete({ userId: data.userId, apiKey, provider, model, baseUrl });
    } catch (e) {
      console.error("Setup failed:", e);
    } finally {
      setLoading(false);
    }
  };

  if (step === "apikey") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Paper Processor</h1>
            <p className="text-muted-foreground">Your AI research assistant</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Provider</label>
              <div className="flex gap-2">
                {(["openai", "anthropic", "other"] as const).map((p) => (
                  <Button
                    key={p}
                    variant={provider === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProvider(p)}
                  >
                    {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Other"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            {provider === "other" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base URL</label>
                  <Input
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Input
                    placeholder="model-name"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
              </>
            )}

            <Button className="w-full" onClick={() => setStep("interests")} disabled={!apiKey}>
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">What interests you?</h1>
          <p className="text-muted-foreground">Add 3-5 topics (3-5 words each)</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. transformer architecture optimization"
              value={currentInterest}
              onChange={(e) => setCurrentInterest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addInterest()}
            />
            <Button onClick={addInterest} disabled={interests.length >= 5}>Add</Button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {interests.map((interest, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => removeInterest(i)}
              >
                {interest} ×
              </Badge>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={interests.length < 3 || loading}
          >
            {loading ? "Setting up..." : "Start exploring"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

**Step 3: Update main page**

Modify `src/app/page.tsx`:

```tsx
"use client";

import { Onboarding } from "@/components/onboarding";
import { useSession } from "@/lib/hooks/use-session";

export default function Home() {
  const { session, updateSession } = useSession();

  if (!session.isSetUp) {
    return (
      <Onboarding
        onComplete={(data) => {
          updateSession({
            ...data,
            isSetUp: true,
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main app — built in next tasks */}
      <p className="p-8 text-muted-foreground">Welcome back! Digest UI coming next...</p>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/onboarding.tsx src/lib/hooks/use-session.ts src/app/page.tsx
git commit -m "feat: add onboarding UI — API key entry and interest selection"
```

---

### Task 6: Main Layout with Tabs (Today + Vault)

**Files:**
- Create: `src/components/app-shell.tsx`
- Create: `src/components/today/today-page.tsx`
- Create: `src/components/today/paper-card.tsx`
- Create: `src/components/today/synthesis-banner.tsx`
- Create: `src/components/today/knowledge-graph.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create app shell with tabs**

Create `src/components/app-shell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TodayPage } from "@/components/today/today-page";
import { VaultPage } from "@/components/vault/vault-page";

interface AppShellProps {
  session: {
    userId: string | null;
    apiKey: string;
    provider: "openai" | "anthropic" | "other";
    model: string;
    baseUrl: string;
  };
}

export function AppShell({ session }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Paper Processor</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="vault">Vault</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-6">
            <TodayPage session={session} />
          </TabsContent>

          <TabsContent value="vault" className="mt-6">
            <VaultPage session={session} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
```

**Step 2: Create paper card component**

Create `src/components/today/paper-card.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ThumbsDown } from "lucide-react";

interface PaperCardProps {
  paper: {
    id: string;
    title: string;
    authors: string;
    summary: string | null;
    source: string;
    sourceUrl: string | null;
    keywords: string | null;
  };
  onSelect: (id: string) => void;
  onStar: (id: string) => void;
  onDislike: (id: string) => void;
  isStarred?: boolean;
}

export function PaperCard({ paper, onSelect, onStar, onDislike, isStarred }: PaperCardProps) {
  const keywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => onSelect(paper.id)}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant={paper.source === "arxiv" ? "default" : "secondary"} className="shrink-0">
            {paper.source === "arxiv" ? "arXiv" : "News"}
          </Badge>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onStar(paper.id); }}
            >
              <Star className={`h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onDislike(paper.id); }}
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{paper.title}</h3>

        <p className="text-xs text-muted-foreground line-clamp-2">{paper.summary}</p>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 3).map((kw, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                {kw}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
```

**Step 3: Create synthesis banner**

Create `src/components/today/synthesis-banner.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SynthesisBannerProps {
  content: string | null;
  concepts: string[];
  onConceptClick?: (concept: string) => void;
  activeConcept?: string | null;
}

export function SynthesisBanner({ content, concepts, onConceptClick, activeConcept }: SynthesisBannerProps) {
  if (!content) return null;

  return (
    <Card className="p-6 bg-muted/50 border-dashed space-y-4">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
        Today&apos;s Synthesis
      </h2>

      {/* Clickable concept tags */}
      {concepts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {concepts.map((concept) => (
            <Badge
              key={concept}
              variant={activeConcept === concept ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => onConceptClick?.(concept)}
            >
              {concept}
            </Badge>
          ))}
        </div>
      )}

      <div className="prose prose-sm dark:prose-invert max-w-none">
        {content.split("\n").map((line, i) => (
          <p key={i} className="text-sm leading-relaxed">{line}</p>
        ))}
      </div>
    </Card>
  );
}
```

**Step 4: Create knowledge graph widget**

Create `src/components/today/knowledge-graph.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface KnowledgeGraphProps {
  interests: { keyword: string; weight: number; source: string }[];
  onNodeClick?: (keyword: string) => void;
}

interface GraphNode {
  id: string;
  label: string;
  weight: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const animRef = useRef<number>();

  useEffect(() => {
    const SIZE = 250;
    const initial: GraphNode[] = interests.slice(0, 15).map((interest, i) => {
      const angle = (i / interests.length) * Math.PI * 2;
      const r = 60 + Math.random() * 40;
      return {
        id: interest.keyword,
        label: interest.keyword,
        weight: interest.weight,
        x: SIZE / 2 + Math.cos(angle) * r,
        y: SIZE / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        color: interest.source === "seed" ? "#6366f1"
          : interest.source === "star" ? "#eab308"
          : interest.source === "engagement" ? "#22c55e"
          : "#94a3b8",
      };
    });
    setNodes(initial);
  }, [interests]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SIZE = 250;
    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Draw edges between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${1 - dist / 100})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const r = 4 + node.weight * 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Label
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText(node.label.length > 15 ? node.label.slice(0, 15) + "..." : node.label, node.x, node.y + r + 10);
      }
    };

    draw();

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const node of nodes) {
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < (8 + node.weight * 3) ** 2) {
          onNodeClick?.(node.id);
          break;
        }
      }
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [nodes, onNodeClick]);

  return (
    <Card className="p-3">
      <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Knowledge Graph
      </h3>
      <canvas
        ref={canvasRef}
        width={250}
        height={250}
        className="w-full aspect-square"
      />
    </Card>
  );
}
```

**Step 5: Create Today page**

Create `src/components/today/today-page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { PaperCard } from "./paper-card";
import { SynthesisBanner } from "./synthesis-banner";
import { KnowledgeGraph } from "./knowledge-graph";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface TodayPageProps {
  session: {
    apiKey: string;
    provider: "openai" | "anthropic" | "other";
    model: string;
    baseUrl: string;
  };
}

export function TodayPage({ session }: TodayPageProps) {
  const [digest, setDigest] = useState<any>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/digest");
      const data = await res.json();
      setDigest(data.digest);
      setPapers(data.papers || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch("/api/interests");
      const data = await res.json();
      setInterests(data.interests || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
    fetchInterests();
  }, [fetchDigest, fetchInterests]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      await fetchDigest();
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const handleStar = async (paperId: string) => {
    setStarred((prev) => new Set([...prev, paperId]));
    await fetch(`/api/papers/${paperId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "star", ...session }),
    });
    fetchInterests();
  };

  const handleDislike = async (paperId: string) => {
    const reason = prompt("What didn't you like? (optional)");
    await fetch(`/api/papers/${paperId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "dislike", reason, ...session }),
    });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!digest) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground">No digest yet for today.</p>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating (this may take a minute)...</>
          ) : (
            "Generate today's digest"
          )}
        </Button>
      </div>
    );
  }

  const arxivPapers = papers.filter((p) => p.source === "arxiv");
  const rssPapers = papers.filter((p) => p.source === "rss");

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <SynthesisBanner content={digest.synthesisContent} />

          <div>
            <h2 className="text-lg font-semibold mb-3">Research Papers</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {arxivPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onSelect={setSelectedPaper}
                  onStar={handleStar}
                  onDislike={handleDislike}
                  isStarred={starred.has(paper.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">News & Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rssPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onSelect={setSelectedPaper}
                  onStar={handleStar}
                  onDislike={handleDislike}
                  isStarred={starred.has(paper.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-[280px] shrink-0">
          <div className="sticky top-6">
            <KnowledgeGraph interests={interests} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add Today page with paper cards, synthesis banner, and knowledge graph"
```

---

### Task 7: Paper Detail View with Q&A

**Files:**
- Create: `src/components/today/paper-detail.tsx`
- Create: `src/components/today/qa-thread.tsx`
- Modify: `src/components/today/today-page.tsx`

**Step 1: Create Q&A thread component**

Create `src/components/today/qa-thread.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle } from "lucide-react";

interface QA {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface QAThreadProps {
  paperId: string;
  session: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
}

export function QAThread({ paperId, session }: QAThreadProps) {
  const [qaPairs, setQaPairs] = useState<QA[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/papers/${paperId}/qa`)
      .then((r) => r.json())
      .then((data) => setQaPairs(data.qaPairs || []));
  }, [paperId]);

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ...session }),
      });
      const data = await res.json();
      setQaPairs([...qaPairs, data.qa]);
      setQuestion("");
      setExpanded((prev) => new Set([...prev, data.qa.id]));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        Q&A ({qaPairs.length})
      </h3>

      {/* Existing Q&A pairs */}
      <div className="space-y-2">
        {qaPairs.map((qa) => (
          <Card
            key={qa.id}
            className="overflow-hidden cursor-pointer"
            onClick={() => toggleExpand(qa.id)}
          >
            <div className="p-3">
              <p className="text-sm font-medium">{qa.question}</p>
              {expanded.has(qa.id) && (
                <div className="mt-2 pt-2 border-t text-sm text-muted-foreground whitespace-pre-wrap">
                  {qa.answer}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Ask new question */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Ask a question about this paper..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
        />
        <Button onClick={ask} disabled={loading || !question.trim()} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create paper detail component**

Create `src/components/today/paper-detail.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Star, ThumbsDown, ArrowLeft, ExternalLink } from "lucide-react";
import { QAThread } from "./qa-thread";

interface PaperDetailProps {
  paper: any;
  session: any;
  onBack: () => void;
  onStar: (id: string) => void;
  onDislike: (id: string) => void;
  isStarred: boolean;
}

export function PaperDetail({ paper, session, onBack, onStar, onDislike, isStarred }: PaperDetailProps) {
  const [showDislikeInput, setShowDislikeInput] = useState(false);
  const [dislikeReason, setDislikeReason] = useState("");
  const [dislikeSubmitted, setDislikeSubmitted] = useState(false);

  const handleDislike = async () => {
    setShowDislikeInput(true);
  };

  const submitDislike = async () => {
    await fetch(`/api/papers/${paper.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "dislike",
        reason: dislikeReason || null,
        ...session,
      }),
    });
    setDislikeSubmitted(true);
    setShowDislikeInput(false);
  };

  const authors: string[] = paper.authors ? JSON.parse(paper.authors) : [];
  const keywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant={paper.source === "arxiv" ? "default" : "secondary"}>
              {paper.source === "arxiv" ? "arXiv" : "News"}
            </Badge>
            <h1 className="text-2xl font-bold leading-tight">{paper.title}</h1>
            {authors.length > 0 && (
              <p className="text-sm text-muted-foreground">{authors.join(", ")}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="icon" onClick={() => onStar(paper.id)}>
              <Star className={`h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDislike}>
              <ThumbsDown className="h-4 w-4" />
            </Button>
            {paper.sourceUrl && (
              <Button variant="outline" size="icon" asChild>
                <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {showDislikeInput && (
          <div className="flex gap-2 p-3 bg-muted rounded-lg">
            <Input
              placeholder="Why didn't you like this? (optional)"
              value={dislikeReason}
              onChange={(e) => setDislikeReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDislike()}
            />
            <Button size="sm" onClick={submitDislike}>Submit</Button>
          </div>
        )}

        {dislikeSubmitted && (
          <p className="text-sm text-muted-foreground italic">Thanks, we&apos;ll consider this.</p>
        )}

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw, i) => (
              <Badge key={i} variant="outline">{kw}</Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* AI Synthesis */}
      <div className="space-y-2">
        <h2 className="font-semibold">AI Summary</h2>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {paper.summary}
        </div>
      </div>

      <Separator />

      {/* Q&A */}
      <QAThread paperId={paper.id} session={session} />
    </div>
  );
}
```

**Step 3: Update TodayPage to include detail view**

In `src/components/today/today-page.tsx`, the `selectedPaper` state is already there. Add conditional rendering:

```tsx
// Add at top of TodayPage component return, before the existing return:
if (selectedPaper) {
  const paper = papers.find((p) => p.id === selectedPaper);
  if (paper) {
    return (
      <PaperDetail
        paper={paper}
        session={session}
        onBack={() => setSelectedPaper(null)}
        onStar={handleStar}
        onDislike={handleDislike}
        isStarred={starred.has(paper.id)}
      />
    );
  }
}
```

Add the import:
```tsx
import { PaperDetail } from "./paper-detail";
```

**Step 4: Commit**

```bash
git add src/components/today/
git commit -m "feat: add paper detail view with Q&A thread"
```

---

### Task 8: Vault Page with Compare

**Files:**
- Create: `src/components/vault/vault-page.tsx`
- Create: `src/components/vault/compare-view.tsx`

**Step 1: Create vault page**

Create `src/components/vault/vault-page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { PaperCard } from "@/components/today/paper-card";
import { PaperDetail } from "@/components/today/paper-detail";
import { CompareView } from "./compare-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare } from "lucide-react";

interface VaultPageProps {
  session: any;
}

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<any>(null);
  const limit = 12;

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
      const res = await fetch(`/api/vault?${params}`);
      const data = await res.json();
      setPapers(data.papers || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  const totalPages = Math.ceil(total / limit);

  const toggleCompareSelect = (id: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    setComparing(true);
    try {
      const res = await fetch("/api/vault/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperIds: compareSelection, ...session }),
      });
      const data = await res.json();
      setComparison(data.comparison);
    } catch (e) {
      console.error(e);
    }
    setComparing(false);
  };

  if (comparison) {
    return (
      <CompareView
        comparison={comparison}
        papers={papers.filter((p) => compareSelection.includes(p.id))}
        onBack={() => {
          setComparison(null);
          setCompareMode(false);
          setCompareSelection([]);
        }}
      />
    );
  }

  if (selectedPaper && !compareMode) {
    const paper = papers.find((p) => p.id === selectedPaper);
    if (paper) {
      return (
        <PaperDetail
          paper={paper}
          session={session}
          onBack={() => setSelectedPaper(null)}
          onStar={() => {}}
          onDislike={() => {}}
          isStarred={false}
        />
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search your vault..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <Button
          variant={compareMode ? "default" : "outline"}
          onClick={() => {
            setCompareMode(!compareMode);
            setCompareSelection([]);
          }}
          className="gap-2"
        >
          <GitCompare className="h-4 w-4" />
          {compareMode ? "Cancel compare" : "Compare"}
        </Button>
        {compareMode && compareSelection.length >= 2 && (
          <Button onClick={handleCompare} disabled={comparing}>
            {comparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Compare {compareSelection.length} items
          </Button>
        )}
      </div>

      {compareMode && (
        <p className="text-sm text-muted-foreground">
          Select 2-3 papers to compare. Selected: {compareSelection.length}/3
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : papers.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Your vault is empty. Generate your first digest from the Today tab!
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className={`relative ${compareMode && compareSelection.includes(paper.id) ? "ring-2 ring-primary rounded-lg" : ""}`}
              >
                {compareMode && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge
                      variant={compareSelection.includes(paper.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCompareSelect(paper.id)}
                    >
                      {compareSelection.includes(paper.id) ? "Selected" : "Select"}
                    </Badge>
                  </div>
                )}
                <PaperCard
                  paper={paper}
                  onSelect={compareMode ? toggleCompareSelect : setSelectedPaper}
                  onStar={() => {}}
                  onDislike={() => {}}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Create compare view**

Create `src/components/vault/compare-view.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface CompareViewProps {
  comparison: { content: string };
  papers: any[];
  onBack: () => void;
}

export function CompareView({ comparison, papers, onBack }: CompareViewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Vault
      </Button>

      <h1 className="text-2xl font-bold">Comparison</h1>

      <div className="flex gap-2 flex-wrap">
        {papers.map((p) => (
          <Badge key={p.id} variant="secondary" className="text-xs">
            {p.title.length > 50 ? p.title.slice(0, 50) + "..." : p.title}
          </Badge>
        ))}
      </div>

      <Card className="p-6">
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {comparison.content}
        </div>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/vault/
git commit -m "feat: add Vault page with search, pagination, and compare mode"
```

---

### Task 9: Wire Up Main Page + Final Integration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Update main page to wire everything together**

Modify `src/app/page.tsx`:

```tsx
"use client";

import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/lib/hooks/use-session";

export default function Home() {
  const { session, updateSession } = useSession();

  if (!session.isSetUp) {
    return (
      <Onboarding
        onComplete={(data) => {
          updateSession({
            ...data,
            isSetUp: true,
          });
        }}
      />
    );
  }

  return <AppShell session={session} />;
}
```

**Step 2: Ensure layout has proper metadata and dark mode support**

Modify `src/app/layout.tsx` to include:
- Proper title/description
- Dark mode class on html tag if needed

**Step 3: Test the full flow**

```bash
npm run dev
```

Open http://localhost:3000 and verify:
1. Onboarding shows API key entry
2. Interest selection works
3. Today tab shows empty state with generate button
4. After generating, cards appear
5. Clicking card shows detail + Q&A
6. Vault tab shows accumulated papers
7. Compare mode works

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire up full app — onboarding, today, vault, compare"
```

---

### Task 10: Add Engagement-Based Interest Boosting

**Files:**
- Modify: `src/app/api/papers/[id]/qa/route.ts`

**Step 1: Update Q&A route to track engagement**

After inserting a QA pair, count total questions for this paper. If >= 3, boost the paper's keywords:

```typescript
// After inserting QA pair, check engagement level
const qaCount = await db.query.qaPairs.findMany({
  where: eq(qaPairs.paperId, id),
});

if (qaCount.length >= 3 && qaCount.length % 3 === 0) {
  // Every 3 questions, boost paper keywords
  const paperKeywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];
  for (const kw of paperKeywords) {
    const existing = await db.query.interests.findFirst({
      where: and(eq(interests.userId, userId), eq(interests.keyword, kw)),
    });
    if (existing) {
      await db.update(interests)
        .set({ weight: existing.weight! + 0.3, source: "engagement", updatedAt: new Date() })
        .where(eq(interests.id, existing.id));
    } else {
      await db.insert(interests).values({
        userId,
        keyword: kw,
        weight: 0.3,
        source: "engagement",
      });
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/papers/
git commit -m "feat: boost interest keywords based on Q&A engagement"
```

---

## Execution Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Project scaffold + DB schema | None |
| 2 | AI provider abstraction | None |
| 3 | Fetcher pipeline (arXiv + RSS + PDF) | Task 1, 2 |
| 4 | API routes | Task 1, 2, 3 |
| 5 | Onboarding UI | Task 1, 4 |
| 6 | Main layout + Today page | Task 4, 5 |
| 7 | Paper detail + Q&A | Task 6 |
| 8 | Vault page + Compare | Task 6 |
| 9 | Final integration | Task 5-8 |
| 10 | Engagement boosting | Task 4, 7 |

Tasks 1-2 can run in parallel. Tasks 5-8 can partially parallelize after Task 4.

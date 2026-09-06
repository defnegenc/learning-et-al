export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  // Publisher date as the search provider reported it (Serper news results
  // carry one, e.g. "3 days ago" or "May 12, 2026"). Undefined when the
  // provider didn't say - treat as unknown, not fresh.
  date?: string;
}

export type WebSearchKind = "news" | "web";

// A "news" slot is an editorial promise of currency, but nothing downstream
// checked dates: the Sep 5 edition filled its news slot with a 4-month-old
// university press release. Serper reports a date on news results, so drop
// anything verifiably older than this window at the source. Candidates with
// NO parseable date (DuckDuckGo fallback, odd formats) pass through: unknown
// is not stale, and DDG only fires when Serper is down.
const NEWS_MAX_AGE_DAYS = 45;

const RELATIVE_NEWS_DATE = /^(\d+|a|an)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i;
const NEWS_UNIT_MS: Record<string, number> = {
  second: 1e3, minute: 6e4, hour: 36e5, day: 864e5,
  week: 6048e5, month: 26298e5, year: 315576e5,
};

function parseNewsDate(raw: string | undefined, now: number): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const rel = RELATIVE_NEWS_DATE.exec(trimmed);
  if (rel) {
    const word = rel[1].toLowerCase();
    const n = word === "a" || word === "an" ? 1 : parseInt(word, 10);
    return now - n * NEWS_UNIT_MS[rel[2].toLowerCase()];
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function isNewsFresh(date: string | undefined, now: number): boolean {
  const published = parseNewsDate(date, now);
  if (published === null) return true;
  return now - published <= NEWS_MAX_AGE_DAYS * 864e5;
}

function dropStaleNews(results: WebSearchResult[]): WebSearchResult[] {
  const now = Date.now();
  const fresh = results.filter(r => isNewsFresh(r.date, now));
  const dropped = results.length - fresh.length;
  if (dropped > 0) {
    console.log(`[WebSearch] Dropped ${dropped} stale news result(s) older than ${NEWS_MAX_AGE_DAYS} days`);
  }
  return fresh;
}

// Serper.dev — Google search results via API
// Free tier: 2,500 queries/month
export async function webSearch(
  query: string,
  numResults = 5,
  kind: WebSearchKind = "news",
): Promise<WebSearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    let results = await serperSearch(query, numResults, serperKey, kind);
    if (kind === "news") results = dropStaleNews(results);
    if (results.length > 0) return results;
    // Serper returned empty (or everything it returned was stale) — fall through to DDG
    console.log(`[WebSearch] Serper returned 0 usable results, trying DuckDuckGo`);
  }

  return duckDuckGoSearch(query, numResults);
}

export async function serperSearch(
  query: string,
  numResults: number,
  apiKey: string,
  kind: WebSearchKind = "news",
): Promise<WebSearchResult[]> {
  try {
    const res = await fetch(`https://google.serper.dev/${kind === "web" ? "search" : "news"}`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: numResults }),
    });

    if (!res.ok) {
      console.error(`[WebSearch] Serper error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = kind === "web"
      ? data.organic || data.news || []
      : data.news || data.organic || [];

    return results.map((r: { title?: string; link?: string; snippet?: string; source?: string; date?: string }) => ({
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
      source: r.source || new URL(r.link || "https://example.com").hostname,
      date: typeof r.date === "string" && r.date.trim() ? r.date.trim() : undefined,
    }));
  } catch (e) {
    console.error("[WebSearch] Serper failed:", e);
    return [];
  }
}
// Rotate User-Agents to reduce DDG blocking risk
const DDG_USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
];

async function duckDuckGoSearch(query: string, numResults: number): Promise<WebSearchResult[]> {
  const ua = DDG_USER_AGENTS[Math.floor(Math.random() * DDG_USER_AGENTS.length)];
  try {
    const encoded = encodeURIComponent(query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: { "User-Agent": ua },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[WebSearch] DDG HTTP ${res.status} — HTML structure may have changed`);
      return [];
    }

    const html = await res.text();
    const results: WebSearchResult[] = [];

    // Primary parse: DDG's result__a + result__snippet classes
    const matches = html.matchAll(/<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);

    for (const match of matches) {
      if (results.length >= numResults) break;
      const link = match[1].replace(/.*uddg=/, "").split("&")[0];
      const decodedLink = decodeURIComponent(link);
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();

      if (title && decodedLink.startsWith("http")) {
        try {
          results.push({
            title,
            link: decodedLink,
            snippet,
            source: new URL(decodedLink).hostname,
          });
        } catch { /* skip malformed URLs */ }
      }
    }

    // If primary parse found nothing, DDG may have changed their HTML
    if (results.length === 0 && html.length > 1000) {
      console.warn(`[WebSearch] DDG returned HTML (${html.length} chars) but regex matched 0 results — HTML structure may have changed. Check web-search.ts regex.`);
    }

    return results;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) {
      console.warn("[WebSearch] DDG timed out after 10s");
    } else {
      console.error("[WebSearch] DuckDuckGo failed:", msg);
    }
    return [];
  }
}

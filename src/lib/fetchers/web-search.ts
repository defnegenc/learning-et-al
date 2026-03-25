export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
}

// Serper.dev — Google search results via API
// Free tier: 2,500 queries/month
export async function webSearch(query: string, numResults = 5): Promise<WebSearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    const results = await serperSearch(query, numResults, serperKey);
    if (results.length > 0) return results;
    // Serper returned empty — fall through to DDG
    console.log(`[WebSearch] Serper returned 0 results, trying DuckDuckGo`);
  }

  return duckDuckGoSearch(query, numResults);
}

export async function serperSearch(query: string, numResults: number, apiKey: string): Promise<WebSearchResult[]> {
  try {
    const res = await fetch("https://google.serper.dev/news", {
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
    const results = data.news || data.organic || [];

    return results.map((r: { title?: string; link?: string; snippet?: string; source?: string }) => ({
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
      source: r.source || new URL(r.link || "https://example.com").hostname,
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

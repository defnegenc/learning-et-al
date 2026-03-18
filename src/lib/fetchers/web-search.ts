export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
}

// Serper.dev — Google search results via API
// Free tier: 2,500 queries/month
export async function webSearch(query: string, numResults = 5): Promise<WebSearchResult[]> {
  // Try Serper if key is available (passed via env or settings)
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    return serperSearch(query, numResults, serperKey);
  }

  // Fallback: use DuckDuckGo instant answer API (no key needed, limited)
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

async function duckDuckGoSearch(query: string, numResults: number): Promise<WebSearchResult[]> {
  try {
    // DuckDuckGo HTML search (unofficial but works)
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LearningEtAl/1.0)",
      },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results: WebSearchResult[] = [];

    // Parse result links from HTML
    const matches = html.matchAll(/<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);

    for (const match of matches) {
      if (results.length >= numResults) break;
      const link = match[1].replace(/.*uddg=/, "").split("&")[0];
      const decodedLink = decodeURIComponent(link);
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();

      if (title && decodedLink.startsWith("http")) {
        results.push({
          title,
          link: decodedLink,
          snippet,
          source: new URL(decodedLink).hostname,
        });
      }
    }

    return results;
  } catch (e) {
    console.error("[WebSearch] DuckDuckGo failed:", e);
    return [];
  }
}

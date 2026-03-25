/**
 * Fetches a news article URL and extracts readable body text.
 * Uses paragraph density scoring (inspired by Readability.js) instead of
 * naive longest-run heuristic. Detects paywalls and rejects garbage.
 */

const PAYWALL_SIGNALS = [
  "subscribe to continue", "subscribe to read", "sign in to read",
  "create a free account", "already a subscriber", "premium content",
  "this article is for subscribers", "to read the full story",
  "start your free trial", "unlock this article",
];

// Academic publisher domains — these should be reclassified as papers, not news
const ACADEMIC_DOMAINS = new Set([
  "frontiersin.org", "nature.com", "sciencedirect.com", "springer.com",
  "wiley.com", "cell.com", "pnas.org", "science.org", "oup.com",
  "tandfonline.com", "mdpi.com", "plos.org", "biorxiv.org", "medrxiv.org",
  "ieee.org", "acm.org", "ssrn.com", "researchgate.net", "academia.edu",
]);

export function isAcademicDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const domain of ACADEMIC_DOMAINS) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

export async function fetchArticleText(url: string, maxChars = 10000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LearningEtAl/1.0; +https://learningeteal.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return "";

    const html = await res.text();

    // Check for paywall before investing in parsing
    const lowerHtml = html.toLowerCase();
    const paywallHits = PAYWALL_SIGNALS.filter(s => lowerHtml.includes(s));
    if (paywallHits.length >= 2) {
      console.log(`[Article] Paywall detected on ${new URL(url).hostname} (${paywallHits.length} signals)`);
      return ""; // Return empty so pipeline falls back to snippet
    }

    // Remove entire blocks that are never article content
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(nav|header|footer|aside|form|figure|figcaption|iframe|noscript|svg|button|input|select|textarea|menu)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");

    // Extract <p> tag content specifically — most reliable signal for article text
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pRegex.exec(stripped)) !== null) {
      const text = match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Only keep paragraphs with real content (>40 chars, >5 words)
      if (text.length >= 40 && text.split(/\s+/).length >= 5) {
        paragraphs.push(text);
      }
    }

    // If <p> extraction found enough content, use it
    if (paragraphs.length >= 2) {
      return paragraphs.join("\n\n").slice(0, maxChars);
    }

    // Fallback: strip all tags and find the densest text region
    const plainText = stripped
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s{3,}/g, "\n\n")
      .trim();

    const lines = plainText.split("\n").map(l => l.trim()).filter(Boolean);
    let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length >= 40) {
        if (curLen === 0) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      } else {
        curLen = 0;
      }
    }
    const articleLines = lines.slice(bestStart, bestStart + bestLen);
    return articleLines.join("\n\n").slice(0, maxChars);
  } catch {
    return "";
  }
}

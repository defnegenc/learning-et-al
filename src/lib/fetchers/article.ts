/**
 * Fetches a news article URL and extracts readable body text.
 * Strips scripts, styles, nav, ads, and other non-content elements.
 * Returns up to maxChars of extracted text, or empty string on failure.
 */
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

    // Remove entire blocks that are never article content
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(nav|header|footer|aside|form|figure|figcaption|iframe|noscript|svg|button|input|select|textarea)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Collapse whitespace
      .replace(/\s{3,}/g, "\n\n")
      .trim();

    // Heuristic: the article body usually starts after a long gap of boilerplate.
    // Look for the longest continuous run of text lines (≥50 chars each).
    const lines = stripped.split("\n").map(l => l.trim()).filter(Boolean);
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
    const text = articleLines.join("\n\n").slice(0, maxChars);
    return text;
  } catch {
    return "";
  }
}

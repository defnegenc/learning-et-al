import Parser from "rss-parser";

interface RssArticle {
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
}

// Default tech feeds — used as fallback when no field-specific feeds match
const DEFAULT_FEEDS = [
  "https://techcrunch.com/feed/",
  "https://feeds.arstechnica.com/arstechnica/technology-lab",
  "https://www.wired.com/feed/rss",
];

// Field-specific feeds — matched against user's interest field
const FIELD_FEEDS: Record<string, string[]> = {
  "Computer Science": [
    "https://techcrunch.com/feed/",
    "https://feeds.arstechnica.com/arstechnica/technology-lab",
    "https://www.wired.com/feed/rss",
  ],
  "Biology": [
    "https://www.sciencedaily.com/rss/top/science.xml",
    "https://www.newscientist.com/section/life/feed/",
  ],
  "Medicine": [
    "https://www.sciencedaily.com/rss/health_medicine.xml",
    "https://www.statnews.com/feed/",
  ],
  "Psychology": [
    "https://www.sciencedaily.com/rss/mind_brain.xml",
    "https://www.psychologytoday.com/intl/blog/feed",
  ],
  "Environmental Science": [
    "https://www.sciencedaily.com/rss/earth_climate.xml",
    "https://grist.org/feed/",
  ],
  "Physics": [
    "https://phys.org/rss-feed/",
    "https://www.sciencedaily.com/rss/matter_energy.xml",
  ],
  "Engineering": [
    "https://spectrum.ieee.org/feeds/feed.rss",
    "https://feeds.arstechnica.com/arstechnica/technology-lab",
  ],
  "Business": [
    "https://hbr.org/resources/xml/cb/web/rss/rss_hbrmi.xml",
    "https://feeds.feedburner.com/fastcompany/headlines",
  ],
  "Art": [
    "https://www.designboom.com/feed/",
    "https://www.itsnicethat.com/rss",
  ],
  "Education": [
    "https://www.edsurge.com/feeds/articles",
    "https://theconversation.com/us/education/articles.atom",
  ],
};

// Google News RSS by topic — dynamic, no API key needed
function googleNewsRss(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

const parser = new Parser();

export async function fetchRssArticles(
  keywords: string[],
  maxPerFeed = 5,
  field?: string,
): Promise<RssArticle[]> {
  const articles: RssArticle[] = [];

  // Build feed list: field-specific feeds + Google News RSS for the query
  const feedUrls: string[] = [];

  // Add field-specific feeds if available
  if (field && FIELD_FEEDS[field]) {
    feedUrls.push(...FIELD_FEEDS[field]);
  }

  // Add Google News RSS with the keywords as query (always relevant)
  if (keywords.length > 0) {
    feedUrls.push(googleNewsRss(keywords.join(" ")));
  }

  // Fall back to defaults if nothing matched
  if (feedUrls.length === 0) {
    feedUrls.push(...DEFAULT_FEEDS);
  }

  // Deduplicate feed URLs
  const uniqueFeeds = [...new Set(feedUrls)];

  const feedResults = await Promise.allSettled(uniqueFeeds.map(url => parser.parseURL(url)));
  for (const [i, result] of feedResults.entries()) {
    if (result.status === "rejected") {
      console.error(`[RSS] Failed to fetch ${uniqueFeeds[i]}:`, result.reason);
      continue;
    }
    for (const item of result.value.items.slice(0, maxPerFeed)) {
      articles.push({
        title: item.title || "Untitled",
        authors: item.creator ? [item.creator] : [],
        abstract: item.contentSnippet || item.content || "",
        sourceUrl: item.link || "",
      });
    }
  }

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

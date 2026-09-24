import Parser from "rss-parser";

interface RssArticle {
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
  // Publication date from the feed item (Google News RSS always carries one;
  // field feeds usually do). Undefined when the feed didn't say.
  publishedDate?: string;
}

// A "news" slot is an editorial promise of currency. The Sep 24 edition filled
// it with an Oct 2024 Michigan licensing piece from Google News RSS: the item
// carried no date downstream and its "abstract" was just the headline. Google
// News reaches back years for keyword matches, so its items must prove
// freshness - a missing date is a reject here, unlike the Serper path where
// unknown dates pass (see web-search.ts).
export const GOOGLE_NEWS_MAX_AGE_DAYS = 14;

export function isFreshGoogleNewsDate(pubDate: string | undefined, now: number): boolean {
  if (!pubDate) return false;
  const parsed = Date.parse(pubDate);
  if (Number.isNaN(parsed)) return false;
  return now - parsed <= GOOGLE_NEWS_MAX_AGE_DAYS * 864e5;
}

const GOOGLE_NEWS_RSS_PREFIX = "https://news.google.com/rss";

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
    const isGoogleNews = uniqueFeeds[i].startsWith(GOOGLE_NEWS_RSS_PREFIX);
    for (const item of result.value.items.slice(0, maxPerFeed)) {
      if (isGoogleNews && !isFreshGoogleNewsDate(item.isoDate || item.pubDate, Date.now())) {
        console.log(`[RSS] Dropped Google News item with missing or stale date: "${(item.title || "").slice(0, 60)}" (${item.isoDate || item.pubDate || "no date"})`);
        continue;
      }
      articles.push({
        title: item.title || "Untitled",
        authors: item.creator ? [item.creator] : [],
        abstract: item.contentSnippet || item.content || "",
        sourceUrl: item.link || "",
        publishedDate: item.isoDate || item.pubDate || undefined,
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

/** True when an RSS "abstract" is really just the headline restated (Google
 * News RSS items ship the title as the content, sometimes with the outlet
 * name appended). A headline-only item has no reporting to ground a digest
 * card in, so it is never a sufficient source on its own. */
export function isHeadlineOnlyAbstract(title: string, abstract: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const a = norm(abstract);
  if (a.length === 0) return true;
  const t = norm(title);
  if (t.length === 0) return false;
  return a.includes(t) || t.includes(a);
}

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

import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

/**
 * RSS 2.0 feed of the public editions (the admin user's digests, the same rows
 * /api/public/digests lists). One item per edition: the central question as the
 * title, the gist as the summary, and the papers it was built from.
 *
 * Same bytes for every reader, so let the CDN serve it. Dynamic rather than
 * prerendered because the feed has to reach the database at request time, not
 * at build time.
 */
export const dynamic = "force-dynamic";

const SITE_URL = "https://learningetal.com";
const FEED_LIMIT = 20;
const FEED_CACHE_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CDATA can carry raw HTML, but it cannot carry its own terminator. */
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]&gt;")}]]>`;
}

/** `date` is YYYY-MM-DD; fall back to the row's timestamp if it is missing. */
function pubDate(date: string | null, createdAt: Date | null): string {
  const parsed = date ? new Date(`${date}T09:00:00Z`) : null;
  const when = parsed && !Number.isNaN(parsed.getTime()) ? parsed : createdAt;
  return (when ?? new Date(0)).toUTCString();
}

function feed(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Learning et al.</title>
    <link>${SITE_URL}</link>
    <description>A daily research digest that finds, synthesises, and contrasts papers around one provocative question.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export async function GET() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return new Response(feed(""), { headers: FEED_CACHE_HEADERS });

  try {
    const editions = await db
      .select({
        id: digests.id,
        date: digests.date,
        theme: digests.theme,
        gist: digests.gist,
        createdAt: digests.createdAt,
      })
      .from(digests)
      .where(and(eq(digests.userId, adminId), or(isNull(digests.hidden), eq(digests.hidden, false))))
      .orderBy(desc(digests.date))
      .limit(FEED_LIMIT);

    if (editions.length === 0) return new Response(feed(""), { headers: FEED_CACHE_HEADERS });

    const sources = await db
      .select({ digestId: papers.digestId, title: papers.title, sourceIndex: papers.sourceIndex })
      .from(papers)
      .where(inArray(papers.digestId, editions.map((e) => e.id)))
      .orderBy(asc(papers.sourceIndex));

    const titlesByDigest = new Map<string, string[]>();
    for (const paper of sources) {
      const list = titlesByDigest.get(paper.digestId) ?? [];
      list.push(paper.title);
      titlesByDigest.set(paper.digestId, list);
    }

    const items = editions.map((edition) => {
      const url = `${SITE_URL}/digest/${edition.id}`;
      const title = edition.theme?.trim() || `Learning et al., ${edition.date}`;
      const titles = titlesByDigest.get(edition.id) ?? [];
      const body = [
        edition.gist?.trim() ? `<p>${escapeXml(edition.gist.trim())}</p>` : "",
        titles.length
          ? `<p>Papers in this edition:</p><ul>${titles.map((t) => `<li>${escapeXml(t)}</li>`).join("")}</ul>`
          : "",
        `<p><a href="${url}">Read the edition</a></p>`,
      ].join("");

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate(edition.date, edition.createdAt)}</pubDate>
      <description>${cdata(body)}</description>
    </item>`;
    });

    return new Response(feed(items.join("\n")), { headers: FEED_CACHE_HEADERS });
  } catch (error) {
    console.error("Feed error:", error);
    return new Response(feed(""), { headers: FEED_CACHE_HEADERS });
  }
}

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

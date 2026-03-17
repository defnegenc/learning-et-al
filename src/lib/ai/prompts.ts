export const SYNTHESIS_SYSTEM = `You are a research synthesis expert. You analyze academic papers and news articles, highlighting contrasting perspectives, key findings, and connections between them. Be concise but insightful.`;

export function digestPrompt(items: { title: string; abstract: string; source: string }[]) {
  const listing = items.map((p, i) =>
    `[${i + 1}] "${p.title}" (${p.source})\n${p.abstract.slice(0, 2000)}`
  ).join("\n\n");

  return `Here are ${items.length} papers/articles. Produce a JSON response with this EXACT structure (no markdown fences, just raw JSON):

{
  "items": [
    {
      "index": 1,
      "summary": "2-3 sentence summary",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "synthesis": "The synthesis text - see rules below",
  "keyConcepts": ["concept1", "concept2", "concept3", "concept4", "concept5"]
}

Rules:
- "items" array must have one entry per paper, matching the index
- "summary" is 2-3 sentences about the key contribution
- "keywords" is 3-5 specific research topics per paper
- "synthesis" MUST follow this format:
  1. Start with a theme line: "Today's theme: [a punchy question or statement that ties the papers together]"
  2. Then write conversationally, like you're briefing a smart friend over coffee.
  3. YOU MUST MENTION EVERY SINGLE PAPER AND ARTICLE BY NAME using markdown bold. Do not skip any. For research papers (arxiv), say things like "The research paper **Title** finds that..." or "**Title** argues...". For news articles (rss), say things like "An article from RSS, **Title**, adds context by..." or "Meanwhile, **Title** reports that...". Make it clear which items are academic research papers and which are news/blog articles.
  4. Keep it SHORT — 5-8 sentences max after the theme line. No academic jargon. Be opinionated.
  5. Use markdown bold for paper/article titles when mentioning them.
- "keyConcepts" is 5-8 overarching themes across all papers

Papers:

${listing}`;
}

export function qaPrompt(paperTitle: string, fullText: string, question: string) {
  return `You are answering questions about the following paper. Use the full text to give accurate, specific answers. Cite relevant sections when possible.

Title: ${paperTitle}
Full text: ${fullText.slice(0, 15000)}

Question: ${question}`;
}

export function comparisonPrompt(papers: { title: string; fullText: string }[]) {
  const texts = papers.map((p, i) =>
    `## Item ${i + 1}: ${p.title}\n\n${p.fullText.slice(0, 8000)}`
  ).join("\n\n---\n\n");

  return `Compare and contrast these ${papers.length} items. Highlight:
1. Where they AGREE
2. Where they DISAGREE or offer different perspectives
3. Complementary insights — what does combining them reveal?

${texts}`;
}

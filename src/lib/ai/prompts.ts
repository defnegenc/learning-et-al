export const SYNTHESIS_SYSTEM = `You are a research synthesis expert. You analyze academic papers and news articles, highlighting contrasting perspectives, key findings, and connections between them. Be concise but insightful.`;

export const SEARCH_PLAN_SYSTEM = `You are a research planning assistant. You help users find the most relevant academic papers and news based on their interests and expertise level. Always return valid JSON.`;

export function searchPlanPrompt(interests: { keyword: string; field: string; level: string }[]) {
  return `Given these research interests and expertise levels, suggest specific search queries.

Interests:
${interests.map(i => `- "${i.keyword}" (field: ${i.field}, level: ${i.level})`).join('\n')}

Return a JSON object (no markdown fences, just raw JSON):
{
  "searches": [
    {
      "interest": "the interest keyword",
      "level": "beginner|intermediate|expert",
      "foundationalQuery": "search query for a well-known foundational paper on this topic",
      "recentQuery": "search query for cutting-edge recent research on this topic",
      "newsKeywords": ["keyword1", "keyword2"]
    }
  ]
}

Rules:
- For BEGINNER level: foundationalQuery should find introductory/survey papers
- For INTERMEDIATE: foundationalQuery should find seminal papers in the specific area
- For EXPERT: foundationalQuery should find niche/advanced papers, recentQuery should find frontier work
- newsKeywords should be 2-3 terms that would match relevant industry/startup news
- Return one entry per interest`;
}

export function digestPrompt(items: { title: string; abstract: string; source: string; category?: string }[]) {
  const listing = items.map((p, i) =>
    `[${i + 1}] "${p.title}" (${p.source}${p.category ? `, ${p.category}` : ''})\n${p.abstract.slice(0, 2000)}`
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
  Today's thread: [punchy theme connecting all items]

  \`FOUNDATIONAL\` **[Paper Title]** — [one line about why it matters]
  \`RECENT\` **[Paper Title]** — [one line about the new finding]
  \`NEWS\` **[Article Title]** — [one line about the real-world connection]

  [1-2 sentences connecting them: the through-line, what it means, your opinion]

  Tag each item with its category (FOUNDATIONAL, RECENT, or NEWS) as shown above.
  Keep it SHORT — the synthesis should be a quick scan, not an essay.
  Use markdown bold for paper/article titles when mentioning them.
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

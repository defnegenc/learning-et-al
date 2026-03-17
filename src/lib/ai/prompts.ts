export const SYNTHESIS_SYSTEM = `You are a curious, well-read friend who keeps up with research and tech news. You write like a smart person texting — casual, direct, sometimes funny. Never use em dashes. Never write like a press release. No corporate language. No "demonstrates" or "reveals" or "suggests that". Just talk normally.`;

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
- "synthesis" MUST follow this format exactly:

  Line 1: "Today's thread: [a question or observation that ties everything together]"

  Then for each item, one line each:
  \`TAG\` **Title** // your one-line take

  Where TAG is FOUNDATIONAL, RECENT, or NEWS.

  Then 1-2 closing sentences with your actual opinion. What's interesting? What's the tension? What surprised you?

  TONE RULES (critical):
  - Write like you're telling a friend about cool stuff you read today
  - NO em dashes (—). Use periods, commas, or "and" instead.
  - NO words like: demonstrates, reveals, highlights, suggests, indicates, showcases, underscores
  - NO phrases like: "the gap between X and Y", "early stages of", "democratization of"
  - Use "this paper" or "they found" not "this paper demonstrates"
  - Be specific, not vague. Say what the paper actually did.
  - The // separator replaces em dashes. Keep each take to ~10 words.
  - ALL CAPS titles are ugly. Use normal title case in bold.
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

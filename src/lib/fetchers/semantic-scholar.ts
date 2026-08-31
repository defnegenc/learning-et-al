export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
  pdfUrl: string;
  citationCount: number;
  year: number;
}

const API_BASE = "https://api.semanticscholar.org/graph/v1";
const FIELDS = "paperId,title,abstract,authors,url,citationCount,year,externalIds";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastCallTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 500) {
    await sleep(500 - elapsed);
  }
  lastCallTime = Date.now();
  return fetch(url);
}

// Map user-facing field names to Semantic Scholar fieldsOfStudy values
const FIELD_MAP: Record<string, string> = {
  "Computer Science": "Computer Science",
  "Mathematics": "Mathematics",
  "Biology": "Biology",
  "Physics": "Physics",
  "Chemistry": "Chemistry",
  "Medicine": "Medicine",
  "Engineering": "Engineering",
  "Psychology": "Psychology",
  "Economics": "Economics",
  "Sociology": "Sociology",
  "Art": "Art",
  "History": "History",
  "Business": "Business",
  "Environmental Science": "Environmental Science",
  "Law": "Law",
  "Philosophy": "Philosophy",
  "Linguistics": "Linguistics",
  "Political Science": "Political Science",
};

export async function searchSemanticScholar(
  query: string,
  maxResults = 10,
  sort: "citationCount" | "publicationDate" = "citationCount",
  fieldsOfStudy?: string,
  recentWindowYears = 2,
): Promise<SemanticScholarPaper[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    let url = `${API_BASE}/paper/search?query=${encodedQuery}&limit=${maxResults}&fields=${FIELDS}`;

    if (sort === "publicationDate") {
      // The caller tightens this for volatile fields and widens it elsewhere.
      const currentYear = new Date().getFullYear();
      url += `&year=${currentYear - recentWindowYears}-${currentYear}`;
      url += `&sort=publicationDate:desc`;
    } else {
      url += `&sort=citationCount:desc`;
    }

    // Restrict to the relevant academic field to avoid cross-domain noise
    if (fieldsOfStudy) {
      const s2Field = FIELD_MAP[fieldsOfStudy] || fieldsOfStudy;
      url += `&fieldsOfStudy=${encodeURIComponent(s2Field)}`;
    }

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      console.error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data
      .filter((paper: Record<string, unknown>) => paper.title && paper.abstract)
      .map((paper: Record<string, unknown>) => {
        const externalIds = (paper.externalIds || {}) as Record<string, string>;
        const arxivId = externalIds.ArXiv;
        const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}` : "";

        const authors = Array.isArray(paper.authors)
          ? (paper.authors as { name?: string }[]).map((a) => a.name || "Unknown")
          : [];

        return {
          paperId: (paper.paperId as string) || "",
          title: (paper.title as string).replace(/\n/g, " "),
          authors,
          abstract: (paper.abstract as string).replace(/\n/g, " "),
          sourceUrl: (paper.url as string) || "",
          pdfUrl,
          citationCount: (paper.citationCount as number) || 0,
          year: (paper.year as number) || 0,
        };
      });
  } catch (error) {
    console.error("Semantic Scholar search failed:", error);
    return [];
  }
}

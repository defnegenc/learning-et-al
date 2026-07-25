const OA_BASE = "https://api.openalex.org";
const OA_MAILTO = "hello@learningeteal.app";

const OA_SELECT = [
  "id", "title", "abstract_inverted_index", "cited_by_count",
  "publication_year", "authorships", "primary_location",
  "open_access", "related_works", "primary_topic",
  "best_oa_location",
].join(",");

const OA_CONCEPT_MAP: Record<string, string> = {
  "Computer Science": "computer science",
  "Mathematics": "mathematics",
  "Biology": "biology",
  "Physics": "physics",
  "Chemistry": "chemistry",
  "Medicine": "medicine",
  "Engineering": "engineering",
  "Psychology": "psychology",
  "Economics": "economics",
  "Sociology": "sociology",
  "Art": "art",
  "Business": "business",
  "Environmental Science": "environmental science",
  "Law": "law",
  "Philosophy": "philosophy",
  "Linguistics": "linguistics",
  "Political Science": "political science",
  // OpenAlex concept display names use an en dash in "Human–computer interaction"
  "Human-Computer Interaction": "human–computer interaction",
  "Human Computer Interaction": "human–computer interaction",
  "Design": "design",
  "Neuroscience": "neuroscience",
  "Cognitive Science": "cognitive science",
  "Media Studies": "media studies",
};

interface OARawWork {
  id: string;
  title: string | null;
  abstract_inverted_index: Record<string, number[]> | null;
  cited_by_count: number;
  publication_year: number | null;
  authorships: { author: { display_name: string }; institutions?: { display_name: string }[] }[];
  primary_location: { landing_page_url: string | null; pdf_url: string | null; source?: { display_name: string } | null } | null;
  best_oa_location?: { source?: { display_name: string } | null } | null;
  open_access: { oa_url: string | null } | null;
  related_works: string[];
  primary_topic?: { domain?: { display_name: string }; field?: { display_name: string } } | null;
}

export interface OpenAlexPaper {
  openAlexId: string;
  paperId: string;        // always "" — type compatibility with S2
  title: string;
  abstract: string;
  authors: string[];
  sourceUrl: string;
  pdfUrl: string;
  citationCount: number;
  year: number;
  relatedWorkIds: string[];
  /** Broad academic domain from OA primary_topic (e.g. "Physical Sciences", "Health Sciences") */
  primaryDomain?: string;
  /** Journal/conference name from OA primary_location.source */
  venueName?: string;
  /** Institutions from author affiliations */
  institutions?: string[];
}

function reconstructAbstract(inv: Record<string, number[]> | null): string {
  if (!inv) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(" ");
}

function mapWork(raw: OARawWork): OpenAlexPaper {
  const shortId = raw.id.replace("https://openalex.org/", "");
  const landingUrl = raw.primary_location?.landing_page_url || raw.id;
  // Extract venue name from primary_location or best_oa_location
  const venueName = raw.primary_location?.source?.display_name
    || raw.best_oa_location?.source?.display_name
    || undefined;
  // Extract unique institution names from author affiliations
  const instSet = new Set<string>();
  for (const a of raw.authorships || []) {
    for (const inst of a.institutions || []) {
      if (inst.display_name) instSet.add(inst.display_name);
    }
  }
  return {
    openAlexId: shortId,
    paperId: "",
    title: (raw.title || "").replace(/\n/g, " ").trim(),
    abstract: reconstructAbstract(raw.abstract_inverted_index),
    authors: (raw.authorships || []).slice(0, 6).map(a => a.author?.display_name || "Unknown"),
    sourceUrl: landingUrl,
    pdfUrl: raw.open_access?.oa_url || raw.primary_location?.pdf_url || "",
    citationCount: raw.cited_by_count || 0,
    year: raw.publication_year || 0,
    relatedWorkIds: (raw.related_works || [])
      .slice(0, 20)
      .map((url: string) => url.replace("https://openalex.org/", "")),
    primaryDomain: raw.primary_topic?.domain?.display_name,
    venueName,
    institutions: instSet.size > 0 ? [...instSet] : undefined,
  };
}

async function oaFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": `LearningEtAl/1.0 (mailto:${OA_MAILTO})` },
  });
}

export async function searchOpenAlex(
  query: string,
  fieldsOfStudy?: string,
  sort: "cited_by_count" | "publication_year" = "cited_by_count",
  limit = 10,
): Promise<OpenAlexPaper[]> {
  try {
    // type:article|preprint excludes dissertations, book chapters, reports, datasets, etc.
    // Citation floor only for cited_by_count sort — new papers sorted by date haven't had time to accumulate citations
    const filters: string[] = ["has_abstract:true", "type:article|preprint"];
    if (sort === "cited_by_count") {
      filters.push("cited_by_count:>1");
    }

    if (fieldsOfStudy) {
      const concept = OA_CONCEPT_MAP[fieldsOfStudy] ?? fieldsOfStudy.toLowerCase();
      filters.push(`concepts.display_name:${concept}`);
    }

    if (sort === "publication_year") {
      const year = new Date().getFullYear();
      filters.push(`publication_year:${year - 2}-${year}`);
    }

    // "Recent" mode sorts by relevance_score within a 2-year window, NOT by
    // publication_year — year sorting discards OA's relevance ranking entirely
    // and returns the newest works mentioning the query words anywhere (fulltext
    // included), which floods the pool with loosely-related papers (audit 6.2).
    const params = new URLSearchParams({
      search: query,
      filter: filters.join(","),
      sort: sort === "cited_by_count" ? "cited_by_count:desc" : "relevance_score:desc",
      "per-page": String(limit),
      select: OA_SELECT,
      mailto: OA_MAILTO,
    });

    const res = await oaFetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Search ${res.status} for "${query}"`);
      return [];
    }
    const data = await res.json();
    const mapped = (data.results as OARawWork[] || [])
      .filter(w => w.title && w.abstract_inverted_index)
      .map(mapWork)
      .filter(p => p.title && p.abstract.length > 50);
    // A concept filter that silently matches no OpenAlex concept returns 0 results
    // and the caller falls back to an unfiltered (CS-dominant) search — make that visible.
    if (mapped.length === 0 && fieldsOfStudy) {
      console.log(`[OpenAlex] 0 results with concept filter "${OA_CONCEPT_MAP[fieldsOfStudy] ?? fieldsOfStudy.toLowerCase()}" (field: ${fieldsOfStudy}) — check OA_CONCEPT_MAP`);
    }
    return mapped;
  } catch (err) {
    console.log(`[OpenAlex] Search error: ${err}`);
    return [];
  }
}

// ─── Foundational lane ────────────────────────────────────────────────────────
// "What did today's papers build on?" — fetch the reference lists of the selected
// works, then look up the referenced works that are old + heavily cited.

/** Batch-fetch reference lists for a set of works. One API call. */
export async function getReferencedWorkIds(
  openAlexIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const ids = openAlexIds.filter(Boolean).slice(0, 10);
  if (ids.length === 0) return out;
  try {
    const params = new URLSearchParams({
      filter: `openalex_id:${ids.join("|")}`,
      select: "id,referenced_works",
      "per-page": String(ids.length),
      mailto: OA_MAILTO,
    });
    const res = await oaFetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Referenced works ${res.status}`);
      return out;
    }
    const data = await res.json();
    for (const w of (data.results as { id: string; referenced_works?: string[] }[] || [])) {
      const shortId = w.id.replace("https://openalex.org/", "");
      out.set(shortId, (w.referenced_works || []).map(u => u.replace("https://openalex.org/", "")));
    }
    return out;
  } catch (err) {
    console.log(`[OpenAlex] Referenced works error: ${err}`);
    return out;
  }
}

/** From a set of candidate ancestor IDs, return the ones that qualify as
 *  foundational: ≥8 years old, heavily cited, with a usable abstract. */
export async function getFoundationalCandidates(
  candidateIds: string[],
  minCitations = 500,
  minAgeYears = 8,
  limit = 5,
): Promise<OpenAlexPaper[]> {
  const ids = candidateIds.filter(Boolean).slice(0, 50); // OA OR-filter cap is 100; stay well under
  if (ids.length === 0) return [];
  try {
    const cutoffYear = new Date().getFullYear() - minAgeYears;
    const params = new URLSearchParams({
      filter: [
        `openalex_id:${ids.join("|")}`,
        `publication_year:<${cutoffYear}`,
        `cited_by_count:>${minCitations}`,
        "has_abstract:true",
      ].join(","),
      sort: "cited_by_count:desc",
      "per-page": String(limit),
      select: OA_SELECT,
      mailto: OA_MAILTO,
    });
    const res = await oaFetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Foundational candidates ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.results as OARawWork[] || [])
      .filter(w => w.title && w.abstract_inverted_index)
      .map(mapWork)
      .filter(p => p.abstract.length > 50);
  } catch (err) {
    console.log(`[OpenAlex] Foundational candidates error: ${err}`);
    return [];
  }
}

export async function getOpenAlexRelatedWorks(
  relatedWorkIds: string[],
  fieldsOfStudy?: string,
  limit = 10,
): Promise<OpenAlexPaper[]> {
  if (relatedWorkIds.length === 0) return [];
  try {
    // Fetch up to 2x limit to account for filtering
    const ids = relatedWorkIds.slice(0, Math.min(limit * 2, 20)).join("|");
    // type:article|preprint excludes dissertations, reports, book chapters, etc.
    const filters: string[] = [`openalex_id:${ids}`, "has_abstract:true", "type:article|preprint"];

    if (fieldsOfStudy) {
      const concept = OA_CONCEPT_MAP[fieldsOfStudy] ?? fieldsOfStudy.toLowerCase();
      filters.push(`concepts.display_name:${concept}`);
    }

    const params = new URLSearchParams({
      filter: filters.join(","),
      "per-page": String(limit),
      select: OA_SELECT,
      mailto: OA_MAILTO,
    });

    const res = await oaFetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Related works ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.results as OARawWork[] || [])
      .filter(w => w.title && w.abstract_inverted_index)
      .map(mapWork);
  } catch (err) {
    console.log(`[OpenAlex] Related works error: ${err}`);
    return [];
  }
}

// "What's happened since": the most notable recent works that CITE this one.
// Sorted by publication date so the newest follow-up work surfaces first.
export async function getOpenAlexCitingWorks(
  openAlexId: string,
  limit = 8,
): Promise<OpenAlexPaper[]> {
  if (!openAlexId) return [];
  try {
    const params = new URLSearchParams({
      filter: [`cites:${openAlexId}`, "has_abstract:true", "type:article|preprint"].join(","),
      sort: "publication_date:desc",
      "per-page": String(limit),
      select: OA_SELECT,
      mailto: OA_MAILTO,
    });
    const res = await oaFetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Citing works ${res.status} for ${openAlexId}`);
      return [];
    }
    const data = await res.json();
    return (data.results as OARawWork[] || [])
      .filter(w => w.title && w.abstract_inverted_index)
      .map(mapWork);
  } catch (err) {
    console.log(`[OpenAlex] Citing works error: ${err}`);
    return [];
  }
}

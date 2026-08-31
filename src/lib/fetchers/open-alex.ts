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
  primary_topic?: {
    id?: string;
    display_name?: string;
    subfield?: { display_name?: string };
    domain?: { display_name: string };
    field?: { display_name: string };
  } | null;
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

/** Deterministic taxonomy scope for a works search. Unlike the old
 * fieldsOfStudy string, every value is an OpenAlex ID chosen before the LLM. */
export type OpenAlexSearchScope =
  | { kind: "primary-topic"; id: string }
  | { kind: "topic"; id: string }
  | { kind: "subfield"; id: string };

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

/** Resolve the paper-level topic once, when its companion is generated. */
export async function getOpenAlexWorkTopic(openAlexId: string): Promise<OpenAlexTopic | null> {
  const id = openAlexId.replace("https://openalex.org/", "").trim();
  if (!id) return null;
  try {
    const params = new URLSearchParams({
      select: "primary_topic",
      mailto: OA_MAILTO,
    });
    const res = await oaFetch(`${OA_BASE}/works/${encodeURIComponent(id)}?${params}`);
    if (!res.ok) return null;
    const raw = await res.json() as Pick<OARawWork, "primary_topic">;
    const topic = raw.primary_topic;
    if (!topic?.id || !topic.display_name) return null;
    return {
      id: topic.id.replace("https://openalex.org/", ""),
      name: topic.display_name,
      description: "",
      keywords: [],
      subfield: topic.subfield?.display_name || "",
      subfieldId: "",
      worksCount: 0,
    };
  } catch (err) {
    console.log(`[OpenAlex] Work topic error: ${err}`);
    return null;
  }
}

export async function searchOpenAlex(
  query: string,
  fieldsOfStudy?: string,
  sort: "cited_by_count" | "publication_year" = "cited_by_count",
  limit = 10,
  scope?: OpenAlexSearchScope,
  freshCandidateTarget = 1,
  recentWindowYears = 2,
): Promise<OpenAlexPaper[]> {
  try {
    const currentYear = new Date().getFullYear();
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

    if (scope) {
      if (scope.kind === "primary-topic") filters.push(`primary_topic.id:${scope.id}`);
      if (scope.kind === "topic") filters.push(`topics.id:${scope.id}`);
      if (scope.kind === "subfield") filters.push(`primary_topic.subfield.id:${scope.id}`);
    }

    if (sort === "publication_year") {
      filters.push(`publication_year:${currentYear - recentWindowYears}-${currentYear}`);
    }

    // "Recent" mode sorts by relevance_score within the requested year window,
    // not by publication_year. Year sorting discards OA's relevance ranking entirely
    // and returns the newest works mentioning the query words anywhere (fulltext
    // included), which floods the pool with loosely-related papers (audit 6.2).
    // Pull extra relevance-ranked results so volatile fields can expose fresh
    // candidates without changing the relevance-first ordering for standard fields.
    // We still return only `limit` candidates below.
    const fetchLimit = sort === "publication_year" ? Math.min(limit + 10, 200) : limit;
    const params = new URLSearchParams({
      search: query,
      filter: filters.join(","),
      sort: sort === "cited_by_count" ? "cited_by_count:desc" : "relevance_score:desc",
      "per-page": String(fetchLimit),
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
    const shortlisted = mapped.slice(0, limit);
    if (sort === "publication_year" && shortlisted.length === limit) {
      const freshCutoffYear = currentYear - 1;
      const tail = mapped.slice(limit);
      const promote = (candidate: OpenAlexPaper | undefined) => {
        if (!candidate || shortlisted.some(p => p.openAlexId === candidate.openAlexId)) return;
        let replaceIndex = shortlisted.findLastIndex(p => p.year < freshCutoffYear);
        if (replaceIndex < 0 && candidate.year === currentYear) {
          replaceIndex = shortlisted.findLastIndex(p => p.year < currentYear);
        }
        if (replaceIndex >= 0) shortlisted[replaceIndex] = candidate;
      };

      // Volatile fields preserve a current-year candidate when the oversample has one.
      if (freshCandidateTarget > 0 && !shortlisted.some(p => p.year === currentYear)) {
        promote(tail.find(p => p.year === currentYear));
      }

      // Rapidly changing research areas also ask for a second fresh candidate.
      for (const candidate of tail) {
        if (shortlisted.filter(p => p.year >= freshCutoffYear).length >= Math.min(freshCandidateTarget, limit)) break;
        if (candidate.year >= freshCutoffYear) promote(candidate);
      }
    }
    // A concept filter that silently matches no OpenAlex concept returns 0 results
    // and the caller falls back to an unfiltered (CS-dominant) search — make that visible.
    if (mapped.length === 0 && fieldsOfStudy) {
      console.log(`[OpenAlex] 0 results with concept filter "${OA_CONCEPT_MAP[fieldsOfStudy] ?? fieldsOfStudy.toLowerCase()}" (field: ${fieldsOfStudy}) — check OA_CONCEPT_MAP`);
    }
    if (mapped.length === 0 && scope) {
      console.log(`[OpenAlex] 0 results with ${scope.kind} scope ${scope.id} for "${query}"`);
    }
    return shortlisted;
  } catch (err) {
    console.log(`[OpenAlex] Search error: ${err}`);
    return [];
  }
}

// ─── Topic seeding ────────────────────────────────────────────────────────────
// OpenAlex Topics are a curated taxonomy (~4,500 topics under ~250 subfields).
// Sampling one real topic per digest gives the question generator a concrete,
// rotating seed instead of asking the LLM to invent specificity from a bare
// interest keyword — the taxonomy provides the entropy, not the model.

export interface OpenAlexTopic {
  id: string;           // short id, e.g. "T10470"
  name: string;         // "Usability and User Interface Design"
  description: string;
  keywords: string[];
  subfield: string;     // "Human-Computer Interaction"
  subfieldId: string;   // numeric id, e.g. "1709"
  worksCount: number;
}

interface OARawTopic {
  id: string;
  display_name: string;
  description: string | null;
  keywords: string[] | null;
  subfield: { id: string; display_name: string };
  works_count: number;
}

interface OARawTaxonomyNode {
  id: string;
  display_name: string;
  works_count: number;
}

const TOPIC_SELECT = "id,display_name,description,keywords,subfield,works_count";
const MIN_TOPIC_WORKS = 3000; // below this the topic is too thin to reliably yield 2-year-recent papers

function mapTopic(raw: OARawTopic): OpenAlexTopic {
  return {
    id: raw.id.replace("https://openalex.org/", ""),
    name: raw.display_name,
    description: (raw.description || "").replace(/^This cluster of papers /i, "").trim(),
    keywords: raw.keywords || [],
    subfield: raw.subfield?.display_name || "",
    subfieldId: (raw.subfield?.id || "").replace("https://openalex.org/subfields/", ""),
    worksCount: raw.works_count || 0,
  };
}

async function fetchTopics(params: URLSearchParams): Promise<OpenAlexTopic[]> {
  try {
    params.set("select", TOPIC_SELECT);
    params.set("mailto", OA_MAILTO);
    const res = await oaFetch(`${OA_BASE}/topics?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Topics ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.results as OARawTopic[] || []).map(mapTopic);
  } catch (err) {
    console.log(`[OpenAlex] Topics error: ${err}`);
    return [];
  }
}

async function fetchTaxonomyNodes(
  endpoint: "fields" | "subfields",
  params: URLSearchParams,
): Promise<OARawTaxonomyNode[]> {
  try {
    params.set("select", "id,display_name,works_count");
    params.set("mailto", OA_MAILTO);
    const res = await oaFetch(`${OA_BASE}/${endpoint}?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] ${endpoint} ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.results as OARawTaxonomyNode[] || []);
  } catch (err) {
    console.log(`[OpenAlex] ${endpoint} error: ${err}`);
    return [];
  }
}

function shortTaxonomyId(id: string): string {
  return id.split("/").pop() || id;
}

function normalizedLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function weightedPick<T>(items: T[], weightForIndex: (index: number) => number): T | null {
  if (items.length === 0) return null;
  const weights = items.map((_, index) => Math.max(0, weightForIndex(index)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[0];
  let draw = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    draw -= weights[i];
    if (draw <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Sample one topic from the research neighborhood of an interest keyword.
 *
 * Exact taxonomy interests walk the hierarchy: field -> subfield -> topic, or
 * subfield -> topic. Free-form interests use OpenAlex's relevance-ranked topic
 * search instead. Recently used nodes are excluded BEFORE sampling, so rotation
 * is mechanical until the available pool has been exhausted.
 *
 * Sampling is rank-discounted. It favors OpenAlex's stronger/popular matches but
 * every member keeps real probability mass: bounded exploration within a vetted
 * pool, never a random jump to an unrelated taxonomy branch.
 */
export async function sampleSeedTopic(
  interestKeyword: string,
  excludeTopicIds: Set<string>,
  excludeSubfieldIds: Set<string> = new Set(),
): Promise<OpenAlexTopic | null> {
  const label = normalizedLabel(interestKeyword);
  const [fieldMatches, subfieldMatches] = await Promise.all([
    fetchTaxonomyNodes("fields", new URLSearchParams({ search: interestKeyword, "per-page": "5" })),
    fetchTaxonomyNodes("subfields", new URLSearchParams({ search: interestKeyword, "per-page": "10" })),
  ]);
  const exactField = fieldMatches.find(node => normalizedLabel(node.display_name) === label);
  const exactSubfield = subfieldMatches.find(node => normalizedLabel(node.display_name) === label);

  let pool: OpenAlexTopic[] = [];

  if (exactSubfield) {
    // A specific academic neighborhood such as Human-Computer Interaction.
    pool = await fetchTopics(new URLSearchParams({
      filter: `subfield.id:${shortTaxonomyId(exactSubfield.id)}`,
      "per-page": "100",
    }));
  } else if (exactField) {
    // A broad interest such as Computer Science needs one extra hierarchy step;
    // otherwise its largest subfield would dominate every day's topic.
    const subfields = await fetchTaxonomyNodes("subfields", new URLSearchParams({
      filter: `field.id:${shortTaxonomyId(exactField.id)}`,
      "per-page": "100",
    }));
    const freshSubfields = subfields.filter(node => !excludeSubfieldIds.has(shortTaxonomyId(node.id)));
    const subfieldPool = freshSubfields.length > 0 ? freshSubfields : subfields;
    const subfield = weightedPick(subfieldPool, rank => 1 / Math.sqrt(rank + 1));
    if (subfield) {
      pool = await fetchTopics(new URLSearchParams({
        filter: `subfield.id:${shortTaxonomyId(subfield.id)}`,
        "per-page": "100",
      }));
    }
  } else {
    // Free-form interests ("microbiome", "creativity") do not necessarily map
    // to a taxonomy label. OpenAlex topic search supplies the relevant, concrete
    // neighborhood without asking an LLM to invent a hierarchy.
    pool = await fetchTopics(new URLSearchParams({
      search: interestKeyword,
      "per-page": "50",
    }));
  }

  const seen = new Set<string>();
  const eligible = pool.filter(topic => {
    if (seen.has(topic.id)) return false;
    seen.add(topic.id);
    return topic.worksCount >= MIN_TOPIC_WORKS;
  });
  const fresh = eligible.filter(topic => !excludeTopicIds.has(topic.id));
  const topicPool = fresh.length > 0 ? fresh : eligible;

  // OpenAlex returns search results by relevance and taxonomy filters broadly by
  // works count. A square-root discount favors the front without collapsing all
  // probability onto it; the exclusion sets provide the stronger rotation rule.
  return weightedPick(topicPool, rank => 1 / Math.sqrt(rank + 1));
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


// "What's happened since": recent and notable works that CITE this one.
// Blend newest-first with most-cited-since so a trivial new citation does not
// automatically outrank a consequential follow-up.
export async function getOpenAlexCitingWorks(
  openAlexId: string,
  limit = 8,
  sinceYear?: number | null,
): Promise<OpenAlexPaper[]> {
  const id = openAlexId.replace("https://openalex.org/", "").trim();
  if (!id) return [];
  try {
    const currentYear = new Date().getFullYear();
    const baseFilters = [`cites:${id}`, "has_abstract:true", "type:article|preprint"];
    const fetchSorted = async (sort: "publication_date:desc" | "cited_by_count:desc", filter: string[]) => {
      const params = new URLSearchParams({
        filter: filter.join(","),
        sort,
        "per-page": String(limit),
        select: OA_SELECT,
        mailto: OA_MAILTO,
      });
      const res = await oaFetch(`${OA_BASE}/works?${params}`);
      if (!res.ok) {
        console.log(`[OpenAlex] Citing works ${res.status} for ${id}`);
        return [];
      }
      const data = await res.json();
      return (data.results as OARawWork[] || [])
        .filter(w => w.title && w.abstract_inverted_index)
        .map(mapWork);
    };

    const boundedYear = sinceYear && sinceYear <= currentYear
      ? Math.max(1900, sinceYear)
      : null;
    const notableFilters = boundedYear
      ? [...baseFilters, `publication_year:${boundedYear}-${currentYear}`]
      : baseFilters;
    const [newest, mostCited] = await Promise.all([
      fetchSorted("publication_date:desc", baseFilters),
      fetchSorted("cited_by_count:desc", notableFilters),
    ]);

    const merged = [...newest, ...mostCited].filter((paper, index, all) =>
      all.findIndex(candidate => candidate.openAlexId === paper.openAlexId) === index
    );
    const recentCutoff = currentYear - 1;
    const notableRecent = merged
      .filter(paper => paper.year >= recentCutoff)
      .sort((a, b) => b.citationCount - a.citationCount);
    return [...notableRecent, ...merged]
      .filter((paper, index, all) =>
        all.findIndex(candidate => candidate.openAlexId === paper.openAlexId) === index
      )
      .slice(0, limit);
  } catch (err) {
    console.log(`[OpenAlex] Citing works error: ${err}`);
    return [];
  }
}

// A softer fallback for rows without a usable OpenAlex ID, or for old cached
// empty follow-up shelf. Search recent work using caller-provided concept terms;
// the caller filters the source paper itself out before caching.
export async function getOpenAlexRecentWorksByQuery(
  query: string,
  limit = 8,
): Promise<OpenAlexPaper[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const year = new Date().getFullYear();
    const params = new URLSearchParams({
      search: q,
      filter: [
        "has_abstract:true",
        "type:article|preprint",
        `publication_year:${year - 3}-${year}`,
      ].join(","),
      sort: "publication_date:desc",
      "per-page": String(limit),
      select: OA_SELECT,
      mailto: OA_MAILTO,
    });
    const res = await oaFetch(`${OA_BASE}/works?${params}`);
    if (!res.ok) {
      console.log(`[OpenAlex] Recent works search ${res.status} for "${q}"`);
      return [];
    }
    const data = await res.json();
    return (data.results as OARawWork[] || [])
      .filter(w => w.title && w.abstract_inverted_index)
      .map(mapWork)
      .filter(p => p.title && p.abstract.length > 50);
  } catch (err) {
    console.log(`[OpenAlex] Recent works search error: ${err}`);
    return [];
  }
}

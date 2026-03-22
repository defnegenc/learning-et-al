/**
 * Venue & institution quality scoring.
 *
 * Based on recsys literature: "high quality" is one of the 7 serendipity factors
 * (Kotkov et al.). A niche paper from CHI is worth more than a generic paper
 * from an unknown journal. These are BOOST multipliers, not filters.
 */

// Top-tier venues per field — papers from these get a quality boost
const VENUE_TIERS: Record<string, Set<string>> = {
  "Computer Science": new Set([
    "neurips", "icml", "chi", "siggraph", "cvpr", "acl", "iclr", "aaai",
    "uist", "cscw", "ubicomp", "www", "kdd", "icse", "fse",
    "proceedings of the acm", "acm computing surveys",
    "nature machine intelligence", "artificial intelligence",
  ]),
  "Art": new Set([
    "dis", "tei", "c&c", "creativity and cognition", "leonardo",
    "design research society", "nime", "isea", "siggraph",
    "international journal of design",
  ]),
  "Biology": new Set([
    "nature", "science", "cell", "pnas", "elife", "nature medicine",
    "nature biotechnology", "nature genetics", "nature methods",
    "genome research", "molecular cell",
  ]),
  "Medicine": new Set([
    "new england journal of medicine", "lancet", "jama", "bmj",
    "nature medicine", "annals of internal medicine",
    "lancet digital health", "npj digital medicine",
  ]),
  "Sociology": new Set([
    "psychological science", "american economic review", "pnas", "science",
    "quarterly journal of economics", "econometrica",
    "journal of personality and social psychology", "cognition",
  ]),
  "Physics": new Set([
    "physical review letters", "nature physics", "science robotics",
    "nature energy", "advanced materials", "joule",
    "ieee transactions on pattern analysis",
  ]),
  "Business": new Set([
    "harvard business review", "journal of finance", "management science",
    "journal of financial economics", "strategic management journal",
    "administrative science quarterly",
  ]),
  "Environmental Science": new Set([
    "nature climate change", "nature sustainability", "one earth",
    "environmental science & technology", "lancet planetary health", "joule",
  ]),
  "Law": new Set([
    "harvard law review", "yale law journal", "stanford law review",
    "regulation & governance", "nature human behaviour",
  ]),
  "Philosophy": new Set([
    "philosophy & public affairs", "ethics", "mind", "facct",
    "fairness accountability and transparency",
    "philosophy of science", "bioethics",
  ]),
  "Linguistics": new Set([
    "acl", "language", "cognition", "emnlp", "tacl",
    "linguistic inquiry", "applied linguistics",
  ]),
  "Education": new Set([
    "review of educational research", "computers & education",
    "learning at scale", "learning analytics and knowledge",
    "artificial intelligence in education", "science of learning",
  ]),
};

// Top institutions — papers from these get a smaller boost
const TOP_INSTITUTIONS = new Set([
  "mit", "stanford", "harvard", "oxford", "cambridge", "eth zurich",
  "carnegie mellon", "berkeley", "princeton", "caltech",
  "google", "deepmind", "meta", "microsoft research", "openai",
  "max planck", "imperial college", "yale", "columbia", "cornell",
  "university of washington", "georgia tech", "ucl", "toronto",
  "risd", "royal college of art", "parsons", "central saint martins",
  "aalto", "tsinghua", "national university of singapore",
]);

/**
 * Score a paper's venue quality. Returns 0-0.1 boost.
 *
 * @param venueName - Journal/conference name from OpenAlex
 * @param field - Academic field (e.g. "Computer Science")
 * @returns Quality boost (0 = unknown venue, 0.08 = top-tier venue)
 */
export function venueQualityBoost(venueName: string | undefined, field: string | undefined): number {
  if (!venueName || !field) return 0;
  const v = venueName.toLowerCase();

  // Check field-specific venues
  const fieldVenues = VENUE_TIERS[field];
  if (fieldVenues) {
    for (const venue of fieldVenues) {
      if (v.includes(venue)) return 0.08;
    }
  }

  // Check cross-field top venues
  for (const venues of Object.values(VENUE_TIERS)) {
    for (const venue of venues) {
      if (v.includes(venue)) return 0.05; // Lower boost for out-of-field match
    }
  }

  return 0;
}

/**
 * Score institutional credibility from author affiliations.
 * Returns 0-0.05 boost.
 */
export function institutionBoost(institutions: string[]): number {
  if (institutions.length === 0) return 0;
  for (const inst of institutions) {
    const lower = inst.toLowerCase();
    for (const top of TOP_INSTITUTIONS) {
      if (lower.includes(top)) return 0.05;
    }
  }
  return 0;
}

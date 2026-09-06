// Source-quality gate for academic candidates (agent-authored, Sep 6 2026).
//
// A self-published Zenodo "paper" - word-salad title, seventh installment of
// a self-styled series - made it into the Sep 6 edition as Source 3, and the
// writer had to route around it. Zenodo is a general-purpose repository:
// anyone can mint a DOI there and nothing is peer-reviewed. Dropping those
// DOIs at fetch time keeps them away from the judge entirely. Keep this list
// to open-repository prefixes; arXiv and SSRN are moderated preprint servers,
// not the same thing.
const BLOCKED_DOI_PREFIXES = ["10.5281/zenodo"];

/** True when the DOI (or a URL containing it, e.g. https://doi.org/...) belongs to a blocked repository. */
export function hasBlockedDoiPrefix(doiOrUrl: string | null | undefined): boolean {
  if (!doiOrUrl) return false;
  const v = doiOrUrl.toLowerCase();
  return BLOCKED_DOI_PREFIXES.some(prefix => v.includes(prefix));
}

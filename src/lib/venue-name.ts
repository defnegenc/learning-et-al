// Derive a human-readable source/venue name from a paper URL (arXiv, Nature,
// PNAS, …), via hostname and DOI-prefix maps. Returns null when it can't tell.
export function journalName(sourceUrl: string | null, authors: string[] = []): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "");
    const domainMap: Record<string, string> = {
      "arxiv.org": "arXiv", "nature.com": "Nature", "sciencedirect.com": "ScienceDirect",
      "springer.com": "Springer", "ieee.org": "IEEE", "acm.org": "ACM", "pnas.org": "PNAS",
      "frontiersin.org": "Frontiers", "mdpi.com": "MDPI", "wiley.com": "Wiley",
      "tandfonline.com": "Taylor & Francis", "sagepub.com": "SAGE", "cambridge.org": "Cambridge UP",
      "oup.com": "Oxford UP", "plos.org": "PLOS", "biorxiv.org": "bioRxiv",
      "medrxiv.org": "medRxiv", "ssrn.com": "SSRN", "researchgate.net": "ResearchGate",
      "mckinsey.com": "McKinsey",
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    if (hostname.includes("doi.org")) {
      const path = new URL(sourceUrl).pathname;
      const doiMap: Record<string, string> = {
        "10.3389": "Frontiers", "10.1038": "Nature", "10.1016": "Elsevier",
        "10.1007": "Springer", "10.1109": "IEEE", "10.1145": "ACM",
        "10.1073": "PNAS", "10.3390": "MDPI", "10.1002": "Wiley",
        "10.1080": "Taylor & Francis", "10.1177": "SAGE", "10.1371": "PLOS",
        "10.1093": "Oxford UP", "10.1017": "Cambridge UP",
      };
      for (const [prefix, pub] of Object.entries(doiMap)) {
        if (path.includes(prefix)) return pub;
      }
      return null;
    }
    const parts = hostname.split(".");
    const name = parts.length > 2 ? parts.slice(0, -2).join(".") : parts[0];
    if (name.length < 3) return null;
    const derived = name.charAt(0).toUpperCase() + name.slice(1);
    // Don't show a "journal" that just duplicates an author surname.
    if (authors.some((a) => a.toLowerCase() === derived.toLowerCase())) return null;
    return derived;
  } catch { return null; }
}

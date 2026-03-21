export type S2Field =
  | "Computer Science" | "Medicine" | "Biology" | "Physics"
  | "Psychology" | "Economics" | "Engineering" | "Mathematics"
  | "Art" | "Sociology" | "Business" | "Environmental Science"
  | "Law" | "Philosophy" | "Linguistics" | "Political Science";

export type ExpertiseLevel = "beginner" | "intermediate" | "expert";

export interface InterestEntry {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  level: ExpertiseLevel;
}

export interface FieldDef {
  label: string;
  color: string;
  s2Field: S2Field;
  subfields: Record<string, string[]>;
}

export const FIELD_HIERARCHY: Record<string, FieldDef> = {
  "Computer Science": {
    label: "CS",
    color: "#bfdbfe",
    s2Field: "Computer Science",
    subfields: {
      "AI & Machine Learning": ["large language models", "generative AI", "AI agents", "computer vision", "reinforcement learning", "AI alignment", "multimodal models"],
      "Human-Computer Interaction": ["design tools", "user experience", "creative AI", "co-creative systems", "accessibility", "conversational interfaces", "prototyping"],
      "Graphics & Vision": ["image generation", "diffusion models", "3D rendering", "video synthesis", "neural radiance fields"],
      "Systems": ["distributed systems", "databases", "cloud computing", "edge computing"],
      "Security & Privacy": ["privacy", "cybersecurity", "adversarial ML", "federated learning"],
    },
  },
  "Design & Art": {
    label: "DESIGN",
    color: "#fbcfe8",
    s2Field: "Art",
    subfields: {
      "Design & Technology": ["design tools", "design systems", "design thinking", "interaction design", "service design"],
      "Architecture & Space": ["architecture", "interior design", "urban design", "landscape design", "spatial design"],
      "Visual Arts & Aesthetics": ["aesthetics", "color theory", "typography", "art history", "visual culture", "contemporary art"],
      "Creative Practice": ["generative art", "creative coding", "sculpture", "illustration", "photography", "ceramics"],
      "Fashion & Material": ["fashion design", "sustainable fashion", "textile design", "material culture", "costume history"],
    },
  },
  "Biology": {
    label: "BIO",
    color: "#bbf7d0",
    s2Field: "Biology",
    subfields: {
      "Neuroscience": ["cognitive science", "brain-computer interfaces", "neuroimaging", "neural circuits", "memory and learning"],
      "Genetics & Genomics": ["CRISPR", "genomics", "gene expression", "epigenetics", "single-cell sequencing"],
      "Microbiology": ["microbiome", "antimicrobial resistance", "synthetic biology", "virology"],
      "Computational Biology": ["protein folding", "drug discovery", "bioinformatics", "structural biology"],
    },
  },
  "Medicine": {
    label: "MED",
    color: "#fef08a",
    s2Field: "Medicine",
    subfields: {
      "Clinical AI": ["clinical decision support", "precision medicine", "diagnostic AI", "medical imaging"],
      "Mental Health": ["digital therapeutics", "mental health AI", "behavioral health", "psychiatry"],
      "Public Health": ["epidemiology", "global health", "pandemic modeling", "health policy"],
    },
  },
  "Social Sciences": {
    label: "SOCIAL",
    color: "#e9d5ff",
    s2Field: "Sociology",
    subfields: {
      "Psychology": ["cognitive psychology", "behavioral economics", "social cognition", "decision making"],
      "Sociology": ["social networks", "misinformation", "digital society", "labor and automation"],
      "Economics": ["mechanism design", "game theory", "digital economies", "platform economics"],
    },
  },
  "Physics & Math": {
    label: "PHYS",
    color: "#fed7aa",
    s2Field: "Physics",
    subfields: {
      "Physics": ["quantum computing", "condensed matter", "materials science", "photonics"],
      "Mathematics": ["optimization", "statistical learning theory", "topology", "graph theory"],
    },
  },
  "Business & Finance": {
    label: "BIZ",
    color: "#fde68a",
    s2Field: "Business",
    subfields: {
      "Fintech": ["decentralized finance", "digital payments", "blockchain finance", "banking AI", "payment systems", "neobanks"],
      "Strategy & Markets": ["platform economics", "venture capital", "market design", "competitive strategy", "business models"],
      "Marketing & Consumer": ["consumer behavior", "digital marketing", "advertising tech", "brand strategy", "recommendation systems"],
      "Operations & Supply Chain": ["logistics AI", "supply chain optimization", "inventory management", "demand forecasting"],
    },
  },
  "Sustainability": {
    label: "ENV",
    color: "#bbf7d0",
    s2Field: "Environmental Science",
    subfields: {
      "Climate & Energy": ["climate change", "renewable energy", "carbon capture", "energy storage", "net zero"],
      "Green Tech": ["sustainable materials", "circular economy", "smart grids", "electric vehicles", "green hydrogen"],
      "Ecology": ["biodiversity", "ecosystem modeling", "conservation", "ocean science", "land use"],
      "Policy & Justice": ["carbon markets", "climate policy", "environmental justice", "sustainability reporting"],
    },
  },
  "Engineering": {
    label: "ENG",
    color: "#d1fae5",
    s2Field: "Engineering",
    subfields: {
      "Robotics & Automation": ["robotics", "autonomous systems", "human-robot interaction", "drone systems", "soft robotics"],
      "Hardware & Fabrication": ["semiconductors", "3D printing", "nanomaterials", "embedded systems", "MEMS"],
      "Civil & Infrastructure": ["smart cities", "structural engineering", "infrastructure AI", "construction tech"],
      "Biomedical Engineering": ["prosthetics", "neural implants", "bioelectronics", "tissue engineering"],
    },
  },
  "Law & Policy": {
    label: "LAW",
    color: "#e0e7ff",
    s2Field: "Law",
    subfields: {
      "AI Governance": ["AI regulation", "algorithmic accountability", "AI policy", "data governance", "model auditing"],
      "Digital Rights": ["privacy law", "intellectual property", "platform regulation", "content moderation"],
      "Global Policy": ["geopolitics of tech", "international AI governance", "trade policy", "sanctions tech"],
    },
  },
  "Philosophy & Ethics": {
    label: "PHIL",
    color: "#ede9fe",
    s2Field: "Philosophy",
    subfields: {
      "AI & Technology Ethics": ["AI ethics", "value alignment", "technology ethics", "AI consciousness", "moral machines"],
      "Mind & Cognition": ["philosophy of mind", "consciousness", "extended cognition", "intentionality"],
      "Applied Ethics": ["bioethics", "political philosophy", "justice and fairness", "existential risk"],
    },
  },
  "Language & Linguistics": {
    label: "LING",
    color: "#fce7f3",
    s2Field: "Linguistics",
    subfields: {
      "NLP & Language AI": ["natural language processing", "language models", "machine translation", "speech recognition", "dialogue systems"],
      "Linguistics": ["computational linguistics", "language acquisition", "pragmatics", "discourse analysis", "multilingualism"],
      "Communication": ["misinformation", "narrative framing", "political communication", "media studies"],
    },
  },
  "Education": {
    label: "EDU",
    color: "#fef9c3",
    s2Field: "Computer Science",
    subfields: {
      "Learning Technology": ["educational AI", "adaptive learning", "intelligent tutoring", "personalized education", "MOOCs"],
      "Learning Science": ["cognitive load", "memory consolidation", "spaced repetition", "collaborative learning"],
      "EdTech & Access": ["digital divide", "online education", "learning analytics", "gamification"],
    },
  },
};

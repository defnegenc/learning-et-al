// Canned content for the interactive-brief UX prototype.
// No pipeline, no DB — this is throwaway data to feel the interaction.

export interface Source {
  id: string;
  shortName: string;       // how it's cited inline (lowercase; capitalized at sentence start)
  title: string;
  authors: string;
  venue: string;           // mono label, e.g. "SCIENCE · 2011"
  url: string;             // link out to the actual study
  summary: string;
  keywords: string[];
  paletteIdx: number;      // index into SOURCE_PALETTES
  discovered?: boolean;    // true if found mid-thread by the agent
}

// Mirrors SOURCE_PALETTES in synthesis-banner.tsx
export const SOURCE_PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
  ["#D8C8F0", "#F0C8D8"],
];

export const SOURCES: Record<string, Source> = {
  karpicke: {
    id: "karpicke",
    shortName: "the Karpicke testing study",
    title: "Retrieval Practice Produces More Learning than Elaborative Studying",
    authors: "Karpicke & Blunt",
    venue: "SCIENCE · 2011",
    url: "https://www.science.org/doi/10.1126/science.1199327",
    summary:
      "Students who repeatedly tested themselves on material remembered ~50% more a week later than students who used concept mapping, even though the testers felt like they were learning less.",
    keywords: ["retrieval practice", "testing effect"],
    paletteIdx: 0,
  },
  dunlosky: {
    id: "dunlosky",
    shortName: "the Dunlosky technique review",
    title: "Improving Students' Learning With Effective Learning Techniques",
    authors: "Dunlosky et al.",
    venue: "PSYCH SCI · 2013",
    url: "https://journals.sagepub.com/doi/10.1177/1529100612453266",
    summary:
      "A sweep of 10 study techniques rated by evidence strength. Spaced practice and practice testing scored 'high utility'; highlighting and rereading, the two most popular, scored 'low'.",
    keywords: ["spaced practice", "meta-review"],
    paletteIdx: 1,
  },
  rohrer: {
    id: "rohrer",
    shortName: "the Rohrer interleaving trial",
    title: "Interleaved Practice Improves Mathematics Learning",
    authors: "Rohrer, Dedrick & Stershic",
    venue: "J. EDU. PSYCH · 2015",
    url: "https://psycnet.apa.org/doi/10.1037/edu0000001",
    summary:
      "Mixing problem types within a session (instead of blocking one type at a time) tripled test scores a month later: 72% vs 38%, despite feeling harder during practice.",
    keywords: ["interleaving", "desirable difficulty"],
    paletteIdx: 2,
  },
  // Discovered mid-thread by the simulated agent:
  cepeda: {
    id: "cepeda",
    shortName: "a 2008 spacing-gap study",
    title: "Spacing Effects in Learning: A Temporal Ridgeline of Optimal Retention",
    authors: "Cepeda et al.",
    venue: "PSYCH SCI · 2008",
    url: "https://journals.sagepub.com/doi/10.1111/j.1467-9280.2008.02209.x",
    summary:
      "Tested 1,350 people across gaps from minutes to months. The best gap scales with how long you need to remember: for a test a month out, study sessions ~1 week apart beat same-day cramming by a wide margin.",
    keywords: ["spacing gap", "retention interval"],
    paletteIdx: 3,
    discovered: true,
  },
  pan: {
    id: "pan",
    shortName: "a transfer meta-analysis",
    title: "Transfer of Test-Enhanced Learning",
    authors: "Pan & Rickard",
    venue: "PSYCH BULLETIN · 2018",
    url: "https://psycnet.apa.org/doi/10.1037/bul0000151",
    summary:
      "Across 192 experiments, testing reliably beats restudy for the exact material, but the benefit shrinks when the final test asks something different from the practice questions.",
    keywords: ["transfer", "meta-analysis"],
    paletteIdx: 4,
    discovered: true,
  },
};

// A "segment" is one unit of thread body. Sections are split on `break`
// and around `card` segments; each section reveals on scroll.
export type Segment =
  | { t: "w"; text: string }                 // a run of plain words
  | { t: "b"; text: string }                 // bold run
  | { t: "term"; text: string; def: string } // jargon with hover definition
  | { t: "cite"; srcId: string; cap?: boolean } // inline citation chip (cap = capitalize)
  | { t: "card"; srcId: string }             // inline blob card (its own section)
  | { t: "break" };                          // section boundary

export interface Thread {
  id: string;
  question: string;
  status: string[];        // mono status lines shown as the loading state
  body: Segment[];
  seeds: { id: string; label: string }[];   // nested follow-ups
}

export interface BriefData {
  centralQuestion: string;
  verdict: Segment[];
  seeds: { id: string; label: string }[];
  threads: Record<string, Thread>;
}

const w = (text: string): Segment => ({ t: "w", text });
const b = (text: string): Segment => ({ t: "b", text });
const term = (text: string, def: string): Segment => ({ t: "term", text, def });
const cite = (srcId: string): Segment => ({ t: "cite", srcId });
const citeCap = (srcId: string): Segment => ({ t: "cite", srcId, cap: true });
const card = (srcId: string): Segment => ({ t: "card", srcId });
const brk = (): Segment => ({ t: "break" });

export const BRIEF: BriefData = {
  centralQuestion: "Is cramming ever the smart move?",
  verdict: [
    w("Mostly no, but the exception is narrower and weirder than you'd think. The thing that actually moves memory isn't time spent, it's"),
    b("effort spent retrieving."),
    citeCap("karpicke"),
    w("found that students who quizzed themselves remembered about 50% more a week later than students who carefully re-read and mapped the material, even though the quizzers felt like they were learning less."),
    brk(),
    w("That"),
    term("feeling-of-learning gap", "The illusion that material feels learned just because it reads smoothly, even though you couldn't reproduce it on a blank page."),
    w("is the whole trap:"),
    cite("dunlosky"),
    w("rated the two most popular techniques, rereading and highlighting, as low-utility, while the awkward-feeling ones won."),
    brk(),
    w("So cramming pays off in exactly one case, when the test is hours away and you'll never need the material again. For anything you actually want to keep, spacing and self-testing beat it, every time."),
  ],
  seeds: [
    { id: "why-feels-wrong", label: "Why does the better method feel worse?" },
    { id: "how-much-spacing", label: "How spaced is spaced enough?" },
    { id: "does-it-transfer", label: "Does this hold on a real exam?" },
  ],
  threads: {
    "why-feels-wrong": {
      id: "why-feels-wrong",
      question: "Why does the better method feel worse?",
      status: ["READING CLAIMS: karpicke, dunlosky", "CROSS-REFERENCING: desirable difficulty"],
      body: [
        w("Because your brain reads"),
        term("fluency", "How smoothly information processes as you read it. The brain misreads that smoothness as mastery."),
        w("as mastery, and the two come apart. When you reread a page it goes down smooth, and that smoothness feels like knowing. But"),
        cite("dunlosky"),
        w("found that smooth feeling is the least reliable signal in the bunch, it tracks how familiar the words look, not whether you could produce them on a blank page."),
        brk(),
        w("Retrieval feels worse precisely because it makes you hit the wall where the knowledge isn't yet, which is the only place learning actually happens."),
      ],
      seeds: [
        { id: "desirable-difficulty", label: "Is harder always better, then?" },
        { id: "metacognition-fix", label: "Can you train the feeling to be accurate?" },
      ],
    },
    "how-much-spacing": {
      id: "how-much-spacing",
      question: "How spaced is spaced enough?",
      status: [
        "READING CLAIMS: dunlosky",
        "SEARCHING OPENALEX: optimal spacing gap retention",
        "READING: Cepeda et al. 2008",
      ],
      body: [
        w("There's an actual answer to this, and it's not in today's three papers, so I went looking."),
        citeCap("cepeda"),
        w("tested 1,350 people across gaps ranging from minutes to months, and found the best gap scales with how long you need to hold the memory."),
        b("Rough rule:"),
        w("space your sessions at about 10 to 20% of the target interval. Studying for a test a month away? Sessions roughly a week apart. The same-day cram sits at the bottom of that curve, it works for tomorrow and collapses by next week."),
      ],
      seeds: [
        { id: "spacing-software", label: "Which tools actually do this?" },
        { id: "cramming-window", label: "So when IS cramming optimal?" },
      ],
    },
    "does-it-transfer": {
      id: "does-it-transfer",
      question: "Does this hold on a real exam?",
      status: [
        "READING CLAIMS: karpicke, rohrer",
        "SEARCHING OPENALEX: test-enhanced learning transfer",
        "READING: Pan & Rickard 2018",
      ],
      body: [
        w("Partly, and this is the honest caveat the headline studies bury. The big testing-effect wins like"),
        cite("karpicke"),
        w("are measured on the same material you practiced. When the exam asks something different, the edge shrinks."),
        citeCap("pan"),
        w("pooled 192 experiments and found testing still beats restudy for"),
        term("transfer", "Whether practice on one task carries over to a different task, not just the exact thing you drilled."),
        w(", but by a smaller margin."),
        w("The fix shows up in"),
        cite("rohrer"),
        w(": interleaving problem types forces you to practice picking the right approach, not just executing it, which is the part a real exam actually tests."),
      ],
      seeds: [
        { id: "interleaving-how", label: "How do you interleave on purpose?" },
        { id: "transfer-limits", label: "What never transfers?" },
      ],
    },
    // ---- second-level (nested) threads ----
    "desirable-difficulty": {
      id: "desirable-difficulty",
      question: "Is harder always better, then?",
      status: ["READING CLAIMS: rohrer", "CHECKING: desirable vs undesirable difficulty"],
      body: [
        w("No, and this is where people overcorrect. The term of art is"),
        term("desirable difficulty", "Friction that forces you to retrieve or discriminate, which helps learning, as opposed to friction that just adds noise."),
        w(": friction that makes you retrieve or discriminate is good, friction that just adds noise is not."),
        citeCap("rohrer"),
        w("got a tripling of scores from interleaving because mixing problems makes you choose a strategy. But making the font ugly or the audio quiet adds difficulty with no retrieval payoff, and those reliably do nothing. The test is always: does the hard part force the knowledge out of your head?"),
      ],
      seeds: [{ id: "interleaving-how", label: "How do you interleave on purpose?" }],
    },
    "spacing-software": {
      id: "spacing-software",
      question: "Is that what Anki is doing?",
      status: ["SEARCHING VAULT: spaced repetition systems", "READING CLAIMS: cepeda"],
      body: [
        w("Exactly that. Spaced-repetition software automates the spacing curve that"),
        cite("cepeda"),
        w("mapped: each time you recall a card it pushes the next review further out, and each time you miss it pulls the gap back in. It's the optimal-gap finding turned into a scheduler, so you never have to guess the interval yourself."),
      ],
      seeds: [{ id: "cramming-window", label: "So when IS cramming optimal?" }],
    },
    "cramming-window": {
      id: "cramming-window",
      question: "So when IS cramming optimal?",
      status: ["READING CLAIMS: cepeda, dunlosky"],
      body: [
        w("One specific window: when the payoff is imminent and disposable. If the test is tomorrow morning and you'll dump the material after, massed cramming maximizes short-term recall. You'll genuinely score higher than if you'd spaced those same hours. That lines up with"),
        cite("cepeda"),
        w(", whose curve collapses toward a zero gap when you only need the memory for a day. The catch is that almost nothing you study is truly disposable, so the window is real but rare."),
      ],
      seeds: [],
    },
    "metacognition-fix": {
      id: "metacognition-fix",
      question: "Can you train the feeling to be accurate?",
      status: ["SEARCHING OPENALEX: judgments of learning calibration"],
      body: [
        w("Somewhat. The reliable fix isn't training the gut, it's replacing it with a measurement: take a no-stakes quiz and let the score, not the feeling, tell you what you know. People who self-test calibrate far better because they've seen the gap between 'looks familiar' and 'can produce it.' The feeling never fully gets honest, so the move is to stop trusting it."),
      ],
      seeds: [],
    },
    "interleaving-how": {
      id: "interleaving-how",
      question: "How do you interleave on purpose?",
      status: ["READING CLAIMS: rohrer"],
      body: [
        w("Shuffle, don't block. Instead of 20 problems of type A then 20 of type B, mix them so you never know which approach is coming."),
        citeCap("rohrer"),
        w("did exactly this with middle-school math and got 72% versus 38% a month later. For your own material: mix chapters in one session, shuffle flashcard decks together, and resist re-grouping by topic even though blocked practice feels tidier and more productive."),
      ],
      seeds: [],
    },
    "transfer-limits": {
      id: "transfer-limits",
      question: "What never transfers?",
      status: ["READING CLAIMS: pan"],
      body: [
        w("Rote facts to novel reasoning is the hard wall."),
        citeCap("pan"),
        w("found the transfer benefit was thinnest when practice was pure recall and the test demanded application. Memorizing definitions does little for a test that asks you to use the concept in a new situation. For that you have to practice the using, not just the knowing."),
      ],
      seeds: [],
    },
  },
};

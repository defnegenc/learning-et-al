# User models and preferences: what the literature actually says

> Compiled 2026-08-25 from three parallel literature-verification passes. Every paper
> below was verified by fetching its arXiv/ACL/ACM/Springer/NeurIPS page during the
> research session; claims are limited to what those sources state. Where something
> could not be confirmed, it is marked. Nothing in this file is invented to fill a gap;
> the gaps are listed as gaps in the final section.
>
> Companion docs: `docs/recsys-literature.md` (serendipity),
> `docs/plans/orchestrator-subagents.md` (how this feeds the pipeline).

The question this file answers: **how can we build a model of a reader that captures
their research tastes, the tone they like, and what piques their curiosity, grounded in
published work rather than vibes?**

---

## 1. The Stanford thread: General User Models (GUM)

**Creating General User Models from Computer Use.**
Omar Shaikh, Shardul Sapkota, Shan Rizvi, Eric Horvitz, Joon Sung Park, Diyi Yang,
Michael S. Bernstein. UIST 2025. arXiv:2505.10831. Code: github.com/generalusermodels/gum.
(Venue verified via Semantic Scholar + ACM DL search listing; the DL page itself 403'd.)

This is the paper the "general user model" conversation orbits. Verified architecture:

- **Inputs:** observers over any computer use: screenshots transcribed by a
  vision-language model, OS notifications, filesystem, and arbitrary custom feeds.
- **Representation:** confidence-weighted **natural-language propositions** about the
  user's behavior, knowledge, beliefs, and preferences. Confidence is elicited from the
  LLM on a 1-10 scale (not logits). Each proposition also carries a decay score for
  staleness ("is a Ph.D. student" decays slowly, transient states fast), grounding in
  raw observations plus reasoning traces, and timestamps.
- **Maintenance:** BM25 retrieval with exponential recency decay and MMR diversity,
  then LLM reranking; a revision module compares new and retrieved propositions
  against observations and updates confidence. Contradictions lower confidence;
  low-confidence propositions are kept, never fully evicted, for transparency.
- **Privacy audit:** built on Nissenbaum's contextual integrity; the system queries the
  GUM for the user's own privacy norms before generating propositions and blocks
  sensitive observations such as credentials.
- **Evaluation (N=18, email corpus):** 76.15% proposition accuracy, Brier 0.17, and
  systematically **underconfident**, which the authors argue is the right failure
  direction. Propositions at confidence above 0.8 were 88.2% accurate; at 1.0, 100%.
  Ablating retrieval or revision hurt both accuracy and calibration.

**Gumbo** (the just-in-time application): a proactive assistant on top of the GUM. For
each new proposition it generates candidate suggestions with aggregate confidence, then
decides whether to interrupt using Horvitz's mixed-initiative expected-utility framing
(estimated benefit vs false-positive and false-negative costs), plus a rate limit of
one suggestion per minute. Where safe it executes work rather than only suggesting.
Study: N=5 over ~5 days; propositions stayed accurate (0.79) and calibrated; 2 of 5
participants asked to keep it after the study.

**Verified negative findings, which matter as much as the architecture:**
- Early versions over-suggested (multiple per minute) and frustrated people even after
  utility gating.
- Value-laden propositions ("P1 is struggling with fixing bugs", "P2 may be
  experiencing stress") were often *correct* yet felt judgmental and presumptuous.
- A privacy paradox: participants consented to logging but were uncomfortable with the
  candor of the resulting inferences ("kind of weird seeing this in writing").
- **Adversarial poisoning:** phishing emails were absorbed as genuine interests,
  producing high-confidence false propositions. An observation stream is an attack
  surface.
- The authors recommend GUMs run on the user's own infrastructure with open models.

**Verified follow-ups and siblings** (same lab or direct citation; one-liners are
accurately sourced):
- *Learning Next Action Predictors from Human-Computer Interaction* (Shaikh et al.,
  2026, arXiv:2603.05923): next-action prediction from 360K+ actions of naturalistic
  phone use.
- *"What Are You Really Trying to Do?": Co-Creating Life Goals from Everyday Computer
  Use* (Sapkota et al., 2026, arXiv:2605.00497): infers hierarchical life goals from
  computer use with a user-editing loop; field study found greater user agency.
- *Behavior Latticing* (Zhao, Lam, Yang, Bernstein, 2026, arXiv:2604.07629): connects
  disparate behaviors into synthesized insights about user motivations.
- *ClariCheck* (Sharma and Yadati, CUI 2026): flags unsupported inferences in
  AI-generated user propositions; the clearest external critique of the artifact.
  (Details beyond title/venue unverified; abstract not fetchable.)
- Adjacent citing work: Mind Mapper and "Before You Say It" (MIT Media Lab,
  conversation-based behavioral modeling), SERUM (state machines from screen video),
  Omakase (proactive suggestions for research projects; Ai2).

**Takeaway for us:** the GUM design choices map almost one-to-one onto what our dossier
should become: natural-language propositions *with confidence and decay* instead of
undifferentiated prose; retrieval + revision instead of overwrite; underconfidence as
the target failure mode; and an audit step before a proposition is stored. The
negative findings map too: our dossier prose must never editorialize about the reader
("struggles with statistics"), and any observation stream we ingest is poisonable.

---

## 2. User modeling in the LLM era: the broader verified landscape

### Surveys (the maps)
- **Personalization of Large Language Models: A Survey** (Zhang et al., 2024, TMLR per
  arXiv). Taxonomies of granularity (user-level vs persona-level vs global),
  techniques, datasets, evaluation.
- **User Modeling in the Era of Large Language Models** (Tan and Jiang, 2023, IEEE Data
  Eng. Bulletin). LLM-for-user-modeling taxonomy across text and graph user data.
- **A Survey on Personalized Alignment** (Guan et al., Findings of ACL 2025). Framework
  of preference memory management + personalized generation + feedback-based
  alignment, which is essentially a digest product's loop.

### Natural-language user profiles (the dossier's lineage)
- **Radlinski, Balog, Diaz, Dixon, Wedin (SIGIR 2022, Google)**: the position paper
  arguing for NL preference profiles for transparency, scrutability (user can read and
  edit), and portability. A case statement, not a benchmark win.
- **Ramos et al. (ACL 2024)**: LLM-generated NL profile from a user's reviews drives
  recommendations at performance "comparable to established systems" in warm start.
  Evidence status: **parity with embeddings, not superiority**, with editability as the
  compensating benefit.
- **Richardson et al. (Amazon, CIKM workshop 2023)**: offline LLM summaries of user
  history + retrieval achieve parity or better on most LaMP tasks while using ~75%
  less user data at runtime. Strongest quantitative case for the summarize-offline,
  inject-at-generation shape, which is exactly the shape our dossier keeper has.

### Learning preferences from behavior
- **Hu, Koren, Volinsky (ICDM 2008)**: implicit signals are preference plus
  *confidence*, not ratings. Saves/opens/skips are confidence-weighted positives.
- **Rendle et al., BPR (UAI 2009)**: implicit feedback is inherently pairwise: the
  opened card should rank above the skipped one.
- **PRELUDE/CIPHER (Gao et al., NeurIPS 2024)**: infers a *textual* description of a
  user's latent preference purely from the edits they make to agent outputs, retrieved
  by context similarity. Closest verified thing to "learn taste from behavior," though
  edits are an active corrective act, not passive reading.
- **DITTO (Shaikh et al., ICLR 2025)**: fewer than 10 user-written demonstrations,
  treated as preferred over model outputs, beat few-shot prompting by ~19 points on
  writing style. State of the art for tone from a handful of the user's own writing.
- **Drift (Kim et al., 2025, arXiv:2502.14289, venue unverified)**: training-free
  decoding-time personalization from 50-100 examples, modeling preference as a
  composition of interpretable attributes. Relevant because 50-100 is a realistic
  per-reader data scale for us.
- **P-RLHF / VPL / HYDRA / OPPU** (all verified, NeurIPS/EMNLP 2024): the per-user
  alignment family. All require explicit preference labels or LaMP-style user-authored
  histories. VPL is explicitly few-shot at inference. **None claims to work from
  passive reading behavior.**

### Benchmarks
- **LaMP** (Salemi et al., ACL 2024): seven personalization tasks; LaMP-1 (would this
  researcher cite this paper?) and LaMP-5 (title in this researcher's voice) are the
  closest to our product. Style is only measured indirectly via ROUGE overlap.
- **LongLaMP** (Kumar et al., 2024, venue unverified): long-form personalized
  generation; LongLaMP-2 (abstract in a given researcher's style) is the nearest
  published analog of "write the digest in the reader's register." Same
  n-gram-overlap limitation.

### Scholarly recommendation specifically
- **SPECTER** (Cohan et al., ACL 2020) and **SPECTER2 / SciRepEval** (Singh et al.,
  EMNLP 2023): citation-informed paper embeddings; SciRepEval's finding that one
  embedding does not serve all task formats (use per-format adapters) applies to a
  pipeline that both searches and ranks. Known upgrade path from our MiniLM
  (algorithm.md Known Issue 9).
- **Bridger** (Portenoy et al., CHI 2022): faceted author representations matched on
  *partial commonality plus deliberate contrast*; user studies showed it surfaced
  useful novel connections relevance ranking missed. The best verified precedent for
  "curiosity over pure relevance": model taste as facets, match some, contrast others.
- **Scholar Inbox** (Flicke et al., 2025, arXiv:2504.08385): a live personalized
  preprint-digest product. Trains on explicit up/downvotes, bootstraps cold start with
  a map of science, uses active learning to ask for ratings where they are most
  informative, and released ~800K user ratings. The most directly comparable published
  system to Learning et al.
- Semantic Scholar's feed: **no published paper describing its recommender could be
  verified.** The platform paper (Kinney et al., 2023) covers the APIs, not the feed.

### Memory architectures as user models
- **MemGPT** (Packer et al., 2023): the LLM pages its own memory between context tiers;
  canonical self-maintained persistent user state.
- **Mem0** (2025): extract-and-consolidate memory; self-reported wins on LOCOMO
  (vendor paper, no independent replication verified).
- **LongMemEval** (Wu et al., ICLR 2025): the sober evidence: commercial assistants
  drop ~30% accuracy on information recalled across sustained interaction; explicit
  structuring (session decomposition, time-aware retrieval) substantially helps. Its
  "knowledge updates" ability is our "my interests changed" problem.

---

## 3. Tone and style: what is known, and the gap that matters to us

The control side is solved; the inference side is not.

**Solved (verified): producing text at a requested style/complexity.**
- *Generating Scientific Definitions with Controllable Complexity* (August, Reinecke,
  Smith, ACL 2022): defines scientific terms at a controllable complexity level.
- *Generating Summaries with Controllable Readability Levels* (Ribeiro, Bansal,
  Dreyer, EMNLP 2023): instruction, RL, and lookahead techniques hit requested
  reading levels.
- *Paper Plain* (August et al., TOCHI 2023, Ai2): plain-language gists + in-situ
  definitions made medical papers measurably easier to read without accuracy loss.
  Closest published system to our reading view; its complexity support is
  one-size-fits-all, not learned per user.
- Style representation: STEL (Wegmann and Nguyen, EMNLP 2021) for evaluating style
  dimensions like formality and complexity; LUAR (Rivera-Soto et al., EMNLP 2021) for
  cross-domain authorship embeddings. Critical methodological warning from *Same
  Author or Just Same Topic?* (Wegmann, Schraagen, Nguyen, RepL4NLP 2022): **style
  representations trained naively encode topic**, because the same author writes about
  the same topics. Any attempt to infer tone taste from what a reader consumes
  inherits this confound.

**Not solved (verified absence): learning which tone a reader wants from implicit
signals alone.** The research agent's strongest finding, checked from multiple angles:
no verified paper learns formality/jargon/warmth/depth preferences from what a user
reads, dwells on, saves, or asks. Everything verified requires the user's own writing
(LaMP, Pearl, OPPU, HYDRA, DITTO), explicit preference labels (P-RLHF, VPL), or edits
(PRELUDE). Nearest neighbors infer reader *state* (familiarity, comprehension) from
interaction, not tone *preference*. If we learn jargon appetite from which digests get
finished vs abandoned, that combination appears to be unpublished. That cuts both
ways: no recipe to copy, and no evidence it works.

---

## 4. Curiosity: what piques interest

- **Information-gap theory** (Loewenstein 1994, Psychological Bulletin; title/author/
  year/journal verified via multiple secondary sources; exact volume/pages NOT
  independently verified this session): curiosity arises when attention focuses on a
  gap between what one knows and what one wants to know. Our central-question format
  is, in these terms, a manufactured information gap.
- **Curiosity in recommenders**: Abbas and Niu (RecSys 2019 + TKDD) model individual
  differences in curiosity traits (existence and framing verified; mechanism details
  not fetched). **PURS** (Li et al., RecSys 2020): personalized unexpectedness as
  latent-space distance from clusters of a user's past consumption, weighted per user;
  directly the "how adventurous is this reader" knob. **Topic-level Bayesian surprise**
  (Hasan and Bunescu, 2023): serendipity as unexpected AND likely-to-be-liked, with
  Bayesian surprise beating distance heuristics; the most direct computational
  operationalization of the information gap for content selection.
- **Implicit engagement signals in reading interfaces** (the classics, all verified):
  Claypool et al. (IUI 2001): time + scrolling correlate with stated interest, and
  combinations beat any single signal. Fox et al. (TOIS 2005): dwell + scroll + exit
  type predict satisfaction. Yi et al. (RecSys 2014, Yahoo): item-level dwell time as
  a personalization signal, with device normalization. **Kim et al. (WSDM 2014)**: the
  "30 seconds of dwell = satisfied" heuristic is wrong; satisfied-dwell distributions
  vary with page topic, length, and readability, so dwell must be conditioned on the
  content. For us: raw dwell on a dense synthesis is not comparable to dwell on a
  light one.
- **Knowledge tracing** (Corbett and Anderson 1994; Deep Knowledge Tracing, Piech et
  al., NeurIPS 2015): per-skill probabilistic models of what a learner knows, updated
  from interactions. ZPD-based task selection has verified support in education
  (mastery gains from "ready to learn" assignments). **But: no verified paper applies
  knowledge tracing to choosing reading content (papers/articles) in a recommendation
  product.** The familiar-but-novel zone for readers is theorized, not built.

---

## 5. What the collective does not know (honest gaps)

1. **Tone preference from purely implicit signals**: no verified work. (Section 3.)
2. **Knowledge tracing for reading recommendation**: exercise sequencing only; nothing
   verified for picking papers in a reader's learnable zone.
3. **End-to-end systems combining implicit engagement with per-user style-controlled
   generation**: nothing verified. Each half exists; the composition does not.
4. **NL profiles beating embeddings**: verified evidence is parity (plus transparency
   and editability), never superiority.
5. **Long-term preference memory quality**: beyond LongMemEval's 30%-drop finding and
   vendor self-reports, no independent studies of preference (vs fact) retention over
   months.
6. **Semantic Scholar's feed algorithm**: no published description verified.
7. **Style benchmarks measure style by n-gram overlap** (ROUGE/METEOR); no widely
   adopted direct tone-fidelity metric verified.
8. Minor bibliographic holes flagged inline (Loewenstein page numbers, some arXiv
   papers' final venues, ClariCheck details).

---

## 6. What this means for Learning et al.

Mapping the verified literature onto what we have and what we are planning
(`docs/plans/orchestrator-subagents.md`):

1. **Upgrade the dossier toward GUM-style propositions.** Today the dossier is ~300
   words of prose plus embedding centroids. The literature-backed evolution: discrete
   natural-language propositions, each with a confidence (calibrated to be
   *underconfident*), a decay rate, and grounding in the specific ledger events that
   produced it, maintained by retrieve-and-revise rather than periodic rewrite.
   Radlinski's scrutability argument says the reader should be able to see and edit
   them; that is also our best defense against the GUM study's "correct but
   judgmental" failure, and the propositions must describe engagement, never judge
   ability.
2. **Feed it with confidence-weighted implicit signals, conditioned on content.** Hu
   et al. for the framing, Kim et al. (WSDM 2014) for the warning: normalize dwell and
   completion by digest length and density before treating them as preference.
3. **Curiosity is modelable per reader.** PURS-style personalized unexpectedness plus
   topic-level Bayesian surprise give a verified recipe for an "adventurousness" knob
   per reader, and Bridger shows facet-match-plus-contrast works for scholarly
   discovery specifically. This is the literature's answer to "what piques interest":
   surprise relative to *this reader's* consumption clusters, gated by likely quality.
4. **Tone: treat as open research, ship the safe version.** Since implicit-only tone
   learning is unpublished, start with the verified patterns: explicit low-friction
   signals (the familiarity self-ratings we already collect; Scholar Inbox-style
   active elicitation; PRELUDE-style learning from regenerate reasons and Ask-thread
   phrasing, which are edit-like signals, not pure consumption), driving the solved
   control side (complexity-controlled generation). If we later try inferring jargon
   appetite from completion behavior, we are in unpublished territory and should
   instrument it as an experiment, wary of the Wegmann topic-style confound.
5. **Memory hygiene.** LongMemEval says unstructured accumulation degrades; the
   dossier keeper's consolidate-on-rewrite design is right, and needs explicit
   "knowledge update" handling for interest drift (decay is our current answer; the
   GUM's per-proposition decay rates are the refinement).
6. **Poisoning and privacy transfer directly.** Any observation stream (including
   papers we showed the reader) can write false propositions; keep confidence
   thresholds on anything that changes behavior, and keep the model inspectable.
7. **The search connection**: the user model should also steer an agentic retrieval
   lane (facet contrast a la Bridger, personalized unexpectedness a la PURS), not
   only re-rank or restyle downstream. That supersedes part of the old "taste never
   touches search" containment rule; the reconciliation and safeguards live in
   `docs/plans/orchestrator-subagents.md` (taste-aware scout section).

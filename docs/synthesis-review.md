# Synthesis Generation: Critical Review & Research-Backed Improvements

## Part 1: What the Current System Does

The digest pipeline runs in 8+ steps, producing 1-3 items (dynamic: adapts paper:news ratio to candidate quality) with a unifying synthesis.

1. **Interest Selection**: Fetch user interests, decay by 5% (once/day), apply recency penalty using actual paper keywords from last 5 digests. Sample 5 candidates via weighted random.
2. **Working Question**: LLM generates a topic-seeded retrieval question (aim 8 words, hard max 10) plus search queries. This question guides sourcing but is not privileged as the displayed headline.
3. **Paper Search**: Queries use deterministic IDs from the sampled OpenAlex Topic: primary-topic precision for query 1, topic-membership recall for queries 2-3, then subfield and unscoped widening when thin. Semantic Scholar and arXiv remain fallbacks. Papers are deduplicated and citation floor >=2.
4. **Hybrid Scoring**: BM25 + embedding (all-MiniLM-L6-v2) fused via Reciprocal Rank Fusion + quality boosts. Hard floor at 0.12 raw theme similarity. MMR diversity selection (λ=0.6) prevents redundant papers.
4b. **Counter-Query**: LLM generates a counter-query to find papers contradicting/complicating paper 1. Tension hints passed to synthesis.
4c. **LLM Re-Ranking**: Papers scored 1-5 on "tool to think with" quality. Low-scorers can be swapped.
5. **Final Editorial Pass**: LLM reads the kept sources, identifies and audits their shared thread, can drop generic adjacent filler, chooses a cumulative reading order, drafts 3 evidence-led headlines, and selects one. A deterministic gate checks grounding, length, and readability.
6. **Multi-Stage Synthesis**: 4 LLM calls — (A) metadata extraction, (B) skeleton/argument structure, (C) prose draft from skeleton, (D) self-critique and revision.

---

## Part 2: User Complaints (Collected)

| Complaint | Example | Root Cause | Status |
|-----------|---------|------------|--------|
| **Irrelevant papers forced into theme** | "EU AI regulation" paper in a digest about "Can AI understand human needs?" | Scoring lets venue/recency boosts compensate for low theme relevance | **Fixed** — Stage B `skipPapers` + `is_weak_fit` role |
| **Generic dig deeper questions** | "Tell me more about [paper title]" | Prompts were hardcoded, not derived from paper content | **Fixed** — Stage A generates 3 tension-specific questions |
| **Useless skeptic question** | "What would a skeptic say about all this?" | Generic, not grounded in actual disagreements | **Fixed** — questions must reference actual findings |
| **Papers not highlighted in synthesis** | 1 of 3 papers not getting the colored highlight | Matching logic used only title stems | **Fixed** — Stage B assigns `shortName` used in synthesis |
| **Synthesis reads like a book report** | "Paper A found X. Paper B found Y. Paper C found Z." | Single-call generation with no structural planning | **Fixed** — 4-stage pipeline with skeleton + self-refine |
| **Forced connections** | Regulation paper described as answering "understanding human needs" | Prompt didn't have permission to skip papers | **Fixed** — skeleton can skip weak-fit papers |
| **Redundant papers** | "Vision Mamba is fast" + "Faster R-CNN is fast" = same point twice | LLM selection didn't explicitly reject agreeing papers | **Fixed (2026-03-24)** — selection prompt now says "if two papers make the SAME POINT, drop one" |
| **Jargon themes** | "Can better architecture solve computational bottlenecks?" | No explicit anti-jargon rule in hypothesis prompt | **Fixed (2026-03-24)** — hypothesis prompt bans technical jargon, adds dinner table test |
| **Stale papers adding nothing** | 2015 Faster R-CNN in a 2026 digest | Re-ranking didn't penalize old papers | **Fixed (2026-03-24)** — re-ranking scores ≤2 for old papers where newer one covers same ground |

---

## Part 3: Specific Weaknesses

### 3.1 Scoring: Boosts Can Mask Irrelevance

The combined score (`themeSim + recency + venue + institution`) means a paper with 0.13 raw similarity can pass if it's recent (2026, +0.1) and from a good venue (+0.05) = 0.28, above the 0.25 threshold. The 0.12 hard floor helps but is very permissive.

**Research context**: Kotkov et al. (2016) define serendipity as requiring *relevance AND unexpectedness AND novelty* — all three. The current system conflates "high quality paper" (venue, citations) with "relevant to this theme." A Nature paper on an unrelated topic is still irrelevant.

### 3.2 Single-Call Synthesis: No Planning, No Self-Evaluation — FIXED (Stage A-D pipeline)

~~The synthesis is generated in one LLM call with no structural planning and no self-critique.~~ Now uses 4-stage pipeline: metadata → skeleton → draft → self-refine.

### 3.3 No Cross-Document Relation Analysis — FIXED (Stage B skeleton)

~~The prompt says "make an argument" but never asks the model to first identify how the papers relate.~~ Stage B now explicitly identifies relations (agrees/contradicts/extends/alternative_mechanism/unrelated) and plans argument arc before writing.

### 3.4 Paper-Text Embedding is Shallow

Papers are embedded as `title + first 500 chars of abstract`. Many abstracts front-load methodology rather than findings. The embedding captures what the paper *says it does*, not what it *found*. **Partially mitigated** by LLM re-ranking (Step 4b) which evaluates actual contribution quality.

### 3.5 No Coherence Validation — FIXED (Stage D critique)

~~No quality gate on synthesis output.~~ Stage D scores on 4 dimensions (argument, connection, accessibility, specificity) and revises if any < 4.

### 3.6 Explore Slot is Unconstrained — FIXED (LLM complementarity selection)

~~The explore slot uses only a 0.15 similarity threshold.~~ Now replaced by `selectionSkeletonPrompt` which picks papers from a wide MMR pool based on complementarity, not just individual relevance.

### 3.7 Redundant Paper Selection (identified 2026-03-24)

The LLM selection step was not explicitly told to reject papers that agree. Result: two papers making the same point ("X is faster") could both be selected, producing boring digests with no tension. Example: Vision Mamba + Faster R-CNN both saying "better architecture = faster."

**Fixed**: Selection prompt now explicitly says "if two papers make the SAME POINT, drop one." Re-ranking prompt scores ≤2 for redundancy. Old papers (>5 years) must offer something a newer paper doesn't.

### 3.8 Jargon in Themes (identified 2026-03-24)

The hypothesis prompt had no anti-jargon rule. Result: themes like "Can better architecture solve computational bottlenecks?" — technically valid but nobody talks like that.

**Fixed**: Hypothesis prompt now bans technical jargon (computational, architecture, optimization, framework, methodology, paradigm, scalability), adds "dinner table test" — your grandma should understand the question.

---

## Part 4: Research-Backed Improvements

> **Status (2026-03-24):** Priorities 1-4, 6 are **implemented**. Priority 5 is open. See `docs/algorithm.md` Steps 3-6 for current implementation details.

### Priority 1: Self-Refine Loop for Synthesis — IMPLEMENTED (Stage D)

**What**: Generate initial synthesis → LLM critiques it on specific dimensions → LLM revises. Three calls instead of one.

**Evidence**: Madaan et al. (2023) "Self-Refine: Iterative Refinement with Self-Feedback" (NeurIPS 2023) shows ~20% absolute quality improvement across diverse tasks. The key: the critique must be specific ("Does paragraph 2 merely describe Paper B, or does it show how Paper B challenges Paper A?"), not generic ("make it better").

**Cost**: 2 additional LLM calls per digest. At current Gemini Flash pricing, ~$0.002 extra per digest.

**Implementation**: After the synthesis call, add a critique call with prompts targeting: (a) does each paper serve the argument or just appear? (b) is there a genuine tension identified? (c) would removing any paper make the synthesis *better*?

### Priority 2: Skeleton-First Synthesis — IMPLEMENTED (Stage B)

**What**: Before writing prose, LLM produces a structural outline: what's the core tension? What does each paper contribute? What's unresolved?

**Evidence**: "Skeleton of Thought" research shows two-stage generation (outline → expand) produces more organized argumentative text. Tree of Thoughts (Yao et al., 2023, NeurIPS) shows exploring multiple structural framings before committing improves creative output.

**Implementation**: Split the synthesis portion of the prompt into two stages:
1. "Given these papers and theme, produce a JSON outline: `{tension, paper_roles: [{paper, role: 'supports'|'complicates'|'provides_mechanism'|'is_irrelevant'}], unresolved_question}`"
2. "Now write the synthesis paragraph following this outline. Papers marked 'is_irrelevant' should be mentioned briefly or skipped."

### Priority 3: Cross-Document Relation Identification — IMPLEMENTED (Stage B)

**What**: Before synthesis, explicitly identify how papers relate to each other.

**Evidence**: Radev (2000) "Cross-Document Structure Theory" and CAST (2020) both demonstrate that pre-identifying cross-document relations (contradiction, elaboration, agreement, alternative mechanism) produces genuinely argumentative rather than descriptive summaries.

**Implementation**: Add to the prompt: "For each pair of papers, identify in 5 words: agree/contradict/extend/alternative? Return as JSON before writing synthesis."

### Priority 4: Hybrid Scoring (BM25 + Embeddings + RRF) — IMPLEMENTED (Step 3)

**What**: Add BM25 keyword scoring alongside embedding similarity. Combine with Reciprocal Rank Fusion.

**Evidence**: Cormack et al. (2009) "Reciprocal Rank Fusion" (SIGIR) shows consistent improvements when fusing heterogeneous ranking signals. Hybrid BM25+dense retrieval improves nDCG@10 by ~10 points on BEIR benchmarks. The formula `RRF(d) = sum(1/(k + rank_i(d)))` with k=60 sidesteps score compatibility issues.

**Why it matters**: Pure embedding similarity misses keyword-specific matches. A paper about "growth mindset in Turkish teachers" would score low against "Can AI understand human needs?" via embeddings, but BM25 would catch the keyword overlap with the user's interests.

**Implementation**: Add a lightweight BM25 scorer (or TF-IDF) as a second signal. Rank papers by both embedding similarity and BM25 score independently, then fuse with RRF.

### Priority 5: Three-Axis Serendipity Scoring

**What**: Score papers on relevance × novelty × unexpectedness, not just relevance.

**Evidence**:
- Kotkov et al. (2016) "A Survey of Serendipity in Recommender Systems" (Knowledge-Based Systems) — serendipity requires all three axes.
- Zhang et al. (2012) "Auralist" (WSDM) — users preferred serendipitous recommendations even when per-item scores were lower, because the *discovery experience* was valued.
- Kaminskas & Bridge (2017) "Beyond-Accuracy Objectives" (ACM TIIS) — novelty and diversity are necessary but not sufficient; the item must create a "bridge" between known and unknown.

**Implementation**: Score as ~50% relevance / 25% novelty (distance from past 30 days of digests) / 25% unexpectedness (paper's primary domain ≠ user's typical reading domains). This formalizes the existing "explore slot" intuition.

### Priority 6: Quality Gating via Self-Evaluation — IMPLEMENTED (Stage D critique)

**What**: After generating synthesis, score it on SummEval dimensions. Regenerate if coherence < threshold.

**Evidence**: Fabbri et al. (2021) "SummEval" (TACL) defines four orthogonal quality dimensions: coherence, consistency, fluency, relevance. Coherence has the lowest correlation with automatic metrics — meaning it's the dimension most likely to fail silently.

**Implementation**: Post-synthesis, ask the LLM: "Score this synthesis 1-5 on: (a) Does it make an argument, not just summarize? (b) Are all papers necessary to the argument? (c) Would a smart non-expert find this interesting?" If score < 3 on any dimension, regenerate with the critique as input.

---

## Part 5: Recommended Implementation Order

| Phase | Change | Cost | Impact | Status |
|-------|--------|------|--------|--------|
| **Now** | Skeleton-first synthesis | +1 LLM call | High | **DONE** (Stage B) |
| **Now** | Cross-document relations | +0 calls | High | **DONE** (Stage B `paperRelations`) |
| **Soon** | Self-Refine loop | +2 LLM calls | High | **DONE** (Stage D critique + revision) |
| **Soon** | Explore slot quality | 0 | Medium | **DONE** (LLM complementarity selection replaces threshold-only) |
| **Later** | Hybrid BM25 + embedding | Engineering | Medium | **DONE** (BM25 + RRF in Step 3) |
| **Later** | Three-axis serendipity scoring | Engineering | Medium | Open |
| **Later** | Quality gating | +1 LLM call | Medium | **DONE** (Stage D scores 4 dimensions) |

---

## References

1. Radev, D.R. (2000). A common theory of information fusion from multiple text sources step one: Cross-document structure. *Proceedings of the 1st SIGdial Workshop on Discourse and Dialogue.*
2. Li et al. (2023). Contrastive Hierarchical Discourse Graph for Scientific Document Summarization. *Proceedings of CODI, ACL 2023.*
3. Pu et al. (2024). RST-LoRA: A Discourse-Aware Low-Rank Adaptation for Long Document Summarization. *NAACL 2024.*
4. Kotkov, D., Wang, S., & Veijalainen, J. (2016). A survey of serendipity in recommender systems. *Knowledge-Based Systems, 111*, 180-192.
5. Zhang, Y.C., Seaghdha, D.O., Quercia, D., & Jambor, T. (2012). Auralist: Introducing serendipity into music recommendation. *WSDM 2012*, 13-22.
6. Kaminskas, M., & Bridge, D. (2017). Diversity, serendipity, novelty, and coverage. *ACM TIIS, 7*(1), 1-42.
7. Cormack, G.V., Clarke, C.L.A., & Buettcher, S. (2009). Reciprocal rank fusion outperforms condorcet and individual rank learning methods. *SIGIR 2009*, 758-759.
8. Fabbri, A.R. et al. (2021). SummEval: Re-evaluating summarization evaluation. *TACL, 9*, 391-409.
9. Wei, J. et al. (2022). Chain-of-thought prompting elicits reasoning in large language models. *NeurIPS 2022.*
10. Madaan, A. et al. (2023). Self-Refine: Iterative refinement with self-feedback. *NeurIPS 2023.*
11. Yao, S. et al. (2023). Tree of Thoughts: Deliberate problem solving with large language models. *NeurIPS 2023.*
12. Star, S.L. & Griesemer, J.R. (1989). Institutional ecology, translations and boundary objects. *Social Studies of Science, 19*(3), 387-420.
13. CAST (2020). A Cross-Article Structure Theory for Multi-Article Summarization.
14. SerenCDR (2024). A Deep Learning Model for Cross-Domain Serendipity Recommendations. *ACM Transactions on Recommender Systems.*

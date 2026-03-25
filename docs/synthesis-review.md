# Synthesis Generation: Critical Review & Research-Backed Improvements

## Part 1: What the Current System Does

The digest pipeline runs in 8+ steps, producing 1-3 items (dynamic: adapts paper:news ratio to candidate quality) with a unifying synthesis.

1. **Interest Selection**: Fetch user interests, decay by 5% (once/day), apply recency penalty using actual paper keywords from last 5 digests. Sample 5 candidates via weighted random.
2. **Central Question**: LLM generates a "wow factor" theme (max 8 words, enforced with retry). Trending headlines injected for temporal awareness. Theme novelty checked against recent themes (>0.7 similarity triggers re-generation).
3. **Paper Search**: Queries distributed across `focusFields[]` (cross-domain support) via OpenAlex → Semantic Scholar → arXiv. Papers deduplicated, seen-in-last-30-days excluded. Citation floor >=2.
4. **Hybrid Scoring**: BM25 + embedding (all-MiniLM-L6-v2) fused via Reciprocal Rank Fusion + quality boosts. Hard floor at 0.12 raw theme similarity. MMR diversity selection (λ=0.6) prevents redundant papers.
4b. **Counter-Query**: LLM generates a counter-query to find papers contradicting/complicating paper 1. Tension hints passed to synthesis.
4c. **LLM Re-Ranking**: Papers scored 1-5 on "tool to think with" quality. Low-scorers can be swapped.
5. **Theme Revision**: LLM revises the central question with 600 chars of abstract context per paper.
6. **Multi-Stage Synthesis**: 4 LLM calls — (A) metadata extraction, (B) skeleton/argument structure, (C) prose draft from skeleton, (D) self-critique and revision.

---

## Part 2: User Complaints (Collected)

| Complaint | Example | Root Cause |
|-----------|---------|------------|
| **Irrelevant papers forced into theme** | "EU AI regulation" paper in a digest about "Can AI understand human needs?" | Scoring lets venue/recency boosts compensate for low theme relevance. Synthesis prompt forces all papers into the narrative. |
| **Generic dig deeper questions** | "Tell me more about [paper title]" | Prompts were hardcoded, not derived from paper content or theme tension. |
| **Useless skeptic question** | "What would a skeptic say about all this?" | Generic, not grounded in actual disagreements between papers. |
| **Papers not highlighted in synthesis** | 1 of 3 papers not getting the colored highlight treatment | Matching logic used only title stems. Conversational nicknames like "Turkish teacher research" don't overlap with academic titles. |
| **Synthesis reads like a book report** | "Paper A found X. Paper B found Y. Paper C found Z." | Single-call generation with no structural planning. Prompt says "argue" but doesn't enforce it structurally. |
| **Forced connections** | Regulation paper described as answering "understanding human needs" | Prompt didn't have permission to skip papers. All 3 must be woven in. |

---

## Part 3: Specific Weaknesses

### 3.1 Scoring: Boosts Can Mask Irrelevance

The combined score (`themeSim + recency + venue + institution`) means a paper with 0.13 raw similarity can pass if it's recent (2026, +0.1) and from a good venue (+0.05) = 0.28, above the 0.25 threshold. The 0.12 hard floor helps but is very permissive.

**Research context**: Kotkov et al. (2016) define serendipity as requiring *relevance AND unexpectedness AND novelty* — all three. The current system conflates "high quality paper" (venue, citations) with "relevant to this theme." A Nature paper on an unrelated topic is still irrelevant.

### 3.2 Single-Call Synthesis: No Planning, No Self-Evaluation

The synthesis is generated in one LLM call with no structural planning and no self-critique. The prompt is 130 lines of rules, examples, and constraints — cognitive overload for the model. Research shows this degrades output quality.

**Research context**: Madaan et al. (2023) "Self-Refine" shows ~20% quality improvement from a generate→critique→revise loop. Yao et al. (2023) "Tree of Thoughts" shows that generating a structural outline first dramatically improves coherence in creative writing tasks.

### 3.3 No Cross-Document Relation Analysis

The prompt says "make an argument" but never asks the model to first identify *how the papers relate to each other*. Do they agree? Contradict? Extend? Without this analysis step, the model defaults to sequential summary.

**Research context**: Radev (2000) "Cross-Document Structure Theory" identifies 24 relationship types between documents. The CAST framework (2020) extends this to multi-article scientific summarization. Both show that explicitly identifying relations before writing produces genuinely argumentative synthesis.

### 3.4 Paper-Text Embedding is Shallow

Papers are embedded as `title + first 500 chars of abstract`. Many abstracts front-load methodology ("In this paper, we investigate...") rather than findings. The embedding captures what the paper *says it does*, not what it *found*.

### 3.5 No Coherence Validation

There's no quality gate on the synthesis output. If the model produces a book report, it gets published. SummEval (Fabbri et al., 2021) identifies coherence as the hardest quality to achieve and the most poorly correlated with automatic metrics.

### 3.6 Explore Slot is Unconstrained

The "explore" paper slot uses an adjacent interest + theme query, but only requires 0.15 similarity (the fallback threshold). This is where irrelevant papers sneak in — designed for serendipity but without the relevance guard that serendipity research requires.

---

## Part 4: Research-Backed Improvements

### Priority 1: Self-Refine Loop for Synthesis

**What**: Generate initial synthesis → LLM critiques it on specific dimensions → LLM revises. Three calls instead of one.

**Evidence**: Madaan et al. (2023) "Self-Refine: Iterative Refinement with Self-Feedback" (NeurIPS 2023) shows ~20% absolute quality improvement across diverse tasks. The key: the critique must be specific ("Does paragraph 2 merely describe Paper B, or does it show how Paper B challenges Paper A?"), not generic ("make it better").

**Cost**: 2 additional LLM calls per digest. At current Gemini Flash pricing, ~$0.002 extra per digest.

**Implementation**: After the synthesis call, add a critique call with prompts targeting: (a) does each paper serve the argument or just appear? (b) is there a genuine tension identified? (c) would removing any paper make the synthesis *better*?

### Priority 2: Skeleton-First Synthesis (Structural Planning)

**What**: Before writing prose, LLM produces a structural outline: what's the core tension? What does each paper contribute? What's unresolved?

**Evidence**: "Skeleton of Thought" research shows two-stage generation (outline → expand) produces more organized argumentative text. Tree of Thoughts (Yao et al., 2023, NeurIPS) shows exploring multiple structural framings before committing improves creative output.

**Implementation**: Split the synthesis portion of the prompt into two stages:
1. "Given these papers and theme, produce a JSON outline: `{tension, paper_roles: [{paper, role: 'supports'|'complicates'|'provides_mechanism'|'is_irrelevant'}], unresolved_question}`"
2. "Now write the synthesis paragraph following this outline. Papers marked 'is_irrelevant' should be mentioned briefly or skipped."

### Priority 3: Cross-Document Relation Identification

**What**: Before synthesis, explicitly identify how papers relate to each other.

**Evidence**: Radev (2000) "Cross-Document Structure Theory" and CAST (2020) both demonstrate that pre-identifying cross-document relations (contradiction, elaboration, agreement, alternative mechanism) produces genuinely argumentative rather than descriptive summaries.

**Implementation**: Add to the prompt: "For each pair of papers, identify in 5 words: agree/contradict/extend/alternative? Return as JSON before writing synthesis."

### Priority 4: Hybrid Scoring (BM25 + Embeddings + RRF)

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

### Priority 6: Quality Gating via Self-Evaluation

**What**: After generating synthesis, score it on SummEval dimensions. Regenerate if coherence < threshold.

**Evidence**: Fabbri et al. (2021) "SummEval" (TACL) defines four orthogonal quality dimensions: coherence, consistency, fluency, relevance. Coherence has the lowest correlation with automatic metrics — meaning it's the dimension most likely to fail silently.

**Implementation**: Post-synthesis, ask the LLM: "Score this synthesis 1-5 on: (a) Does it make an argument, not just summarize? (b) Are all papers necessary to the argument? (c) Would a smart non-expert find this interesting?" If score < 3 on any dimension, regenerate with the critique as input.

---

## Part 5: Recommended Implementation Order

| Phase | Change | Cost | Impact |
|-------|--------|------|--------|
| **Now** | Skeleton-first synthesis (split into outline + prose) | +1 LLM call | High — structural planning prevents book reports |
| **Now** | Cross-document relations in prompt | +0 calls (prompt change) | High — forces the model to find tension |
| **Soon** | Self-Refine loop (critique + revise) | +2 LLM calls | High — catches and fixes weak output |
| **Soon** | Raise explore slot threshold to match main threshold | 0 | Medium — prevents irrelevant "serendipity" |
| **Later** | Hybrid BM25 + embedding scoring | Engineering effort | Medium — better paper retrieval |
| **Later** | Three-axis serendipity scoring | Engineering effort | Medium — better discovery experience |
| **Later** | Quality gating | +1 LLM call | Medium — safety net for bad syntheses |

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

# Cross-provider judge: is it worth it?

*Written 2026-09-01, after the move from Gemini-Flash-everything to Opus 5 (strong tier) + Haiku 4.5 (judge tier). Question on the table: should `judgeConfigFrom()` learn to run the judge tier on a different provider (Gemini Flash, GLM, etc.) than the strong tier?*

**Verdict: not now.** The one real argument for it (judge-family independence) applies to a minority of the judge calls, the money and speed arguments are near zero, and the biggest tradeoff is one nobody names when they say "judge": half of what the judge tier produces is reader-facing copy, and moving it cross-provider splits the product's voice across two model families. Details and revisit-triggers below; an implementation sketch is included in case the triggers fire.

## What the "judge tier" actually is

"Judge" undersells it. The seven judge-tier calls split into two different jobs:

| Call | Job | Does a reader ever see its words? |
|---|---|---|
| Cold read, Step 1 candidates | verdict | No (gates which headline ships) |
| Cold read, Step 5 candidates (+ repair re-read) | verdict | No |
| Step 4b re-rank | verdict | No (can drop/swap papers) |
| Foundational gate | verdict + one line of copy | **Yes**: `foundationalReason` is the gold card's Significance line |
| Stage A metadata | **copywriting** | **Yes**: plainName, summary, takeaway hook/stat/line, method tiles, keyConcept definitions, suggested questions. Most of the words on every card. |
| Gist | **copywriting** | **Yes**: the answer line under the headline |

So a naive cross-provider judge puts a second model family in charge of most of the visible words on the page while Opus writes the synthesis between them. That is the voice-consistency tradeoff, and it is the strongest argument against, stronger than cost or reliability.

## The tradeoffs, one by one

### Cost: negligible either way

Judge tier per digest is roughly 10.4k input / 1.5k output tokens (from the AI-call table in `algorithm.md`):

| Judge model | Per digest | Per daily reader / month |
|---|---|---|
| Haiku 4.5 ($1 / $5 per MTok) | ~$0.018 | ~$0.55 |
| Gemini 2.5 Flash ($0.30 / $2.50) | ~$0.007 | ~$0.21 |
| Gemini 2.5 Flash-Lite ($0.10 / $0.40) | ~$0.002 | ~$0.05 |
| GLM-5.3 ($1.40 / $4.40) | ~$0.021 | ~$0.63 |

The cross-provider patch saves about a dime per reader per month against Haiku. The strong tier is where the money is (~$0.17/digest on Opus); the lever that actually moves the bill is Sonnet vs Opus there, not the judge.

### Speed: not the bottleneck

Flash and Haiku are the same latency class (both sub-second time-to-first-token; Flash somewhat higher raw throughput, ~200 tok/s). Judge outputs are 60-600 tokens, so the per-call difference is a second or two, and the judge calls mostly run concurrently with or between the strong-tier calls that dominate wall clock (Opus synthesis, critique, selection). If generation feels slow, the fix is `AI_MODEL_DIGEST=claude-sonnet-5`, not a faster judge. Also remember the one place Flash speed was a lie: thinking tokens share its output budget, which is what truncated Stage A and blanked the cards on Aug 24/26/31.

### Quality of writing: the real cost of going cross-provider

Stage A, the gist, and the foundationalReason are copy, not verdicts. Whatever model runs them writes in its own register, defines keyConcepts in its own idiom, and lands the takeaway lines with its own sense of humor. Keeping them in the Anthropic family (Haiku is trained to the same voice guidelines as Opus) keeps one voice on the page. This is also why "just move the cheap stuff to Flash-Lite" is a trap: the cheap stuff is the copy.

### LLM-as-judge quality and bias: the one honest argument FOR

Two findings from the literature matter here:

1. **Self-preference bias is real and causal.** LLM evaluators recognize their own generations and score them higher; the effect correlates linearly with self-recognition accuracy ([Panickssery et al., NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf); [Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/pdf/2410.21819)). Our cold reader judges Opus-written headlines. Haiku is not Opus, but it is the same family, so some leniency toward the house style is plausible. A cross-family judge (Flash reading Opus's headlines) is the standard mitigation.
2. **Small judges are close to frontier judges on rubric work.** Sub-frontier judges hold a small agreement gap to frontier judges on subjective rubrics, which is why cascade patterns (cheap judge on every item, frontier on disagreements) are the production norm ([survey](https://futureagi.com/blog/best-llm-judge-models-2026/), [reliability overview](https://www.adaline.ai/blog/llm-as-a-judge-reliability-bias)). Translation for us: Haiku is a fine judge; a bigger judge would not buy much.

But look at where the bias argument actually lands in this pipeline. Only the cold reads evaluate the strong model's own writing, they are criterial rather than preferential (unknownTerms, wouldWonder, non-empty stakes: mostly checkable properties, not "which do you prefer"), and every one of them is backstopped by deterministic gates (`themeProblems`, the word ceiling, acronym and placeholder checks). The re-rank and foundational gate judge third-party papers, where self-preference does not apply. So the exposure is one call family, partially fenced already.

**We can also measure it before building anything.** `digests.theme_candidates` already persists every cold-read verdict. If Haiku-as-judge is rubber-stamping, it shows up as interest-score inflation and near-zero objection rates compared with the Flash-judge era rows. That query costs an afternoon; the patch costs a dependency.

**Where same-family evaluation actually bites, and it is not the judge tier.** The most self-preferential call in the pipeline is Stage D: the *strong* model critiques and fact-checks its own synthesis draft (`synthesisCritiquePrompt` runs on `aiConfig`, not `judge`). Opus grading Opus's paragraph is exactly the own-generation case the bias literature measures, and it is worse than Haiku reading Opus's headline, which is at least a different model with deterministic backstops. There is also a correlated-chain subtlety: Stage A (Haiku) extracts the findings that Stage D (Opus) checks the draft against, so a shared-family misreading of an abstract can pass through both. If an independent cross-family pass is ever added, the right slot is the Stage D critique / fact-check, not the verdict calls: a cheap foreign model (Gemini Flash class) reading "does this draft misstate these findings" is the classic cascade-pattern use of a second family. That would be its own small patch (a `factCheckConfig`), separate from and more valuable than a cross-provider judge tier.

**Update, same day: this got built.** `factCheckConfig()` in `provider.ts` + `independentFactCheckPrompt` + the Stage D merge shipped on 2026-09-01: set `FACTCHECK_AI_PROVIDER=gemini`, `FACTCHECK_AI_KEY=<the old Gemini key>` (optionally `FACTCHECK_AI_MODEL`, default `gemini-2.5-flash`) and a cross-family pass reads every finished draft against the raw abstracts, feeding the existing revision. The cross-provider *judge tier* remains unbuilt, per the verdict below.

### GLM-5.3 specifically: wrong shape for the slot

GLM-5.3 is Z.ai's flagship, tuned for coding and long-horizon agent work, priced at [$1.40 / $4.40 per MTok](https://openrouter.ai/z-ai/glm-5.3), which is *more* than Haiku on input. It is reachable today with zero code (`CRON_AI_PROVIDER=other` + `CRON_AI_BASE_URL` at Z.ai's OpenAI-compatible endpoint) but only for the whole pipeline. As a judge it is a flagship doing intern work at above-intern rates; as a strong tier it would hand the product's literary English prose to a coding-tuned model. Neither slot fits. If raw cheapness ever becomes the goal, Flash-Lite ($0.10 / $0.40) is the actual bottom, not GLM.

### Reliability and ops

A second provider means a second key to rotate, a second failure domain (a Gemini quota incident now breaks half the pipeline of a "Claude" deployment), a second set of quirks (the thinking/max_tokens truncation class), and a consistency-validation burden the single-provider design exists to avoid (the CLAUDE.md provider/model/key gotcha). None of this is fatal; all of it is cost carried every day for a benefit collected rarely.

## Decision: revisit triggers

Build the patch only when one of these is observed, not predicted:

1. **Measured cold-read leniency**: the theme_candidates query above shows Haiku objecting materially less than Flash did at equal headline quality.
2. **Judge spend matters**: user count grows to where ~$0.35/reader/month of judge savings is real money, and Sonnet-for-strong has already been taken.
3. **A same-family failure mode**: a bias or blind spot that provably needs a cross-family check, per the cascade pattern in the LLMJ literature.

## Implementation sketch (if a trigger fires)

Scope it to the verdict calls only; the copy calls stay on the primary provider.

- **Config**: `AI_JUDGE_PROVIDER`, `AI_JUDGE_KEY`, optional `AI_JUDGE_BASE_URL`, activating only when provider+key are both set (model stays `AI_MODEL_DIGEST_JUDGE`). Unset = today's behavior, provably unchanged.
- **Split the tier in `provider.ts`**: `verdictConfigFrom(cfg)` (cold reads, Step 4b re-rank, foundational gate) may go cross-provider; `copyConfigFrom(cfg)` (Stage A, gist, and the foundationalReason if we split the gate's verdict from its sentence) always stays on the run's provider. `judgeConfigFrom` becomes these two.
- **Failure fallback**: any cross-provider call error retries once on the run's own config; a foreign provider outage must never block a digest.
- **BYOK unaffected**: the judge override only applies to the cron config path, never to a user-supplied key.
- **Docs**: CLAUDE.md env list, `algorithm.md` tier table, `.env.example`.

Estimated effort: 1-2 hours plus a test digest per provider pair.

## Sources

- [Panickssery et al., "LLM Evaluators Recognize and Favor Their Own Generations" (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf)
- [Wataoka et al., "Self-Preference Bias in LLM-as-a-Judge"](https://arxiv.org/pdf/2410.21819)
- [Quantifying and Mitigating Self-Preference Bias of LLM Judges](https://arxiv.org/html/2604.22891v4)
- [Best LLM Judge Models in 2026](https://futureagi.com/blog/best-llm-judge-models-2026/) and [LLM-as-a-Judge reliability and bias](https://www.adaline.ai/blog/llm-as-a-judge-reliability-bias)
- [Gemini 2.5 Flash pricing](https://devtk.ai/en/models/gemini-2-5-flash/), [Gemini API pricing overview](https://www.cloudzero.com/blog/gemini-pricing/)
- [GLM-5.3 pricing and positioning (OpenRouter)](https://openrouter.ai/z-ai/glm-5.3), [VentureBeat on the GLM-5.3 API](https://venturebeat.com/technology/glm-5-3-hits-the-api-at-1-4-4-4-per-million-tokens)
- [Artificial Analysis: Haiku 4.5 vs Gemini 2.5 Flash](https://artificialanalysis.ai/models/comparisons/claude-4-5-haiku-vs-gemini-2-5-flash)

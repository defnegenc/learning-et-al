import assert from "node:assert/strict";
import test from "node:test";
import { dedupeKeyConcepts, metadataItemProblems, modelMetaTalkIn, themeQuestionProblems } from "./output-guards.ts";
import { overclaimProblems } from "./output-guards.ts";
import { readFileSync } from "node:fs";

test("accepts direct questions and setup-plus-question headlines", () => {
  assert.deepEqual(themeQuestionProblems("Who's liable when a government AI agent fails?"), []);
  assert.deepEqual(themeQuestionProblems("Isn’t this evidence strong enough?"), []);
  assert.deepEqual(themeQuestionProblems("Virtual classrooms feel real. Does that help?"), []);
});

test("rejects statements and statements disguised with punctuation", () => {
  assert.ok(themeQuestionProblems("Your habit tracker knows the what, not the why").length > 0);
  assert.ok(themeQuestionProblems("Fake reviews now outnumber real ones?").length > 0);
});

test("detects model self-commentary without flagging evidence limits", () => {
  assert.ok(modelMetaTalkIn("The reasoning can be (sorry, can't say that) off.").length > 0);
  assert.ok(modelMetaTalkIn("As an AI, I cannot provide that phrase.").length > 0);
  assert.ok(modelMetaTalkIn("I'm sorry, but I can't use that wording.").length > 0);
  assert.ok(modelMetaTalkIn("I can’t mention that phrase.").length > 0);
  assert.ok(modelMetaTalkIn("I must avoid that phrase. [REDACTED]").length > 0);
  assert.deepEqual(modelMetaTalkIn("The evidence cannot say why the effect disappeared."), []);
  assert.deepEqual(modelMetaTalkIn("The study compares how schools define prohibited terms."), []);
});
test("rejects the empty metadata fallback before a raw abstract can publish", () => {
  assert.ok(metadataItemProblems({ index: 1, summary: "", keywords: [], findings: [] }, 1).length > 0);
  assert.deepEqual(metadataItemProblems({
    index: 1,
    plainName: "The detector review",
    summary: "A review found that writing detectors still make consequential mistakes.",
    keywords: ["writing detectors"],
    findings: ["Most tools remained unreliable."],
    connectionToTheme: "tests whether deployed detectors work",
    takeaway: { hook: "Paid tools still make mistakes.", line: "A detector score is not proof." },
    methodType: "Literature review",
    claim: "Writing detectors should not be trusted on their own.",
  }, 1), []);
});

test("dedupeKeyConcepts drops repeat terms regardless of case or reworded definitions", () => {
  const concepts = [
    "large language models: AI systems trained on massive amounts of text.",
    "natural language processing: getting computers to work with human language.",
    "Large Language Models: AI systems trained on huge amounts of text that power chatbots.",
    "digitization: scanning paper documents into searchable digital files.",
    "Digitization: converting printed books into computer text",
    "metadata: extra descriptive information attached to a record.",
    "catalogue metadata: the descriptive details archivists record about an item.",
  ];
  assert.deepEqual(dedupeKeyConcepts(concepts), [
    "large language models: AI systems trained on massive amounts of text.",
    "natural language processing: getting computers to work with human language.",
    "digitization: scanning paper documents into searchable digital files.",
    "metadata: extra descriptive information attached to a record.",
    "catalogue metadata: the descriptive details archivists record about an item.",
  ]);
});

test("dedupeKeyConcepts handles missing colons, blank terms, and trailing punctuation", () => {
  assert.deepEqual(dedupeKeyConcepts([]), []);
  assert.deepEqual(dedupeKeyConcepts([": no term here", "corpus", "Corpus.", "  corpus  : a text collection"]), [
    "corpus",
  ]);
});
test("overclaimProblems flags the modal upgrades that reached published editions", () => {
  // Sep 19 digest opener and gist: a proposed application written as achieved intent.
  assert.ok(overclaimProblems("and that single change made the combo dissolve slower and hold onto its release, exactly as designed.").length > 0);
  assert.ok(overclaimProblems("Yes: fusing a TB drug and a nephrosis drug into one crystal shape made the combo dissolve slower, exactly as designed.").length > 0);
  // Sep 18 takeawayStat: an exit wave the abstract credits with facilitating uptake, framed as proof.
  assert.ok(overclaimProblems("Early founder-controlled tech firms went public between 2010 and 2014, a proof of concept for dual-class founder control.").length > 0);
  // The corrected replacements must pass.
  assert.deepEqual(overclaimProblems("and that single change slowed and lowered the nephrosis drug's release compared to the plain drug alone, a lab result that points to a possible sustained-release use, not a proven one."), []);
  assert.deepEqual(overclaimProblems("You can slow a drug's release by fusing it with a second drug into one brand-new crystal, a dual-drug ternary salt cocrystal."), []);
  assert.deepEqual(overclaimProblems("Early founder-controlled tech firms exited between 2010 and 2014, and their success helped dual-class founder control catch on."), []);
});

test("every claim-writing prompt carries the shared evidence-fidelity rules", () => {
  // Anti-drift regression: rule blocks hand-copied across prompts have drifted
  // before (see the synthesisStructureContract comment). Sep 17-19 failures all
  // trace to claims these prompts write or rewrite, so each must interpolate
  // the shared EVIDENCE_RULES constant rather than a partial copy.
  const source = readFileSync(new URL("./prompts.ts", import.meta.url), "utf8");
  const builders = ["metadataPrompt", "synthesisFromSkeletonPrompt", "synthesisCritiquePrompt", "synthesisRevisionPrompt"];
  for (const name of builders) {
    const start = source.indexOf(`export function ${name}`);
    assert.notEqual(start, -1, `${name} is missing from prompts.ts`);
    const rest = source.slice(start);
    const next = rest.slice(1).search(/\nexport (?:function|const) /);
    const body = next === -1 ? rest : rest.slice(0, next + 1);
    assert.ok(body.includes("EVIDENCE_RULES"), `${name} does not carry EVIDENCE_RULES`);
  }
});
test("overclaimProblems flags the Sep 20 epistemic-overreach phrasings", () => {
  // Sep 20 digest: missing reporting rewritten as intentional concealment.
  assert.ok(overclaimProblems("The paper hid the math behind its headline result.").length > 0);
  // Sep 20 digest: nondisclosed deviations rewritten as deliberate secret changes.
  assert.ok(overclaimProblems("The authors changed criteria without telling anyone.").length > 0);
  // Sep 20 digest: an evidentiary absence the supplied abstract never asserted.
  assert.ok(overclaimProblems("The therapy still lacks proof that it works.").length > 0);
  assert.ok(overclaimProblems("Existing study designs are too limited to prove efficacy.").length > 0);
  // Neutral statements of absence must pass: a gap is a gap, not an accusation.
  assert.deepEqual(overclaimProblems("The paper does not report the underlying statistics."), []);
  assert.deepEqual(overclaimProblems("The abstract does not say whether the protocol deviated from the preregistration."), []);
  assert.deepEqual(overclaimProblems("The abstract does not address whether the evidence is sufficient."), []);
});

test("the critique prompt keeps the THIRD-check failure classes that carry Sep 20 defects 3 and 5", () => {
  // Sep 20 defects that no deterministic guard can decide: a "Can we trust
  // claims? No" verdict that widens a finding past its stated source boundary,
  // and a synthesis conflating meta-analysis transparency with
  // intervention-evidence maturity. Both are subject/scope-level judgments the
  // critique pass owns via its THIRD check. Lock that check's three failure
  // classes so a future prompt edit cannot silently drop them.
  const source = readFileSync(new URL("./prompts.ts", import.meta.url), "utf8");
  for (const cls of ["SUBJECT WIDENING", "MODAL UPGRADE", "UNMEASURED INFERENCE"]) {
    assert.ok(source.includes(cls), `critique THIRD check lost the ${cls} class`);
  }
  // The gist prompt (inline in digest.ts) must keep its measured-subject
  // guard: the "No" verdict defect shipped through the gist/opener path.
  const digestSource = readFileSync(new URL("../pipeline/digest.ts", import.meta.url), "utf8");
  assert.ok(
    digestSource.includes("Keep the synthesis's measured subject and confidence level"),
    "gist prompt lost the measured-subject and confidence-level guard"
  );
});

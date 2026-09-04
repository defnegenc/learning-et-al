import assert from "node:assert/strict";
import test from "node:test";
import { dedupeKeyConcepts, metadataItemProblems, modelMetaTalkIn, themeQuestionProblems } from "./output-guards.ts";

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

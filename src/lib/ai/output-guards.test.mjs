import assert from "node:assert/strict";
import test from "node:test";
import { modelMetaTalkIn, themeQuestionProblems } from "./output-guards.ts";

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

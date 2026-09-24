import assert from "node:assert/strict";
import test from "node:test";
import { GOOGLE_NEWS_MAX_AGE_DAYS, isFreshGoogleNewsDate, isHeadlineOnlyAbstract } from "./rss.ts";

const NOW = Date.parse("2026-09-24T12:00:00Z");

test("Google News freshness: missing or unparseable dates are rejected, not waved through", () => {
  // The Sep 24 repro: an Oct 2024 item reached the news slot because no date
  // was checked. Unlike the Serper path, Google News always carries pubDate,
  // so a missing date means something is wrong - reject.
  assert.equal(isFreshGoogleNewsDate(undefined, NOW), false);
  assert.equal(isFreshGoogleNewsDate("", NOW), false);
  assert.equal(isFreshGoogleNewsDate("not a date", NOW), false);
});

test("Google News freshness: items older than the window are rejected", () => {
  assert.equal(isFreshGoogleNewsDate("2024-10-08T00:00:00Z", NOW), false); // the Sep 24 repro
  const edge = NOW - (GOOGLE_NEWS_MAX_AGE_DAYS + 1) * 864e5;
  assert.equal(isFreshGoogleNewsDate(new Date(edge).toISOString(), NOW), false);
});

test("Google News freshness: recent items pass", () => {
  assert.equal(isFreshGoogleNewsDate("2026-09-23T08:00:00Z", NOW), true);
  const inside = NOW - (GOOGLE_NEWS_MAX_AGE_DAYS - 1) * 864e5;
  assert.equal(isFreshGoogleNewsDate(new Date(inside).toISOString(), NOW), true);
});

test("headline-only detection: title restated as abstract, with or without outlet suffix", () => {
  assert.equal(isHeadlineOnlyAbstract(
    "Curtains could fall for some interior designers",
    "Curtains could fall for some interior designers - Michigan Capitol Confidential",
  ), true);
  assert.equal(isHeadlineOnlyAbstract(
    "Curtains could fall for some interior designers",
    "",
  ), true);
  assert.equal(isHeadlineOnlyAbstract(
    "Curtains could fall for some interior designers",
    "Curtains could fall for some interior designers",
  ), true);
});

test("headline-only detection: a real summary is not headline-only", () => {
  assert.equal(isHeadlineOnlyAbstract(
    "Curtains could fall for some interior designers",
    "Michigan House Bill 5960 would require interior designers to hold a state license, and trade groups are split on whether the rule protects consumers or shuts out independents.",
  ), false);
});

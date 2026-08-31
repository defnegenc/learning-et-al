"use client";

import { useState } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import {
  ReadingPaperDetail,
  type Companion,
  type HomeworkItem,
  type ReadingFixture,
} from "@/components/vault/reading-paper-detail";
import {
  BODY_SM, BODY_STYLE, DIM, DISPLAY_LG, MUTED, NavTab, PageHeader,
} from "@/components/design-system";

/*
 * The reading list, with data — /prototype/reading-list.
 *
 * The real shelf and the real reading view, rendered against samples. It exists
 * because the two surfaces are unreviewable otherwise: the shelf needs a
 * signed-in account with bookmarks, and the reading view needs a companion that
 * only exists after a model has read a PDF. Everything here is the production
 * component — `PaperCard` compact and `ReadingPaperDetail` — handed a
 * `ReadingFixture` instead of four fetches.
 *
 * Three papers, chosen to cover the states that actually differ:
 *  · one with the full companion, a thread already in it, and citing work;
 *  · one still in prep, so the shelf shows "Reading it for you…" and the card
 *    has no preview line to sit on;
 *  · one foundational, to check the gold frame survives a preview line, with a
 *    companion that has no caveats and nothing citing it yet.
 */

/* ── The shelf ───────────────────────────────────────────────────────────── */

const PAPERS: PaperItem[] = [
  {
    id: "p1",
    title: "Sleep restriction and the consolidation of motor skill memory",
    plainName: "Losing sleep after practice",
    summary: null,
    source: "semantic_scholar",
    sourceUrl: "https://example.com/sleep-motor",
    keywords: ["sleep", "motor learning", "consolidation"],
    authors: ["Marta Villanueva", "Kenji Ito", "Ruth Oyelaran"],
    year: 2025,
    category: "recent",
    digestTheme: "Does practice count if you don't sleep?",
    companionRemember:
      "Practice writes the skill; sleep is what files it. Cut the night after a session and you keep the day's gain but lose most of the overnight one.",
  },
  {
    id: "p2",
    title: "Attentional cost of intermittent notification in sustained reading tasks",
    plainName: "What a buzz costs you",
    summary: null,
    source: "arxiv",
    sourceUrl: "https://example.com/notifications",
    keywords: ["attention", "interruption", "reading"],
    authors: ["Priya Raghunathan", "Tom Beckett"],
    year: 2026,
    category: "recent",
    digestTheme: "Does practice count if you don't sleep?",
    // No preview line — prep is still running. This is the state a paper is in
    // for the first minute or two after it's bookmarked.
    companionRemember: null,
  },
  {
    id: "p3",
    title: "The magical number seven, plus or minus two: some limits on our capacity for processing information",
    plainName: "Seven things at once",
    summary: null,
    source: "semantic_scholar",
    sourceUrl: "https://example.com/miller-1956",
    keywords: ["working memory", "chunking"],
    authors: ["George A. Miller"],
    year: 1956,
    category: "foundational",
    foundationalReason:
      "It gave the field a number to argue with for seventy years, and nearly every later model of working memory is a reply to it.",
    digestTheme: "Does practice count if you don't sleep?",
    companionRemember:
      "The limit isn't seven items, it's seven chunks — and how much a chunk holds is the part you can actually train.",
  },
];

/* ── The companions ──────────────────────────────────────────────────────── */

const COMPANIONS: Record<string, Companion> = {
  p1: {
    gist:
      "If you practise a movement and then sleep normally, you wake up better at it than when you stopped — the gain arrives without any further practice. This study cut that night short to find out whether the improvement is built by the practice or by the sleep. It is built by the sleep, and the part that gets lost is not recoverable by sleeping in the following night.",
    did:
      "Fifty-two adults learned a finger-tapping sequence to a fixed criterion in the evening. Half were sent home to sleep normally; half were held to four hours in the lab, woken at the same clock time, and both groups were retested at 24 and 72 hours. A third group practised in the morning and was retested after an equal amount of waking time, which separates the effect of sleep from the effect of twelve hours passing.",
    found:
      "The rested group improved 19% overnight with no further practice. The restricted group improved 4% — statistically indistinguishable from the wake group's 3%. A second, full night of sleep did not recover the missing gain: at 72 hours the restricted group was still 13 points behind. Slow-wave sleep in the first two hours predicted the size of the gain better than total sleep time did, which is why four hours was not simply half as good.",
    caveats:
      "Fifty-two people is small for a three-arm design, and one night of restriction is not the chronic pattern most people actually live in. Everyone was 19 to 26, and slow-wave sleep declines steeply with age, so the effect size here is probably a ceiling rather than an average. Finger tapping is also the friendliest possible motor task — nothing here says a surgical or musical skill behaves the same way.",
    remember:
      "Practice writes the skill; sleep is what files it. Cut the night after a session and you keep the day's gain but lose most of the overnight one — and a good night later doesn't get it back.",
    glossary: [
      { term: "consolidation", def: "The process that turns a fresh, fragile memory into a stable one, mostly while you are not using it.", tier: "basic", analogy: "Think of saving a draft so it survives after the app closes." },
      { term: "slow-wave sleep", def: "The deepest stage of non-dreaming sleep, concentrated in the first few hours of the night.", tier: "working" },
      { term: "criterion", def: "A fixed performance level everyone must reach, so people start the test equally trained rather than equally practised.", tier: "deep" },
    ],
    topic: { id: "T101", name: "sleep and memory", subfield: "Cognitive Neuroscience", source: "openalex" },
    pitchedForYou: {
      topicId: "T101",
      topicName: "sleep and memory",
      level: 2,
      consequence: "I'm defining terms and using analogies as I go.",
    },
    questions: [
      "Does a nap the next afternoon do anything, or is it only the first night that counts?",
      "Was the restricted group just tired at retest, rather than worse at the skill?",
      "How would this change if they had practised in the morning instead?",
    ],
  },
  p3: {
    gist:
      "This is the paper behind the idea that you can hold about seven things in mind at once. Its actual argument is narrower and more interesting than the number it is famous for: the limit is on how many units you are tracking, not on how much information each unit contains. Which means the ceiling moves if you change what counts as a unit.",
    did:
      "Miller assembled results from a decade of unrelated experiments — judging the pitch of a tone, the saltiness of a solution, the position of a dot on a line — and noticed they all broke down at around the same point. He then set that against experiments on recoding, where people were trained to group binary digits into larger units before memorising them.",
    found:
      "Across wildly different tasks, accuracy collapsed somewhere between five and nine categories. But a trained participant recoding binary digits into groups of five held around 40 digits — far past any limit on digits. The constant is the number of chunks, not the number of items, and the amount of information a chunk can carry appears to have no comparable ceiling.",
    caveats: "",
    remember:
      "The limit isn't seven items, it's seven chunks — and how much a chunk holds is the part you can actually train.",
    glossary: [
      { term: "chunk", def: "A group of items your mind is treating as one thing, like a familiar area code rather than three separate digits.", tier: "basic" },
      { term: "recoding", def: "Deliberately regrouping information into bigger units before you try to hold on to it.", tier: "working" },
    ],
    topic: { id: "T202", name: "working memory", subfield: "Cognitive Psychology", source: "openalex" },
    questions: [
      "Is seven still the accepted number, or has it been revised down?",
      "What actually makes something become a single chunk?",
      "Does this apply to holding an argument in mind, or only to lists?",
    ],
  },
};

const HOMEWORK: Record<string, HomeworkItem[]> = {
  p1: [
    {
      openAlexId: "W1",
      title: "Napping partially rescues sleep-dependent motor consolidation after a restricted night",
      authors: ["L. Okonkwo", "S. Duarte"],
      year: 2026,
      venue: "Journal of Sleep Research",
      url: "https://example.com/nap-rescue",
      pdfUrl: null,
      abstract: "",
      citationCount: 14,
    },
    {
      openAlexId: "W2",
      title: "Slow-wave activity, not sleep duration, predicts overnight gains in a sequential tapping task",
      authors: ["H. Møller"],
      year: 2026,
      venue: "Nature Communications",
      url: "https://example.com/slow-wave",
      pdfUrl: null,
      abstract: "",
      citationCount: 6,
    },
  ],
  p3: [],
};

/** A stand-in for the model — enough shape to review the thread, no pretence. */
function cannedAnswer(question: string, selection?: string | null): string {
  if (selection) {
    return `Sample dig on "${selection.slice(0, 60)}${selection.length > 60 ? "…" : ""}". In the product this comes from /api/papers/[id]/qa with the highlighted passage as the anchor, streamed a token at a time so the panel is filling in by the time you scroll to it. This page has no model behind it, so what arrives is fixed — it is here to show the shape of a dig, not the quality of one.`;
  }
  return `Sample answer for "${question.replace(/\s+$/, "")}". In the product this comes from /api/papers/[id]/qa, which reads the paper's full text and is told to lead with the answer in two to four sentences and cite a specific number where it can. This page has no model behind it, so the text you're reading is fixed — it's here to show the shape of a reply, not the quality of one.`;
}

function fixtureFor(id: string): ReadingFixture {
  return {
    companion: COMPANIONS[id] ?? null,
    familiarity: id === "p1" ? {
      topicId: "T101",
      topicName: "sleep and memory",
      level: 2,
      source: "interleave",
    } : null,
    homework: HOMEWORK[id] ?? [],
    qa: id === "p1"
      ? [{
        id: "q1",
        question: "Would going to bed late but sleeping eight hours have the same effect?",
        answer:
          "Probably not as bad, but not neutral either. The gain tracked slow-wave sleep in the first two hours rather than total time, and slow-wave sleep is front-loaded relative to sleep onset, not to the clock — so a late night that still runs eight hours keeps most of it. What this study can't tell you is whether shifting that window several hours later costs anything on its own, because every participant went to bed at their usual time.",
      }, {
        // A passage asked about on a previous visit. It is what a rehydrated
        // answer card looks like: folded, in the rail, headed by its passage in
        // the paper's hue, with numeral 1 over the sentence it came from. The
        // state is otherwise unreachable without asking something first.
        id: "q2",
        threadId: "t2",
        selection: "the part that gets lost is not recoverable by sleeping in the following night",
        sectionKey: "gist",
        question: "What does this mean?",
        answer:
          "It means the overnight gain has one window and the window does not reopen. The consolidation the paper is measuring runs on slow-wave sleep in the first couple of hours after you fall asleep, so a four hour night does not get half of it, it gets almost none. Sleeping normally the next night rebuilds nothing: at 72 hours the restricted group was still 13 points behind, which is the gap you would expect if the missing work simply never happened rather than being deferred.",
      }]
      : [],
    answer: cannedAnswer,
  };
}

/* ── The page ────────────────────────────────────────────────────────────── */

export default function ReadingListPrototype() {
  const [view, setView] = useState<"history" | "list">("list");
  const [detail, setDetail] = useState<{ paper: PaperItem; index: number } | null>(null);

  // The reading view is a page now rather than an overlay, so the prototype
  // swaps to it the way the router does in production.
  if (detail) {
    return (
      <ReadingPaperDetail
        paper={detail.paper}
        index={detail.index}
        onBack={() => setDetail(null)}
        fixture={fixtureFor(detail.paper.id)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-4 md:px-8 pt-8 pb-20">
      <PageHeader
        title="Vault"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 12 }}>
            <NavTab active={view === "history"} onClick={() => setView("history")}>Digests</NavTab>
            <NavTab active={view === "list"} onClick={() => setView("list")}>Saved papers</NavTab>
          </div>
        }
      />

      {view === "history" ? (
        <div style={{ padding: "80px 0", textAlign: "center" }}>
          <p style={{ ...DISPLAY_LG, margin: 0 }}>Not this prototype</p>
          <p style={{ ...BODY_STYLE, color: MUTED, margin: "8px 0 0" }}>
            Digest history is unchanged — go back to Saved papers.
          </p>
        </div>
      ) : (
        <>
          <p style={{ ...BODY_STYLE, color: DIM, margin: "-24px 0 24px", maxWidth: 620 }}>
            {PAPERS.length} saved. Open one for the walkthrough — the gist, what
            they did, what they found, where it&rsquo;s shaky, and what you can ask it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
            {PAPERS.map((paper, idx) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                index={idx}
                size="compact"
                loggedIn
                initialBookmarked
                preview={paper.companionRemember}
                footnote={
                  !paper.companionRemember ? (
                    <span style={{ ...BODY_SM, color: MUTED, fontStyle: "italic" }}>Reading it for you&hellip;</span>
                  ) : paper.digestTheme ? (
                    <span style={{ ...BODY_SM, color: DIM }}>Saved from &ldquo;{paper.digestTheme}&rdquo;</span>
                  ) : null
                }
                onOpen={p => setDetail({ paper: p, index: idx })}
              />
            ))}
          </div>

          <p style={{ ...BODY_SM, color: MUTED, marginTop: 40, maxWidth: 620 }}>
            Sample data. The middle card is a paper whose prep hasn&rsquo;t finished — in
            the product the shelf polls every ten seconds and the line appears in
            place. Opening it shows the reading view with no companion, which is
            also a real state.
          </p>
        </>
      )}

    </div>
  );
}

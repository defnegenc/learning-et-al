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
import type { PaperSection } from "@/components/vault/reading-sections";
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
      { term: "consolidation", def: "The process that turns a fresh, fragile memory into a stable one, mostly while you are not using it." },
      { term: "slow-wave sleep", def: "The deepest stage of non-dreaming sleep, concentrated in the first few hours of the night." },
      { term: "criterion", def: "A fixed performance level everyone must reach, so people start the test equally trained rather than equally practised." },
    ],
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
      { term: "chunk", def: "A group of items your mind is treating as one thing, like a familiar area code rather than three separate digits." },
      { term: "recoding", def: "Deliberately regrouping information into bigger units before you try to hold on to it." },
    ],
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

/* ── The section view's data ─────────────────────────────────────────────────
 *
 * FIXED BUTTONS, VARIABLE SOURCES. Heading detection over five real arXiv
 * extracts found an introduction and a results section in 5 of 5 papers, but a
 * methods section in only 3 of 5, a discussion in 1 of 5 and an explicit
 * limitations section in 1 of 5. So the buttons cannot be the paper's own table
 * of contents — the two parts a non-expert most wants are the two that are most
 * often missing. Each button is fixed and each records where its answer came
 * from: `heading` set means it was read out of that section, `heading: null`
 * means it was inferred from the whole paper, and the row says so.
 *
 * p1 is the ideal case (every section present). p3 is Miller 1956, a 1950s essay
 * with no methods section at all — the honest hard case.
 */

const SECTIONS: Record<string, PaperSection[]> = {
  p1: [
    {
      key: "methods",
      label: "How they did it",
      teaser: "Three groups, one finger-tapping sequence, and one short night.",
      heading: "2. Materials and Methods",
      chars: 9840,
      summary:
        "Fifty-two adults aged 19 to 26 learned a five-element finger-tapping sequence in the evening, practising until they hit a fixed accuracy criterion rather than for a fixed number of trials — so everyone started the night equally trained rather than equally practised. They were then split three ways: a rested group sent home to sleep normally, a restricted group held in the lab to four hours and woken at the same clock time, and a wake group who had learned the sequence in the morning and were retested after an equal stretch of waking time. That third arm is what separates the effect of sleep from the effect of twelve hours simply passing. Polysomnography ran on both overnight groups, which is what let them measure slow-wave sleep rather than just time in bed.",
    },
    {
      key: "findings",
      label: "What they found",
      teaser: "19% overnight if you sleep, 4% if you don't, and it doesn't come back.",
      heading: "3. Results",
      chars: 7120,
      summary:
        "The rested group improved 19% overnight with no further practice. The restricted group improved 4%, statistically indistinguishable from the wake group's 3% — so four hours of sleep did roughly nothing that staying awake wouldn't have done. The striking part is at 72 hours: a second, full night of sleep did not recover the missing gain, and the restricted group was still 13 points behind. Slow-wave sleep in the first two hours predicted the size of the gain better than total sleep time did, which is why four hours was not simply half as good as eight.",
    },
    {
      key: "discussion",
      label: "What they think it means",
      teaser: "Consolidation has a window, and it doesn't reopen.",
      heading: "4. Discussion",
      chars: 5460,
      summary:
        "The authors read this as evidence that consolidation is not a process that runs whenever it gets the chance, but one with a window tied to the first slow-wave-rich hours after learning. Their argument for the window being closed rather than merely delayed is the 72-hour result: if the brain were queuing the work, the following night would have done it. They are careful about the mechanism — they observe the correlation with early slow-wave activity but do not claim to have shown that slow-wave sleep causes the consolidation, only that whatever does the filing happens when slow-wave sleep does.",
    },
    {
      key: "limits",
      label: "Where it's weak",
      teaser: "52 young adults, one bad night, and the easiest possible task.",
      heading: "4.3 Limitations",
      chars: 2180,
      summary:
        "The authors flag the sample first: 52 people across three arms is small, and everyone was between 19 and 26, an age at which slow-wave sleep is at its lifetime peak — so the effect size here is closer to a ceiling than an average. One night of restriction is also not the chronic pattern most people actually live in, and they explicitly decline to extrapolate. What they do not raise, and a reader should, is that finger tapping is the friendliest motor task in the literature: nothing here establishes that a surgical or musical skill consolidates the same way.",
    },
  ],
  p3: [
    {
      key: "methods",
      label: "How they did it",
      teaser: "No experiment of its own — a decade of other people's results, re-read.",
      // The honest hard case: a 1956 essay has no methods section, and no
      // regex or model will find one.
      heading: null,
      chars: null,
      summary:
        "There is no methods section here, because there is no experiment. Miller assembled results from a decade of unrelated studies — judging the pitch of a tone, the saltiness of a solution, the position of a dot on a line — and noticed they all broke down at about the same point. The second half sets that against experiments on recoding, where people were trained to group binary digits into larger units before memorising them. The argument is made by juxtaposition rather than by a new measurement, which is worth knowing before you cite it as evidence for anything: its force comes from the consistency of other people's numbers.",
    },
    {
      key: "findings",
      label: "What they found",
      teaser: "The constant is chunks, not items — and a chunk has no obvious ceiling.",
      heading: "The Span of Absolute Judgment",
      chars: 11200,
      summary:
        "Across wildly different judgment tasks, accuracy collapsed somewhere between five and nine categories, which is where the famous number comes from. But a trained participant recoding binary digits into groups of five held around 40 digits — far past any limit on digits as such. So the constant is the number of chunks being tracked, not the number of items, and the amount of information a single chunk can carry appears to have no comparable ceiling. That second half is the part almost nobody quotes and the part that actually matters.",
    },
    {
      key: "discussion",
      label: "What they think it means",
      teaser: "Miller himself thought the number was a coincidence.",
      heading: "Recoding",
      chars: 6300,
      summary:
        "Miller's own reading is more sceptical than his reputation suggests: he treats the recurrence of seven as suspicious rather than fundamental, and says so — the paper's closing passage is openly uneasy about whether the coincidence means anything. What he commits to is recoding as the mechanism that matters, and the practical implication that expertise looks like better chunking rather than a bigger buffer. That reframing, not the number, is what the following seventy years of working-memory research is a reply to.",
    },
    {
      key: "limits",
      label: "Where it's weak",
      teaser: "No limitations section, and the number has since been revised down.",
      heading: null,
      chars: null,
      summary:
        "The paper has no limitations section — the convention barely existed in 1956 — so this is inferred. The obvious weakness is the one Miller half-admits: pooling effect sizes across tasks that measure different things and reading a constant out of them is not a method that would pass review today. The evidence is also entirely from laboratory judgment and recall tasks with trained participants. And the field has moved: later work using cleaner paradigms puts the capacity closer to four chunks than seven, so the number in the title is now the least reliable thing in it.",
    },
  ],
};

/** A stand-in for the model — enough shape to review the thread, no pretence. */
function cannedAnswer(question: string): string {
  return `Sample answer for "${question.replace(/\s+$/, "")}". In the product this comes from /api/papers/[id]/qa, which reads the paper's full text and is told to lead with the answer in two to four sentences and cite a specific number where it can. This page has no model behind it, so the text you're reading is fixed — it's here to show the shape of a reply, not the quality of one.`;
}

function fixtureFor(id: string): ReadingFixture {
  const sections = SECTIONS[id];
  return {
    companion: COMPANIONS[id] ?? null,
    homework: HOMEWORK[id] ?? [],
    // Summaries are stripped out of the list and served by `sectionSummary`
    // instead, so the section opens empty and fills — which is what the real
    // thing does, because nothing is summarised until you ask for it.
    sections: sections?.map(s => ({ ...s, summary: null })),
    sectionSummary: key => sections?.find(s => s.key === key)?.summary ?? null,
    qa: id === "p1"
      ? [{
        id: "q1",
        question: "Would going to bed late but sleeping eight hours have the same effect?",
        answer:
          "Probably not as bad, but not neutral either. The gain tracked slow-wave sleep in the first two hours rather than total time, and slow-wave sleep is front-loaded relative to sleep onset, not to the clock — so a late night that still runs eight hours keeps most of it. What this study can't tell you is whether shifting that window several hours later costs anything on its own, because every participant went to bed at their usual time.",
      }]
      : [],
    answer: cannedAnswer,
  };
}

/* ── The page ────────────────────────────────────────────────────────────── */

export default function ReadingListPrototype() {
  const [view, setView] = useState<"history" | "list">("list");
  const [detail, setDetail] = useState<{ paper: PaperItem; index: number } | null>(null);

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

      {detail && (
        <ReadingPaperDetail
          paper={detail.paper}
          index={detail.index}
          onClose={() => setDetail(null)}
          fixture={fixtureFor(detail.paper.id)}
        />
      )}
    </div>
  );
}

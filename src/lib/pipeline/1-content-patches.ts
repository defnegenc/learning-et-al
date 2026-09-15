import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";

/*
 * One-time, idempotent content patches, run from the cron entry point.
 *
 * Each patch checks a defect marker before writing and only touches the named
 * rows, so once the fix lands the marker is gone and the patch degrades to a
 * no-op read. Entries can be deleted after they apply.
 */

const SEP15_DIGEST_ID = "69dbc60d-8968-42bf-b646-90ece1a3cc2e"; // 2026-09-15 edition
const SEP15_REVIEW_PAPER_ID = "a10beb87-c55a-4efa-b2bb-ec21b699709f"; // [Source 1]

export async function runContentPatches(): Promise<string[]> {
  const applied: string[] = [];

  // 2026-09-15 edition, from the daily review:
  // - Theme said "millions of papers": the millions are patent sentences (Source 2);
  //   the paper corpus is Source 3's 250,000.
  // - [Source 2]: nobody hand-graded GPT-4's labels with accuracy/consistency scores;
  //   the abstract describes BLEU + topic modeling inside a human-supervised framework,
  //   and 0.91 is an F1 score, not "matched expert judgment on 91%".
  // - The gist/closing claim that both teams used human spot-checks is unsupported.
  // - [Source 4]: "the tool everyone still uses" is editorializing.
  // - "each inventing their own spot-check" / "skip validation entirely" overstate
  //   the review; the supported claim is that no standard or convergence exists.
  const d = await db.query.digests.findFirst({
    where: eq(digests.id, SEP15_DIGEST_ID),
    columns: { synthesisContent: true, gist: true, theme: true },
  });
  if (d?.synthesisContent?.includes("accuracy and consistency scores")) {
    const synthesisContent = d.synthesisContent
      .replace(
        "That's the honest answer to who checks the AI's work: right now, it's a patchwork of individual research teams each inventing their own spot-check, because no shared standard exists yet.",
        "That's the honest answer to who checks the AI's work: right now, there is no shared standard for it, and the field has not converged on one.",
      )
      .replace(
        "built the tool everyone still uses to sort text into hidden themes automatically",
        "built a way to sort text into hidden themes automatically",
      )
      .replace(
        "then had humans grade those labels using accuracy and consistency scores before trusting any of it. The AI-generated labels then trained a second, smaller model that matched expert judgment on **91% of a two-category test**.",
        "then scored those labels with BLEU and topic modeling inside a human-supervised framework before trusting any of it. The AI-generated labels then trained a second, smaller model that reached an **F1 of 0.91 on a two-category test**.",
      )
      .replace(
        "Two teams built human spot-checks from scratch, on different problems, with no shared rulebook between them, and that's still the state of the art.",
        "Two teams checked the AI's work in two different ways, on different problems, with no shared rulebook between them, and that's still the state of the art.",
      );
    const gist = (d.gist ?? "").replace(
      "Right now it's whoever built the AI: two teams each made their own human spot-check, but no shared standard exists across the field.",
      "Right now it's whoever built the AI: each team checks the work its own way, and no shared standard exists across the field.",
    );
    const theme = (d.theme ?? "").replace(
      "AI sorts millions of papers. Who checks its work?",
      "AI reads millions of patent sentences and 250,000 papers. Who checks its work?",
    );
    await db
      .update(digests)
      .set({ synthesisContent, gist, theme })
      .where(eq(digests.id, SEP15_DIGEST_ID));
    applied.push("digest-2026-09-15");
  }

  const p = await db.query.papers.findFirst({
    where: eq(papers.id, SEP15_REVIEW_PAPER_ID),
    columns: { keyFindings: true },
  });
  if (p?.keyFindings?.includes("skip validation entirely")) {
    const keyFindings = p.keyFindings.replace(
      "Most researchers **skip validation entirely** or use inconsistent, one-off methods",
      "Validation practice is **inconsistent and one-off** across teams - nothing has converged into a standard",
    );
    await db
      .update(papers)
      .set({ keyFindings })
      .where(eq(papers.id, SEP15_REVIEW_PAPER_ID));
    applied.push("paper-2026-09-15-source1");
  }

  return applied;
}

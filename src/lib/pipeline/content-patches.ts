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

  // 2026-09-16 edition: the foundational card over-explained itself before
  // Findings. Trim the lead to its point (the demoted summary sentence was
  // removed card-side in paper-card.tsx).
  const SEP16_PAPER_ID = "9b2994bf-db65-470e-974a-a4c1c86a993b"; // A rulebook of loved-place patterns
  const p2 = await db.query.papers.findFirst({
    where: eq(papers.id, SEP16_PAPER_ID),
    columns: { foundationalReason: true },
  });
  if (p2?.foundationalReason?.includes("the same premise every AI-generated-park scheme is borrowing from")) {
    await db
      .update(papers)
      .set({
        foundationalReason:
          "Foundational Text alert 👀 Christopher Alexander's pattern language basically invented reusable, human-centered building blocks - the premise every AI-generated-park scheme borrows from.",
      })
      .where(eq(papers.id, SEP16_PAPER_ID));
    applied.push("paper-2026-09-16-foundational-lead");
  }


  // 2026-09-16 edition, from the daily review:
  // - The central conclusion claimed no AI landscape research anywhere asks
  //   whether people like what gets built; narrowed to today's sources.
  // - "Grass" was never one of Source 1's classes; its six are Water scene,
  //   landscape scene, living scene, sky scene, architecture and transportation.
  // - Source 2 (a robot-vision survey) does not support the landscape-design
  //   theme; dropped, the source markers renumbered, its four key concepts removed.
  // - "a local feeling at home" / "hasn't been felt by anyone" / "felt warmer
  //   than one built by a committee" were unsourced; removed or narrowed to
  //   what the study reports.
  // - Alexander/Ishikawa "observed ... over years" is unsourced; fact removed.
  const SEP16_DIGEST_ID = "cf408331-3a65-4bf2-a62f-483786319630"; // 2026-09-16 edition
  const SEP16_ROBOT_PAPER_ID = "70c8c03a-3531-4bfc-b2ce-fbb4cd6fc39e"; // dropped Source 2
  const SEP16_URBANRURAL_PAPER_ID = "5fd4c8e6-28bf-41ae-8a36-c6929f7a6a50";
  const d2 = await db.query.digests.findFirst({
    where: eq(digests.id, SEP16_DIGEST_ID),
    columns: { synthesisContent: true, gist: true, keyConcepts: true },
  });
  if (d2?.synthesisContent?.includes("photo of water from a photo of grass")) {
    const synthesisContent = `Not really, not yet anyway. None of the AI landscape research in today's edition asks people whether they like what gets built. They measure whether a computer can sort a photo into categories like water and sky, or whether a design scores higher on a rubric.

- **[Source 1] the fractal landscape scanner** found it can sort **200 landscape photos** into six categories like water scenes and sky scenes using fractal math, but says accuracy drops hard when the edges between regions get **blurry or low-contrast**.

> That's pattern recognition, not design. What happens when AI moves beyond sorting pictures?

- **[Source 2] the urban-rural AI design study** tested whether AI can balance **traditional rural culture** against modern city needs, and found AI-based designs scored **0.77 points higher on aesthetics** and **0.70 higher on harmony** than traditional methods. The study reports rubric scores, not how people feel about living with the results.

> A higher rubric score isn't the same as people preferring the place.

- **[Source 3] the pattern language book** argues that the world's most loved places were **not made by architects** at all, but by ordinary people using a shared design language to build their own houses and streets.

None of these AI systems measured what the people who will actually stand in the park think.`;
    const gist =
      "Not really, not yet: AI tools get graded on sorting photos or hitting a rubric score, not on whether a real person likes standing in the finished place.";
    await db
      .update(digests)
      .set({ synthesisContent, gist })
      .where(eq(digests.id, SEP16_DIGEST_ID));
    applied.push("digest-2026-09-16-landscape-review");
  }
  if (d2?.keyConcepts?.includes("path planning")) {
    const concepts = JSON.parse(d2.keyConcepts) as string[];
    const keyConcepts = JSON.stringify(
      concepts.filter(
        (c) =>
          !c.startsWith("visual perception:") &&
          !c.startsWith("path planning:") &&
          !c.startsWith("decision-making (AI):") &&
          !c.startsWith("control systems:"),
      ),
    );
    await db
      .update(digests)
      .set({ keyConcepts })
      .where(eq(digests.id, SEP16_DIGEST_ID));
    applied.push("digest-2026-09-16-key-concepts");
  }

  const robot = await db.query.papers.findFirst({
    where: eq(papers.id, SEP16_ROBOT_PAPER_ID),
    columns: { title: true },
  });
  if (robot?.title?.includes("Intelligent robot systems")) {
    await db.delete(papers).where(eq(papers.id, SEP16_ROBOT_PAPER_ID));
    await db
      .update(papers)
      .set({ sourceIndex: 1 })
      .where(eq(papers.id, SEP16_URBANRURAL_PAPER_ID));
    await db
      .update(papers)
      .set({ sourceIndex: 2 })
      .where(eq(papers.id, SEP16_PAPER_ID));
    applied.push("digest-2026-09-16-drop-source2");
  }

  const p3 = await db.query.papers.findFirst({
    where: eq(papers.id, SEP16_PAPER_ID),
    columns: { methodFacts: true },
  });
  if (p3?.methodFacts?.includes("over years")) {
    const facts = JSON.parse(p3.methodFacts) as string[];
    const methodFacts = JSON.stringify(facts.filter((f) => !f.includes("over years")));
    await db
      .update(papers)
      .set({ methodFacts })
      .where(eq(papers.id, SEP16_PAPER_ID));
    applied.push("paper-2026-09-16-method-facts");
  }

  return applied;
}

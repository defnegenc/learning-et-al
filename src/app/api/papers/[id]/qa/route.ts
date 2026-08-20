import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, qaPairs, interests } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { aiChat, aiChatStream, aiConfigFor, type AIMessage } from "@/lib/ai/provider";
import { downloadAndParsePdf, textForPrompt, FULL_TEXT_CAP } from "@/lib/fetchers/pdf";
import { getAuthUser } from "@/lib/get-user";
import { isSectionKey } from "@/lib/reading-thread";

// The whole paper reaches the model now, so a question about a long one is a
// large prompt. This route had no declared duration at all and took Vercel's
// default.
export const maxDuration = 300;

/*
 * A paper's conversation — typed questions and highlighted passages alike.
 *
 * Two things changed here. It is threaded: prior turns of the same thread go to
 * the model, so a follow-up ("and the second one?") has something to resolve
 * against instead of being answered blind, which is how every question in this
 * product used to be answered. And it can stream, because dig-deeper promises
 * the reader they can keep reading while the answer arrives.
 */

/** What the reader is asking for when they highlight rather than type. */
const DIG_INTENT = "Dig deeper on this passage.";

const ASK_SYSTEM = `You are the reader's librarian: you have read this paper closely and you are explaining it to a curious non-expert who is reading your walkthrough of it.

Answer directly — lead with the answer, no "according to the paper" preamble, no restating what the paper is about. 2-4 sentences by default; go longer only if the reader asks a follow-up that needs it. Cite a specific detail or number where you can. If the paper genuinely doesn't say, say so in one line rather than guessing.`;

const DIG_SYSTEM = `${ASK_SYSTEM}

The reader has highlighted a passage of your walkthrough and asked you to dig deeper on it. Explain what that passage is really saying and why it matters: unpack the mechanism, the evidence behind it, or the term that is doing the work — whichever the passage actually turns on. Go to the paper's own detail. Do not simply restate the passage in different words.`;

/** The section a highlight came from, named for the model. */
const SECTION_NAMES: Record<string, string> = {
  gist: "the gist",
  did: "what they did",
  found: "what they found",
  caveats: "where it's shaky",
  remember: "the one line to remember",
};

async function getFullText(paper: typeof papers.$inferSelect): Promise<string> {
  let fullText = paper.fullText || "";
  const abstractText = paper.abstract || "";
  const hasRichFullText = fullText.length > abstractText.length + 100;

  if (!hasRichFullText && paper.pdfUrl) {
    try {
      // Capped on the way into the row — see the companion route.
      const pdfText = (await downloadAndParsePdf(paper.pdfUrl)).slice(0, FULL_TEXT_CAP);
      if (pdfText && pdfText.length > abstractText.length) {
        fullText = pdfText;
        await db.update(papers).set({ fullText: pdfText }).where(eq(papers.id, paper.id));
      }
    } catch (e) {
      console.error("On-demand PDF download failed, falling back to abstract:", e);
    }
  }

  return fullText || abstractText;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pairs = await db.query.qaPairs.findMany({
      where: and(eq(qaPairs.paperId, id), eq(qaPairs.userId, userId)),
      orderBy: asc(qaPairs.createdAt),
    });

    return NextResponse.json({ qaPairs: pairs });
  } catch (error) {
    console.error("QA fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Q&A pairs" }, { status: 500 });
  }
}

/**
 * Every third question boosts the paper's keywords. Engagement should nudge,
 * not dominate — this predates the plan's taste ledger and is left as it was.
 */
async function boostKeywords(userId: string, paperId: string, keywordsJson: string | null) {
  const allPairs = await db.query.qaPairs.findMany({
    where: and(eq(qaPairs.paperId, paperId), eq(qaPairs.userId, userId)),
  });
  if (allPairs.length === 0 || allPairs.length % 3 !== 0) return;

  const keywords: string[] = keywordsJson ? JSON.parse(keywordsJson) : [];
  for (const keyword of keywords) {
    const existing = await db.query.interests.findFirst({
      where: and(eq(interests.userId, userId), eq(interests.keyword, keyword)),
    });
    if (existing) {
      await db.update(interests)
        .set({ weight: (existing.weight ?? 1.0) + 0.3, source: "engagement", updatedAt: new Date() })
        .where(eq(interests.id, existing.id));
    } else {
      await db.insert(interests).values({ userId, keyword, weight: 0.3, source: "engagement" });
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const selection: string | null = typeof body.selection === "string" && body.selection.trim()
      ? body.selection.trim().slice(0, 1200)
      : null;
    const sectionKey: string | null = isSectionKey(body.sectionKey) ? body.sectionKey : null;
    const wantsStream = body.stream === true;
    // A highlight is a question the reader didn't have to formulate — that is
    // most of the point of the interaction.
    const question: string = (typeof body.question === "string" && body.question.trim())
      ? body.question.trim()
      : selection ? DIG_INTENT : "";

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const aiConfig = aiConfigFor("dig");
    if (!aiConfig.apiKey) {
      return NextResponse.json({ error: "Server AI key not configured." }, { status: 500 });
    }

    const fullText = textForPrompt(await getFullText(paper));

    // A new highlight or a new typed question opens its own thread; a follow-up
    // continues the one it was asked in.
    const threadId: string = typeof body.threadId === "string" && body.threadId
      ? body.threadId
      : crypto.randomUUID();

    const history = body.threadId
      ? await db.query.qaPairs.findMany({
          where: and(
            eq(qaPairs.paperId, id),
            eq(qaPairs.userId, userId),
            eq(qaPairs.threadId, threadId),
          ),
          orderBy: asc(qaPairs.createdAt),
        })
      : [];

    // The paper goes in once, at the head, and the thread replays after it —
    // not once per turn.
    const anchor = selection
      ? `The reader highlighted this passage${sectionKey ? ` in ${SECTION_NAMES[sectionKey] ?? "the walkthrough"}` : ""}:\n\n"${selection}"\n\n`
      : "";

    const messages: AIMessage[] = [
      { role: "system", content: selection ? DIG_SYSTEM : ASK_SYSTEM },
      { role: "user", content: `Here is the paper you have read.\n\nTitle: ${paper.title}\n\n${fullText}` },
      { role: "assistant", content: "Understood — ask me anything about it." },
      ...history.flatMap((turn): AIMessage[] => [
        { role: "user", content: turn.question },
        { role: "assistant", content: turn.answer },
      ]),
      { role: "user", content: `${anchor}${question}` },
    ];

    const pairId = crypto.randomUUID();

    const persist = async (answer: string) => {
      await db.insert(qaPairs).values({
        id: pairId, paperId: id, userId, question, answer, threadId, selection, sectionKey,
      });
      await boostKeywords(userId, id, paper.keywords).catch(() => {});
    };

    if (!wantsStream) {
      const answer = await aiChat(aiConfig, messages);
      await persist(answer);
      return NextResponse.json({
        qaPair: { id: pairId, question, answer, threadId, selection, sectionKey },
      });
    }

    // NDJSON: one header line so the client can render the turn immediately,
    // then deltas, then a terminator. The row is written when the stream ends,
    // so a dropped connection leaves no half-answer in the thread.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const line = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        line({ type: "start", id: pairId, threadId, question, selection, sectionKey });
        let answer = "";
        try {
          for await (const delta of aiChatStream(aiConfig, messages)) {
            answer += delta;
            line({ type: "delta", text: delta });
          }
          if (answer.trim()) await persist(answer);
          line({ type: "done" });
        } catch (e) {
          console.error("QA stream error:", e);
          line({ type: "error", message: e instanceof Error ? e.message : "That one didn't come back." });
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
      },
    });
  } catch (error) {
    console.error("QA error:", error);
    return NextResponse.json({ error: "Failed to process question" }, { status: 500 });
  }
}

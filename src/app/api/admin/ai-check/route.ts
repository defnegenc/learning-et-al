import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/get-user";
import { aiComplete, aiConfigFor, judgeConfigFrom } from "@/lib/ai/provider";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // The digest task, not the healthcheck one: the point of this route is to
  // prove the credentials the pipeline will actually use.
  const aiConfig = aiConfigFor("digest");
  const model = aiConfig.model || "(provider default)";
  const judgeConfig = judgeConfigFrom(aiConfig);
  const judgeModel = judgeConfig.model || "(provider default)";

  if (!aiConfig.apiKey) {
    return NextResponse.json({
      ok: false,
      provider: aiConfig.provider,
      model,
      hasKey: false,
      error: "CRON_AI_KEY is not configured.",
    }, { status: 500 });
  }

  try {
    const text = await aiComplete(
      aiConfig,
      "Reply with exactly: pong",
      "ping"
    );
    const judgeText = judgeModel === model
      ? text
      : await aiComplete(
        judgeConfig,
        "Reply with exactly: pong",
        "ping"
      );

    return NextResponse.json({
      ok: true,
      provider: aiConfig.provider,
      model,
      judgeModel,
      hasKey: true,
      response: text.trim(),
      judgeResponse: judgeText.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      provider: aiConfig.provider,
      model,
      judgeModel,
      hasKey: true,
      error: message,
    }, { status: 500 });
  }
}

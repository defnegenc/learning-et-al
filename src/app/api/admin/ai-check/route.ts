import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/get-user";
import { aiComplete } from "@/lib/ai/provider";
import { getCronAiConfig } from "@/lib/pipeline/digest-jobs";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const aiConfig = getCronAiConfig();
  const model = aiConfig.model || "(provider default)";

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

    return NextResponse.json({
      ok: true,
      provider: aiConfig.provider,
      model,
      hasKey: true,
      response: text.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      provider: aiConfig.provider,
      model,
      hasKey: true,
      error: message,
    }, { status: 500 });
  }
}

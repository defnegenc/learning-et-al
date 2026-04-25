import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/pipeline/digest";
import { AIConfig } from "@/lib/ai/provider";
import { getAuthUser } from "@/lib/get-user";
import { trackEvent } from "@/lib/track";

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { force } = await req.json();

    const cronProvider = (process.env.CRON_AI_PROVIDER || "gemini") as "gemini" | "anthropic" | "openai" | "other";
    const cronDefaultModel = cronProvider === "anthropic" ? "claude-sonnet-4-20250514"
      : cronProvider === "openai" ? "gpt-4o"
      : "gemini-2.5-flash";
    const apiKey = process.env.CRON_AI_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Server AI key not configured." }, { status: 500 });
    }

    const aiConfig: AIConfig = {
      apiKey,
      provider: cronProvider,
      model: process.env.CRON_AI_MODEL || cronDefaultModel,
      baseUrl: process.env.CRON_AI_BASE_URL || "",
    };
    const digest = await generateDigest(userId, aiConfig, force);

    trackEvent(userId, "digest_generate", { metadata: { force: !!force } });

    return NextResponse.json({ digest });
  } catch (error) {
    console.error("Digest generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

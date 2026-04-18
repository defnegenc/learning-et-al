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
    const { apiKey, provider, model, baseUrl, force } = await req.json();

    // Admin always uses server-side CRON_AI env credentials (regardless of what the client sent)
    const isAdminUser = userId === (process.env.ADMIN_USER_ID || "");

    // Fall back to shared CRON_AI config if user doesn't have their own key
    const cronProvider = process.env.CRON_AI_PROVIDER || "gemini";
    const cronDefaultModel = cronProvider === "anthropic" ? "claude-sonnet-4-20250514"
      : cronProvider === "openai" ? "gpt-4o"
      : "gemini-2.5-flash";
    const resolvedKey = isAdminUser
      ? (process.env.CRON_AI_KEY || "")
      : (apiKey || process.env.CRON_AI_KEY || "");
    const resolvedProvider = isAdminUser ? cronProvider : (provider || cronProvider);
    const resolvedModel = isAdminUser
      ? (process.env.CRON_AI_MODEL || cronDefaultModel)
      : (model || process.env.CRON_AI_MODEL || cronDefaultModel);
    const resolvedBaseUrl = isAdminUser
      ? (process.env.CRON_AI_BASE_URL || "")
      : (baseUrl || process.env.CRON_AI_BASE_URL || "");

    if (!resolvedKey || !resolvedProvider) {
      return NextResponse.json({ error: "No API key configured. Add one in Settings or ask for an invite code." }, { status: 400 });
    }

    const aiConfig: AIConfig = { apiKey: resolvedKey, provider: resolvedProvider, model: resolvedModel, baseUrl: resolvedBaseUrl };
    const digest = await generateDigest(userId, aiConfig, force);

    trackEvent(userId, "digest_generate", { metadata: { force: !!force } });

    return NextResponse.json({ digest });
  } catch (error) {
    console.error("Digest generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

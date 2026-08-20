import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/pipeline/digest";
import { AIConfig, aiConfigFor } from "@/lib/ai/provider";
import { getAuthUser } from "@/lib/get-user";
import { trackEvent } from "@/lib/track";

// The manual Generate button runs the full 9-15 call pipeline. Without this it inherits the
// platform default timeout, and a long run gets its connection cut mid-flight — the browser
// then shows "Network error — couldn't reach the server." Match the cron route's budget.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { force } = await req.json();

    const aiConfig: AIConfig = aiConfigFor("digest");
    if (!aiConfig.apiKey) {
      return NextResponse.json({ error: "Server AI key not configured." }, { status: 500 });
    }
    const digest = await generateDigest(userId, aiConfig, force);

    trackEvent(userId, "digest_generate", { metadata: { force: !!force } });

    return NextResponse.json({ digest });
  } catch (error) {
    console.error("Digest generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

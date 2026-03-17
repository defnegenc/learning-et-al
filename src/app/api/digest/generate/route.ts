import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/pipeline/digest";
import { AIConfig } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { apiKey, provider, model, baseUrl, force } = await req.json();

    if (!apiKey || !provider) {
      return NextResponse.json({ error: "apiKey and provider are required" }, { status: 400 });
    }

    const aiConfig: AIConfig = { apiKey, provider, model, baseUrl };
    const digest = await generateDigest(userId, aiConfig, force);

    return NextResponse.json({ digest });
  } catch (error) {
    console.error("Digest generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

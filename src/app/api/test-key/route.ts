import { NextRequest, NextResponse } from "next/server";
import { aiComplete, AIConfig } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, provider, model, baseUrl } = await req.json();

    if (!apiKey || !provider) {
      return NextResponse.json({ error: "apiKey and provider are required" }, { status: 400 });
    }

    const aiConfig: AIConfig = { apiKey, provider, model, baseUrl };
    const result = await aiComplete(aiConfig, "You are a helpful assistant.", "Say 'ok' and nothing else.");

    return NextResponse.json({ success: true, response: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

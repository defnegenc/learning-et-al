import { NextRequest, NextResponse } from "next/server";

const VALID_CODES = new Set(
  (process.env.INVITE_CODES || "").split(",").map(c => c.trim().toLowerCase()).filter(Boolean)
);

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ valid: false });

    const valid = VALID_CODES.has(code.trim().toLowerCase());
    const provider = process.env.CRON_AI_PROVIDER || "gemini";
    const defaultModel = provider === "anthropic" ? "claude-sonnet-4-6"
      : provider === "openai" ? "gpt-4o"
      : "gemini-2.5-flash";
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}

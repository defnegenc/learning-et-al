import { NextRequest, NextResponse } from "next/server";

const VALID_CODES = new Set(
  (process.env.INVITE_CODES || "").split(",").map(c => c.trim().toLowerCase()).filter(Boolean)
);

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ valid: false });

    const valid = VALID_CODES.has(code.trim().toLowerCase());
    return NextResponse.json({
      valid,
      // If valid, return the shared AI config so the user doesn't need their own key
      ...(valid ? {
        provider: process.env.CRON_AI_PROVIDER || "gemini",
        model: process.env.CRON_AI_MODEL || "gemini-2.5-flash",
        apiKey: process.env.CRON_AI_KEY || "",
        baseUrl: "",
      } : {}),
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}

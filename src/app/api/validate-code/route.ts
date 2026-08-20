import { NextRequest, NextResponse } from "next/server";

const VALID_CODES = new Set(
  (process.env.INVITE_CODES || "").split(",").map(c => c.trim().toLowerCase()).filter(Boolean)
);

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ valid: false });

    const valid = VALID_CODES.has(code.trim().toLowerCase());
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}

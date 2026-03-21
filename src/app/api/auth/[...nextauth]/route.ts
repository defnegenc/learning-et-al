import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Wrap handlers to catch and log errors
export async function GET(req: NextRequest) {
  try {
    return await handlers.GET(req);
  } catch (error) {
    console.error("[AUTH GET ERROR]", error);
    return NextResponse.json({ error: String(error), stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req);
  } catch (error) {
    console.error("[AUTH POST ERROR]", error);
    return NextResponse.json({ error: String(error), stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined }, { status: 500 });
  }
}

import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const resp = await handlers.GET(req);
    return resp;
  } catch (error: unknown) {
    // Surface the ACTUAL error instead of Auth.js swallowing it
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[AUTH FATAL]", msg, stack);
    return NextResponse.json({ authError: msg, stack: stack?.slice(0, 1000) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const resp = await handlers.POST(req);
    return resp;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[AUTH FATAL]", msg, stack);
    return NextResponse.json({ authError: msg, stack: stack?.slice(0, 1000) }, { status: 500 });
  }
}

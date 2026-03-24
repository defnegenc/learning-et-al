import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Debug: log env var availability on every auth request
  console.log("[AUTH ENV CHECK]", {
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL || "NOT SET",
    url: req.nextUrl.pathname,
  });

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

import { NextRequest, NextResponse } from "next/server";

// Required by Gmail/Outlook List-Unsubscribe-Post one-click spec.
// POST is called automatically by mail clients; GET is the browser fallback.
export async function POST() {
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/?unsubscribed=1", req.url));
}

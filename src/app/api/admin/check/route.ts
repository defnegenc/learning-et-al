import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/get-user";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ admin: false }, { status: 403 });
  }
  return NextResponse.json({ admin: true });
}

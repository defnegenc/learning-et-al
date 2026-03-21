import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
  try {
    // Test 1: Can we connect to the DB?
    const allUsers = await db.select().from(users).limit(1);

    // Test 2: Check env vars
    const envCheck = {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? "set (" + process.env.TURSO_DATABASE_URL.slice(0, 30) + "...)" : "NOT SET",
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "set (length: " + process.env.TURSO_AUTH_TOKEN.length + ")" : "NOT SET",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "set" : "NOT SET",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "set" : "NOT SET",
      AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "NOT SET",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "NOT SET",
      ADMIN_USER_ID: process.env.ADMIN_USER_ID ?? "NOT SET",
    };

    return NextResponse.json({
      ok: true,
      dbConnected: true,
      userCount: allUsers.length,
      env: envCheck,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

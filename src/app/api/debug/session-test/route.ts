import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, accounts, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Step 1: Create user
    const userId = crypto.randomUUID();
    await db.insert(users).values({ id: userId, email: "session-test@example.com", name: "Test" });

    // Step 2: Create account (what linkAccount does)
    await db.insert(accounts).values({
      userId,
      type: "oidc",
      provider: "google",
      providerAccountId: "test-" + Date.now(),
      access_token: "fake",
      token_type: "bearer",
      scope: "openid email profile",
    });

    // Step 3: Create session (THIS IS WHAT FAILS)
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      sessionToken: token,
      userId,
      expires,
    });

    // Step 4: Read it back
    const session = await db.query.sessions.findFirst({ where: eq(sessions.sessionToken, token) });

    // Cleanup
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({
      ok: true,
      sessionCreated: !!session,
      sessionData: session ? { token: session.sessionToken, userId: session.userId, expires: String(session.expires) } : null,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    }, { status: 500 });
  }
}

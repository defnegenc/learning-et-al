import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Simulate what DrizzleAdapter does when creating a user
    const testEmail = "test-auth-check@example.com";

    // Try to find user by email (what adapter does on sign-in)
    const existing = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);

    if (existing.length > 0) {
      // Clean up test user
      return NextResponse.json({ ok: true, step: "user found", user: existing[0] });
    }

    // Try creating a user (what adapter does on first sign-in)
    const [newUser] = await db.insert(users).values({
      email: testEmail,
      name: "Auth Test",
      image: null,
      emailVerified: null,
    }).returning();

    // Clean up - delete the test user
    await db.delete(users).where(eq(users.id, newUser.id));

    return NextResponse.json({
      ok: true,
      step: "user created and deleted successfully",
      userId: newUser.id,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

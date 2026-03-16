import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function getOrCreateUser(): Promise<string> {
  const cookieStore = await cookies();
  let userId = cookieStore.get("user_id")?.value;

  if (userId) {
    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (existing) return userId;
  }

  const [user] = await db.insert(users).values({}).returning();
  return user.id;
}

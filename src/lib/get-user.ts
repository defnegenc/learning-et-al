import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * Get the authenticated user ID from either Auth.js session or legacy cookie.
 * Returns null if not authenticated.
 */
export async function getAuthUser(req?: NextRequest): Promise<string | null> {
  // Try Auth.js session first (Google OAuth)
  try {
    const session = await auth();
    if (session?.user?.id) return session.user.id;
  } catch {
    // Auth.js not configured yet or session check failed — fall through to cookie
  }

  // Fall back to legacy cookie (for local dev / migration period)
  if (req) {
    const cookieId = req.cookies.get("user_id")?.value;
    if (cookieId) return cookieId;
  }

  return null;
}

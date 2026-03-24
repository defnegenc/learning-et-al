import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Hard logout — clears all auth cookies server-side.
 * HttpOnly cookies can't be cleared from client JS, so we need this.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookieStore = await cookies();

  // Delete every cookie that looks auth-related
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.includes("authjs") ||
      cookie.name.includes("next-auth") ||
      cookie.name.includes("session")
    ) {
      // Must match the exact flags the cookie was set with
      response.cookies.set(cookie.name, "", {
        expires: new Date(0),
        path: "/",
        secure: cookie.name.startsWith("__Secure-"),
        httpOnly: true,
      });
      // Also try without secure flag as fallback
      if (!cookie.name.startsWith("__Secure-")) {
        response.cookies.set(cookie.name, "", {
          expires: new Date(0),
          path: "/",
          httpOnly: true,
        });
      }
    }
  }

  return response;
}

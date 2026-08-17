import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Hard logout — nukes all cookies and redirects to /.
 * Lives outside /api/auth/ to avoid conflicting with [...nextauth] catch-all.
 *
 * Both the origin and `secure` are taken from the request rather than assumed.
 * Hardcoding the production host meant a local logout bounced you to
 * learningetal.com, and `secure: true` is silently ignored over plain http, so
 * the expiry never reached the browser and the cookie survived. That is not
 * only a dev annoyance: a session encrypted with a secret the server no longer
 * has (a rotated `AUTH_SECRET`, or a different `.env.local` on the same
 * localhost port) makes `auth()` throw JWTSessionError on every render, and
 * this route is the only way to clear an HttpOnly cookie.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const origin = new URL(req.url);
  const response = NextResponse.redirect(new URL("/", origin));

  // Expire every single cookie
  for (const cookie of cookieStore.getAll()) {
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      path: "/",
      secure: origin.protocol === "https:",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}

import { NextResponse } from "next/server";

/**
 * Hard logout — clears all auth cookies server-side.
 * HttpOnly cookies can't be cleared from client JS, so we need this.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear all possible auth cookie names (next-auth v5 / authjs)
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Secure-authjs.csrf-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.callback-url",
    "next-auth.csrf-token",
  ];

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      path: "/",
    });
  }

  return response;
}

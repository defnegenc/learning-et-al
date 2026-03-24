import { signOut } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Hard logout — uses next-auth's own signOut to properly clear the session.
 */
export async function POST() {
  try {
    await signOut({ redirect: false });
  } catch {
    // signOut may throw if no session exists — that's fine
  }

  // Also manually clear cookies as belt-and-suspenders
  const response = NextResponse.json({ ok: true });
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Secure-authjs.csrf-token",
  ];
  for (const name of cookieNames) {
    response.cookies.delete(name);
  }
  return response;
}

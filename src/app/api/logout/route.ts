import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Hard logout — nukes all cookies and redirects to /.
 * Lives outside /api/auth/ to avoid conflicting with [...nextauth] catch-all.
 */
export async function GET() {
  const cookieStore = await cookies();
  const baseUrl = process.env.NEXTAUTH_URL || "https://learningetal.com";
  const response = NextResponse.redirect(new URL("/", baseUrl));

  // Expire every single cookie
  for (const cookie of cookieStore.getAll()) {
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}

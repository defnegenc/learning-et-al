import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Hard logout — nukes all cookies and redirects to /.
 * Returns Set-Cookie headers to expire every auth-related cookie.
 */
export async function GET() {
  const cookieStore = await cookies();

  // Redirect to home
  const response = NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || "https://learningetal.com"));

  // Expire every single cookie we can find
  for (const cookie of cookieStore.getAll()) {
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
    // Also try without secure for dev
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}

export async function POST() {
  return GET();
}

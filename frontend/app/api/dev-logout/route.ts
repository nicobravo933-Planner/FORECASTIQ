import { NextResponse } from "next/server"

/**
 * GET /api/dev-logout
 *
 * Development-only route to force-clear the Better Auth session cookie
 * and redirect to the landing page. Useful when you have a residual
 * httpOnly cookie that DevTools can't delete.
 *
 * Only active in development (NODE_ENV !== "production").
 * Usage: navigate to http://localhost:3000/api/dev-logout
 */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const res = NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  )

  // Clear all common Better Auth cookie names
  const cookieNames = [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth.csrf_token",
    "__Host-better-auth.csrf_token",
  ]

  for (const name of cookieNames) {
    res.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    })
  }

  return res
}

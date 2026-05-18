/**
 * Next.js middleware — protects dashboard routes.
 * Redirects unauthenticated users to /login.
 * Public routes (login, signup, api/auth) are always allowed.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/signup", "/api/auth"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow non-dashboard paths (landing page, static assets, etc.)
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }

  // Check for Better Auth session cookie
  const session = getSessionCookie(request)

  if (!session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Run on dashboard routes only — skip static files and API routes handled by better-auth
  matcher: ["/dashboard/:path*"],
}

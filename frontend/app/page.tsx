import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import LandingPage from "@/components/landing/LandingPage"

/**
 * Root route — landing gate.
 *
 * Strategy: render the landing as a real Next.js page instead of
 * redirect("/landing.html"). The file-based redirect was unreliable
 * on Vercel (App Router doesn't guarantee .html static serving order).
 *
 * - Authenticated user  → /dashboard/home  (server-side, fast)
 * - Unauthenticated     → render LandingPage component
 *
 * getSession is wrapped in try/catch so a misconfigured auth env
 * never prevents the landing from showing.
 */
export default async function RootPage() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    if (session?.user) {
      redirect("/dashboard/home")
    }
  } catch {
    // Auth misconfigured or unavailable — show landing anyway
  }

  return <LandingPage />
}

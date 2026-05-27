import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/**
 * Root route — landing page gate.
 * - Authenticated user (OAuth or anonymous with a real session) → dashboard.
 * - Everyone else → public landing page.
 */
export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session?.user) {
    // Already logged in — skip landing and login screens
    redirect("/dashboard/home")
  }

  // Not authenticated — show the static landing page
  redirect("/landing.html")
}

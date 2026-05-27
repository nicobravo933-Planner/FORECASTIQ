import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import AuthThemeRegistry from "@/components/ui/AuthThemeRegistry"

/**
 * Auth group layout — two responsibilities:
 * 1. Server-side session guard: authenticated users skip directly to dashboard.
 * 2. Injects the auth-specific ThemeProvider (space dark) isolated from the
 *    dashboard theme, so both themes coexist without interference.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session?.user) {
    redirect("/dashboard/home")
  }

  return <AuthThemeRegistry>{children}</AuthThemeRegistry>
}

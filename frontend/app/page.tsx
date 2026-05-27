import { redirect } from "next/navigation"

/**
 * Root route — always redirects to the static landing page.
 *
 * landing.html lives in /public and is served directly by Vercel/Next.js.
 * It is the single source of truth for the landing — no React component needed.
 *
 * The "Abrir app" button in landing.html points to /login, which handles
 * the auth flow and redirects to /dashboard/home after sign-in.
 *
 * F5 / hard refresh always comes back here → always sees the landing.
 */
export default function RootPage() {
  redirect("/landing.html")
}

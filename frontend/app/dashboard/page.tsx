import { redirect } from "next/navigation"

// Redirect /dashboard → /dashboard/home
// Without this file, Next.js has no handler for /dashboard
// and falls through to the first alphabetical child (data/).
export default function DashboardIndexPage() {
  redirect("/dashboard/home")
}

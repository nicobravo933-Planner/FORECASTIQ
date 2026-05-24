/**
 * Better Auth — browser client.
 * Import this in 'use client' components that need session or sign-in/out.
 *
 * baseURL debe apuntar al frontend Next.js (donde viven las rutas /api/auth/*).
 * En Vercel: NEXT_PUBLIC_APP_URL = https://forecastiq.vercel.app
 * En local:  http://localhost:3000
 */

import { createAuthClient } from "better-auth/react"
import { anonymousClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [anonymousClient()],
})

// Convenience re-exports used throughout the app
export const { signIn, signOut, useSession } = authClient

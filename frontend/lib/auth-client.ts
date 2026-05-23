/**
 * Better Auth — browser client.
 * Import this in 'use client' components that need session or sign-in/out.
 */

import { createAuthClient } from "better-auth/react"
import { anonymousClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL
    ? undefined
    : "http://localhost:3000",
  plugins: [anonymousClient()],
})

// Convenience re-exports used throughout the app
export const { signIn, signOut, useSession } = authClient

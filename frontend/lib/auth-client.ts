/**
 * Better Auth — browser client.
 * Import this in 'use client' components that need session or sign-in/out.
 */

import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL
    ? undefined  // use same origin when API is on same domain
    : "http://localhost:3000",
})

// Convenience re-exports used throughout the app
export const { signIn, signOut, useSession } = authClient

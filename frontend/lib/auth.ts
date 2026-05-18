/**
 * Better Auth — server-side config.
 * Only imported in Server Components and API routes (never in 'use client').
 */

import { betterAuth } from "better-auth"

export const auth = betterAuth({
  // Secret used to sign sessions — must match BETTER_AUTH_SECRET in .env.local
  secret: process.env.BETTER_AUTH_SECRET!,

  // Base URL for redirect callbacks
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  // Where to redirect after login / logout
  redirects: {
    afterSignIn: "/dashboard/dataset",
    afterSignOut: "/login",
  },
})

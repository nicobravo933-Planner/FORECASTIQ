/**
 * Better Auth — server-side config.
 * Only imported in Server Components and API routes (never in 'use client').
 */

import { betterAuth } from "better-auth"
import { anonymous } from "better-auth/plugins"
import { Pool } from "pg"

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Conexión a Supabase PostgreSQL
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

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

  redirects: {
    afterSignIn: "/dashboard/dataset",
    afterSignOut: "/login",
  },

  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log(`Guest ${anonymousUser.user.id} linked to ${newUser.user.id}`)
      },
    }),
  ],
})

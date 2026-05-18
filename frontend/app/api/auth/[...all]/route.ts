/**
 * Better Auth catch-all route handler.
 * Handles all OAuth callbacks and session endpoints:
 *   GET/POST /api/auth/callback/google
 *   GET/POST /api/auth/callback/github
 *   GET      /api/auth/session
 *   POST     /api/auth/sign-out
 */

import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)

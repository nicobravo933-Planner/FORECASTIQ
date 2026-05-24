/**
 * Better Auth catch-all route handler.
 * Handles all OAuth callbacks and session endpoints:
 *   GET/POST /api/auth/callback/google
 *   GET/POST /api/auth/callback/github
 *   GET      /api/auth/session
 *   POST     /api/auth/sign-out
 *   POST     /api/auth/sign-in/anonymous
 */

import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
import { type NextRequest } from "next/server"

const handler = toNextJsHandler(auth)

export async function GET(req: NextRequest) {
  try {
    return await handler.GET(req)
  } catch (e) {
    console.error("[better-auth] GET error:", e)
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handler.POST(req)
  } catch (e) {
    console.error("[better-auth] POST error:", e)
    throw e
  }
}

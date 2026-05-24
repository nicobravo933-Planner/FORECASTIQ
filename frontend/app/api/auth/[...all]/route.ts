/**
 * Better Auth catch-all route handler.
 */

import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
import { type NextRequest, NextResponse } from "next/server"

const handler = toNextJsHandler(auth)

export async function GET(req: NextRequest) {
  console.log("[auth] GET", req.nextUrl.pathname)
  try {
    return await handler.GET(req)
  } catch (e) {
    console.error("[auth] GET error:", String(e))
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  console.log("[auth] POST", req.nextUrl.pathname)
  console.log("[auth] DATABASE_URL set:", !!process.env.DATABASE_URL)
  console.log("[auth] BETTER_AUTH_SECRET set:", !!process.env.BETTER_AUTH_SECRET)
  try {
    const res = await handler.POST(req)
    console.log("[auth] POST response status:", res.status)
    return res
  } catch (e) {
    console.error("[auth] POST error:", String(e))
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

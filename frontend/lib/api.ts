/**
 * Typed fetch client — all API calls go through here.
 * Base URL is injected from environment variable.
 * Automatically attaches the Better Auth session token as Bearer when available.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/**
 * Fetches the current session token from Better Auth.
 * Returns null if the user is not logged in.
 * Only runs in the browser (no SSR calls to /api/auth/get-session).
 */
async function getSessionToken(): Promise<string | null> {
  if (typeof window === "undefined") return null
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" })
    if (!res.ok) return null
    const data = await res.json()
    // Better Auth returns { session: { token: string } | null }
    return (data?.session?.token as string) ?? null
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 120_000): Promise<T> {
  const token = await getSessionToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  // Abort controller para timeout configurable (DuckDB puede tardar 30-90s)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: controller.signal })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }))
      throw new ApiError(res.status, body.detail ?? "Unknown error")
    }
    return res.json() as Promise<T>
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new ApiError(504, `Timeout: la solicitud tardó más de ${timeoutMs / 1000}s`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: "GET", ...init }),

  post: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), ...init }),

  delete: <T = void>(path: string, init?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...init }),

  patch: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), ...init }),

  // Multipart upload — does NOT set Content-Type (browser sets boundary automatically)
  upload: <T>(path: string, formData: FormData): Promise<T> =>
    getSessionToken().then((token) =>
      fetch(`${BASE_URL}${path}`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ detail: res.statusText }))
          throw new ApiError(res.status, body.detail ?? "Unknown error")
        }
        return res.json() as Promise<T>
      })
    ),
}

export { ApiError }

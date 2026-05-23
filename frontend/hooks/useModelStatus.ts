"use client"

/**
 * useModelStatus — tests if the selected LLM is reachable by sending
 * a tiny probe message to the backend. Returns online/offline/checking.
 *
 * Retests automatically when the model changes.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { LlmModelId } from "@/lib/types"

export type ModelStatus = "checking" | "online" | "offline"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// Context window sizes per model (in tokens)
export const MODEL_CONTEXT: Record<LlmModelId, number> = {
  "openrouter/owl-alpha":                   32_000,
  "nvidia/nemotron-3-super-120b-a12b:free": 128_000,
  "poolside/laguna-m.1:free":               32_000,
  "openai/gpt-oss-120b:free":               128_000,
  "z-ai/glm-4.5-air:free":                  128_000,
  "deepseek/deepseek-v4-flash:free":        64_000,
  "minimax/minimax-m2.5:free":              1_000_000,
}

export function useModelStatus(model: LlmModelId) {
  const [status, setStatus] = useState<ModelStatus>("checking")
  const abortRef = useRef<AbortController | null>(null)

  const check = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setStatus("checking")
    try {
      const res = await fetch(`${BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "ping",
          history: [],
          model,
          dataset_id: null,
          job_id: null,
        }),
        signal: abortRef.current.signal,
      })
      setStatus(res.ok ? "online" : "offline")
      // Consume and discard the stream body so the connection closes cleanly
      await res.body?.cancel()
    } catch {
      setStatus("offline")
    }
  }, [model])

  useEffect(() => {
    void check()
    return () => abortRef.current?.abort()
  }, [check])

  return { status, recheck: check }
}

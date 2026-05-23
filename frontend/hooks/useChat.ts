"use client"

/**
 * useChat — SSE streaming hook for AI chat.
 *
 * Manages message state, streams tokens from the backend SSE endpoint,
 * handles tool call events, and extracts follow-up suggestions.
 */

import { useCallback, useRef, useState } from "react"
import type { ChatMessage, LlmModelId, SseEvent } from "@/lib/types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface UseChatOptions {
  datasetId?: string | null
  jobId?: string | null
}

interface UseChatReturn {
  messages: ChatMessage[]
  suggestions: string[]
  isStreaming: boolean
  activeToolCall: string | null
  error: string | null
  tokensUsed: number
  sendMessage: (text: string, model: LlmModelId) => Promise<void>
  clearMessages: () => void
}

export function useChat({ datasetId, jobId }: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tokensUsed, setTokensUsed] = useState(0)

  // Ref to abort in-flight SSE fetch
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (text: string, model: LlmModelId) => {
      if (isStreaming || !text.trim()) return

      // Abort any previous stream
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      setError(null)
      setSuggestions([])
      setActiveToolCall(null)

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        created_at: new Date().toISOString(),
      }

      // Placeholder for streaming assistant response
      const assistantId = crypto.randomUUID()
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
      setIsStreaming(true)

      // Build history (exclude the placeholder just added)
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      try {
        const res = await fetch(`${BASE_URL}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            history,
            model,
            dataset_id: datasetId ?? null,
            job_id: jobId ?? null,
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `HTTP ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            let event: SseEvent
            try {
              event = JSON.parse(raw)
            } catch {
              continue
            }

            switch (event.type) {
              case "token":
                // Append token to assistant message
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + (event.content ?? "") }
                      : m,
                  ),
                )
                // Estimate tokens (4 chars ≈ 1 token)
                setTokensUsed((prev) => prev + Math.ceil((event.content?.length ?? 0) / 4))
                break

              case "tool_call":
                setActiveToolCall(event.tool ?? null)
                break

              case "tool_result":
                setActiveToolCall(null)
                break

              case "suggestions":
                setSuggestions(event.items ?? [])
                break

              case "error":
                setError(event.message ?? "Unknown error")
                break

              case "done":
                // Mark assistant message as no longer streaming
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m,
                  ),
                )
                break
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        const msg = err instanceof Error ? err.message : "Connection error"
        setError(msg)
        // Mark placeholder as failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${msg}`, isStreaming: false }
              : m,
          ),
        )
      } finally {
        setIsStreaming(false)
        setActiveToolCall(null)
      }
    },
    [isStreaming, messages, datasetId, jobId],
  )

  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setSuggestions([])
    setError(null)
    setActiveToolCall(null)
    setTokensUsed(0)
  }, [])

  return {
    messages,
    suggestions,
    isStreaming,
    activeToolCall,
    error,
    tokensUsed,
    sendMessage,
    clearMessages,
  }
}

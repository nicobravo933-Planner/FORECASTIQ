"use client"

/**
 * useConversations — CRUD hook for chat conversation history.
 *
 * Authenticated users: persists to Supabase via backend API.
 * Anonymous users: localStorage fallback (key: "fiq_conversations").
 *
 * Auto-save flow:
 *   1. After the SSE "done" event fires in useChat, call saveConversation()
 *   2. First save → creates new conversation, stores id in component state
 *   3. Subsequent saves → updates existing conversation (upsert by id)
 */

import { useCallback, useEffect, useState } from "react"
import type { ChatConversation, ChatConversationDetail, ChatMessage, LlmModelId } from "@/lib/types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const LS_KEY = "fiq_conversations"
const MAX_LOCAL = 20 // max conversations stored in localStorage

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derives a conversation title from the first user message (max 60 chars). */
export function deriveTitleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")
  if (!first) return "Nueva conversación"
  const text = first.content.trim().replace(/\s+/g, " ")
  return text.length > 60 ? text.slice(0, 57) + "…" : text
}

/** Returns auth header from localStorage Better Auth token. */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  // Better Auth stores the session token in localStorage under "better-auth.session_token"
  const token =
    localStorage.getItem("better-auth.session_token") ??
    localStorage.getItem("better_auth_token") ??
    ""
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

function isAuthenticated(): boolean {
  return Object.keys(getAuthHeaders()).length > 0
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadLocalConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ChatConversation[]
  } catch {
    return []
  }
}

function saveLocalConversations(list: ChatConversation[]): void {
  try {
    // Keep only the most recent MAX_LOCAL conversations
    const trimmed = list.slice(0, MAX_LOCAL)
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed))
  } catch {
    // quota exceeded — silently ignore
  }
}

function loadLocalMessages(id: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${id}`)
    if (!raw) return []
    return JSON.parse(raw) as ChatMessage[]
  } catch {
    return []
  }
}

function saveLocalMessages(id: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(`${LS_KEY}:${id}`, JSON.stringify(messages))
  } catch {
    // quota exceeded — silently ignore
  }
}

function deleteLocalConversation(id: string): void {
  localStorage.removeItem(`${LS_KEY}:${id}`)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseConversationsReturn {
  conversations: ChatConversation[]
  isLoading: boolean
  /** Save (create or update) a conversation after messages change. */
  saveConversation: (params: {
    conversationId: string | null
    messages: ChatMessage[]
    model: LlmModelId | null
  }) => Promise<string | null>
  /** Load full conversation (with messages) by id. */
  loadConversation: (id: string) => Promise<ChatConversationDetail | null>
  /** Delete a conversation. */
  deleteConversation: (id: string) => Promise<void>
  /** Refresh the conversation list. */
  refresh: () => Promise<void>
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load list on mount
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isAuthenticated()) {
        const res = await fetch(`${BASE_URL}/api/chat/conversations`, {
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        })
        if (res.ok) {
          const data = (await res.json()) as ChatConversation[]
          setConversations(data)
          return
        }
      }
      // Fallback: localStorage
      setConversations(loadLocalConversations())
    } catch {
      setConversations(loadLocalConversations())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveConversation = useCallback(
    async ({
      conversationId,
      messages,
      model,
    }: {
      conversationId: string | null
      messages: ChatMessage[]
      model: LlmModelId | null
    }): Promise<string | null> => {
      if (messages.length === 0) return null
      const title = deriveTitleFromMessages(messages)
      // Strip isStreaming flag before persisting
      const clean = messages.map(({ isStreaming: _s, ...m }) => m)

      if (isAuthenticated()) {
        try {
          const res = await fetch(`${BASE_URL}/api/chat/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({
              conversation_id: conversationId,
              title,
              messages: clean,
              model_id: model,
            }),
          })
          if (res.ok) {
            const data = (await res.json()) as { conversation_id: string }
            await refresh()
            return data.conversation_id
          }
        } catch {
          // fall through to localStorage
        }
      }

      // localStorage fallback
      const now = new Date().toISOString()
      const id = conversationId ?? crypto.randomUUID()
      saveLocalMessages(id, clean)
      const existing = loadLocalConversations()
      const filtered = existing.filter((c) => c.id !== id)
      const updated: ChatConversation = {
        id,
        title,
        model_id: model,
        created_at: existing.find((c) => c.id === id)?.created_at ?? now,
        updated_at: now,
      }
      saveLocalConversations([updated, ...filtered])
      setConversations([updated, ...filtered])
      return id
    },
    [refresh],
  )

  const loadConversation = useCallback(
    async (id: string): Promise<ChatConversationDetail | null> => {
      if (isAuthenticated()) {
        try {
          const res = await fetch(`${BASE_URL}/api/chat/conversations/${id}`, {
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          })
          if (res.ok) return (await res.json()) as ChatConversationDetail
        } catch {
          // fall through
        }
      }
      // localStorage fallback
      const meta = loadLocalConversations().find((c) => c.id === id)
      if (!meta) return null
      return { ...meta, messages: loadLocalMessages(id) }
    },
    [],
  )

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      if (isAuthenticated()) {
        try {
          await fetch(`${BASE_URL}/api/chat/conversations/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          })
        } catch {
          // fall through
        }
      }
      // Always clean localStorage too
      deleteLocalConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    },
    [],
  )

  return {
    conversations,
    isLoading,
    saveConversation,
    loadConversation,
    deleteConversation,
    refresh,
  }
}

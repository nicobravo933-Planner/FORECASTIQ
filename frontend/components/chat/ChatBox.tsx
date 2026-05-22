"use client"

/**
 * ChatBox — scrollable message list with welcome screen and thinking indicator.
 *
 * Empty state: WelcomeScreen with quick-action cards.
 * Thinking: animated dots → step label (mirrors think-bubble from chat.html).
 * Auto-scrolls to bottom on new content.
 */

import { useEffect, useRef } from "react"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import BoltIcon from "@mui/icons-material/Bolt"
import type { ChatMessage } from "@/lib/types"
import { MessageBubble } from "./MessageBubble"
import { WelcomeScreen } from "./WelcomeScreen"

// ── Tool → human-readable step label ────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  query_dataset:        "Consultando dataset…",
  get_forecast_summary: "Leyendo métricas del forecast…",
  get_events:           "Cargando eventos del calendario…",
  suggest_model_change: "Analizando rendimiento del modelo…",
}

// ── Animated dots ────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <Stack direction="row" alignItems="center" spacing="0.25rem">
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: "0.4375rem",
            height: "0.4375rem",
            borderRadius: "50%",
            bgcolor: "primary.main",
            animation: "dotBounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
            "@keyframes dotBounce": {
              "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.35 },
              "30%":           { transform: "translateY(-0.3125rem)", opacity: 1 },
            },
          }}
        />
      ))}
    </Stack>
  )
}

// ── Thinking indicator (inside scroll, left-aligned with avatar) ─────────
function ThinkingIndicator({ toolCall }: { toolCall: string | null }) {
  const label = toolCall ? (TOOL_LABELS[toolCall] ?? `Ejecutando ${toolCall}…`) : "Analizando…"
  const hasToolCall = Boolean(toolCall)

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.625rem",
        px: { xs: "0.5rem", sm: "0.75rem" },
        animation: "msgInAi 0.2s ease",
        "@keyframes msgInAi": {
          from: { opacity: 0, transform: "translateX(-0.875rem) scale(0.97)" },
          to:   { opacity: 1, transform: "translateX(0) scale(1)" },
        },
      }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: "2.125rem",
          height: "2.125rem",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          mt: "0.125rem",
          boxShadow: "0 0.125rem 0.5rem rgba(99,102,241,0.3)",
        }}
      >
        <BoltIcon
          sx={{
            fontSize: "1.125rem",
            color: "white",
            animation: hasToolCall ? "zapPulse 1.2s ease-in-out infinite" : "none",
            "@keyframes zapPulse": {
              "0%, 100%": { opacity: 1, transform: "scale(1)" },
              "50%":      { opacity: 0.6, transform: "scale(0.85)" },
            },
          }}
        />
      </Box>

      {/* Bubble */}
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: hasToolCall ? "primary.dark" : "divider",
          borderRadius: "0.25rem 1rem 1rem 1rem",
          px: "0.875rem",
          py: "0.625rem",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          boxShadow: 1,
          transition: "border-color 0.15s",
        }}
      >
        {hasToolCall ? (
          <BoltIcon sx={{ fontSize: "0.875rem", color: "primary.main" }} />
        ) : (
          <ThinkingDots />
        )}
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "text.secondary" }}>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

// ── ChatBox ──────────────────────────────────────────────────────────────
interface ChatBoxProps {
  messages: ChatMessage[]
  activeToolCall: string | null
  isStreaming?: boolean
  onQuickSelect?: (prompt: string) => void
}

export function ChatBox({ messages, activeToolCall, isStreaming, onQuickSelect }: ChatBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeToolCall, isStreaming])

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        py: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        "&::-webkit-scrollbar": { width: "0.25rem" },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: "0.25rem" },
      }}
    >
      {/* Welcome screen — shown when no messages */}
      {messages.length === 0 && !isStreaming && (
        <WelcomeScreen onSelect={onQuickSelect ?? (() => {})} />
      )}

      {/* Messages */}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Thinking indicator — shown while streaming before first token */}
      {isStreaming && (
        <ThinkingIndicator toolCall={activeToolCall} />
      )}

      <div ref={bottomRef} />
    </Box>
  )
}

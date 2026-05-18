"use client"

/**
 * ChatBox — scrollable message list with auto-scroll on new tokens.
 * Shows tool call indicator when the LLM is executing a tool.
 */

import { useEffect, useRef } from "react"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import type { ChatMessage } from "@/lib/types"
import { MessageBubble } from "./MessageBubble"

interface ChatBoxProps {
  messages: ChatMessage[]
  activeToolCall: string | null
}

const TOOL_LABELS: Record<string, string> = {
  query_dataset:       "Querying dataset…",
  get_forecast_summary: "Reading forecast metrics…",
  get_events:          "Loading calendar events…",
  suggest_model_change: "Analyzing model performance…",
}

export function ChatBox({ messages, activeToolCall }: ChatBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeToolCall])

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        px: { xs: "1rem", sm: "1.5rem" },
        py: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        // Thin scrollbar
        "&::-webkit-scrollbar": { width: "0.375rem" },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: "divider",
          borderRadius: "0.25rem",
        },
      }}
    >
      {messages.length === 0 && (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.disabled" sx={{ fontSize: "0.9375rem" }}>
            Ask anything about your data or forecast.
          </Typography>
        </Box>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Tool call indicator */}
      {activeToolCall && (
        <Stack direction="row" alignItems="center" spacing="0.5rem" sx={{ pl: "0.25rem" }}>
          <CircularProgress size="0.875rem" thickness={5} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
            {TOOL_LABELS[activeToolCall] ?? `Running ${activeToolCall}…`}
          </Typography>
        </Stack>
      )}

      <div ref={bottomRef} />
    </Box>
  )
}

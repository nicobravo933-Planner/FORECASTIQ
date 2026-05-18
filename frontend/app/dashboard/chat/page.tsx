"use client"

/**
 * Chat page — AI assistant with SSE streaming.
 *
 * Layout: top bar (title + model selector) | chat area | input bar + suggestions
 */

import { useRef, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import SendIcon from "@mui/icons-material/Send"
import { ChatBox } from "@/components/chat/ChatBox"
import { ModelSelector } from "@/components/chat/ModelSelector"
import { QuickQuestions } from "@/components/chat/QuickQuestions"
import { useChat } from "@/hooks/useChat"
import { FREE_MODELS, type LlmModelId } from "@/lib/types"

// TODO Phase 5: inject from user session / forecast context
const DEMO_DATASET_ID: string | null = null
const DEMO_JOB_ID: string | null = null

export default function ChatPage() {
  const [model, setModel] = useState<LlmModelId>(FREE_MODELS[5].id) // DeepSeek V4 Flash default
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, suggestions, isStreaming, activeToolCall, error, sendMessage, clearMessages } =
    useChat({ datasetId: DEMO_DATASET_ID, jobId: DEMO_JOB_ID })

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || isStreaming) return
    setInput("")
    await sendMessage(msg, model)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 4rem)", // full height minus topbar
        bgcolor: "background.default",
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: "1.5rem", py: "0.75rem", borderBottom: 1, borderColor: "divider" }}
      >
        <Stack>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.125rem" }}>
            AI Assistant
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
            Ask questions about your data and forecast
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing="0.75rem">
          <ModelSelector value={model} onChange={setModel} disabled={isStreaming} />
          <Tooltip title="Clear conversation">
            <span>
              <IconButton
                size="small"
                onClick={clearMessages}
                disabled={isStreaming || messages.length === 0}
                sx={{ color: "text.secondary" }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mx: "1.5rem", mt: "0.75rem", fontSize: "0.875rem" }}>
          {error}
        </Alert>
      )}

      {/* ── Messages ─────────────────────────────────────────── */}
      <ChatBox messages={messages} activeToolCall={activeToolCall} />

      <Divider />

      {/* ── Quick questions ───────────────────────────────────── */}
      <Box sx={{ px: "1.5rem", pt: "0.75rem", pb: "0.25rem" }}>
        <QuickQuestions
          suggestions={suggestions.length > 0 ? suggestions : undefined}
          onSelect={(q) => void handleSend(q)}
          disabled={isStreaming}
        />
      </Box>

      {/* ── Input bar ────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="flex-end"
        spacing="0.75rem"
        sx={{ px: "1.5rem", py: "1rem" }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={5}
          placeholder="Ask about your data, forecast accuracy, seasonality…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": { borderRadius: "0.75rem", fontSize: "0.9375rem" },
          }}
        />
        <Tooltip title={isStreaming ? "Streaming…" : "Send (Enter)"}>
          <span>
            <IconButton
              color="primary"
              disabled={!input.trim() || isStreaming}
              onClick={() => void handleSend()}
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "0.75rem",
                "&:hover": { bgcolor: "primary.dark" },
                "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
              }}
            >
              <SendIcon sx={{ fontSize: "1.125rem" }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  )
}

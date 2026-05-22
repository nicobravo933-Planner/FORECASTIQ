"use client"

/**
 * FloatingChat — global FAB + slide-in Drawer chat.
 *
 * Mounted once in dashboard/layout.tsx so it persists across all routes.
 * Hidden on /dashboard/chat (the full chat page already covers this).
 * Reuses useChat, ChatBox, QuickQuestions — no logic duplication.
 */

import { useEffect, useRef, useState } from "react"
import Badge from "@mui/material/Badge"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import Drawer from "@mui/material/Drawer"
import Fab from "@mui/material/Fab"
import IconButton from "@mui/material/IconButton"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import ChatIcon from "@mui/icons-material/Chat"
import CloseIcon from "@mui/icons-material/Close"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import SendIcon from "@mui/icons-material/Send"
import { usePathname } from "next/navigation"
import { ChatBox } from "./ChatBox"
import { ModelSelector } from "./ModelSelector"
import { QuickQuestions } from "./QuickQuestions"
import { useChat } from "@/hooks/useChat"
import { appStore } from "@/lib/appStore"
import { FREE_MODELS, type LlmModelId } from "@/lib/types"

const DRAWER_WIDTH = "22rem"

export function FloatingChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState<LlmModelId>(FREE_MODELS[5].id)
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const ctx = appStore.getChatContext()
      setDatasetId(ctx.datasetId)
      setJobId(ctx.jobId)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  const { messages, suggestions, isStreaming, activeToolCall, error, sendMessage, clearMessages } =
    useChat({ datasetId, jobId })

  if (pathname === "/dashboard/chat") return null

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

  const handleClose = () => {
    setOpen(false)
    setInput("")
  }

  const unread = messages.filter((m) => m.role === "assistant").length

  return (
    <>
      {/* ── FAB ───────────────────────────────────────────────── */}
      {!open && (
        <Tooltip title="Chat con IA" placement="left">
          <Badge
            badgeContent={unread > 0 ? unread : null}
            color="secondary"
            overlap="circular"
            sx={{ position: "fixed", bottom: "2rem", right: "2rem", zIndex: 1300 }}
          >
            <Fab
              color="primary"
              onClick={() => setOpen(true)}
              aria-label="Abrir chat IA"
              sx={{
                boxShadow: 6,
                "&:hover": { transform: "scale(1.05)" },
                transition: "transform 0.15s ease",
              }}
            >
              <ChatIcon />
            </Fab>
          </Badge>
        </Tooltip>
      )}

      {/* ── Drawer ────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        sx={{
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            maxWidth: "100vw",
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            boxShadow: 8,
          },
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: "1rem", py: "0.625rem", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}
        >
          <Stack direction="row" alignItems="center" spacing="0.5rem">
            <ChatIcon sx={{ fontSize: "1.125rem", color: "primary.main" }} />
            <Typography fontWeight={600} sx={{ fontSize: "0.9375rem" }}>
              Chat IA
            </Typography>
            {datasetId && (
              <Box sx={{ bgcolor: "success.main", borderRadius: "0.75rem", px: "0.5rem", py: "0.125rem" }}>
                <Typography sx={{ fontSize: "0.625rem", color: "success.contrastText", fontWeight: 600 }}>
                  dataset activo
                </Typography>
              </Box>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing="0.25rem">
            <Tooltip title="Limpiar conversación">
              <span>
                <IconButton
                  size="small"
                  onClick={clearMessages}
                  disabled={isStreaming || messages.length === 0}
                  sx={{ color: "text.secondary" }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Cerrar">
              <IconButton size="small" onClick={handleClose} sx={{ color: "text.secondary" }}>
                <CloseIcon sx={{ fontSize: "1rem" }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* ── Model selector ──────────────────────────────────── */}
        <Box sx={{ px: "1rem", py: "0.5rem", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
          <ModelSelector value={model} onChange={setModel} disabled={isStreaming} />
        </Box>

        {/* ── Messages ────────────────────────────────────────── */}
        <ChatBox
          messages={messages}
          activeToolCall={activeToolCall}
          isStreaming={isStreaming}
          onQuickSelect={(q) => void handleSend(q)}
        />

        {/* ── Error ───────────────────────────────────────────── */}
        {error && (
          <Box sx={{ px: "1rem", pb: "0.5rem", flexShrink: 0 }}>
            <Typography color="error" sx={{ fontSize: "0.8125rem" }}>⚠️ {error}</Typography>
          </Box>
        )}

        <Divider />

        {/* ── Follow-up chips ─────────────────────────────────── */}
        {suggestions.length > 0 && (
          <Box sx={{ px: "1rem", pt: "0.625rem", pb: "0.25rem", flexShrink: 0 }}>
            <QuickQuestions
              suggestions={suggestions}
              onSelect={(q) => void handleSend(q)}
              disabled={isStreaming}
            />
          </Box>
        )}

        {/* ── Input bar ───────────────────────────────────────── */}
        <Stack
          direction="row"
          alignItems="flex-end"
          spacing="0.5rem"
          sx={{ px: "1rem", py: "0.75rem", flexShrink: 0 }}
        >
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder="Preguntá sobre tus datos…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            size="small"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "0.75rem", fontSize: "0.875rem" } }}
          />
          <Tooltip title={isStreaming ? "Procesando…" : "Enviar (Enter)"}>
            <span>
              <IconButton
                color="primary"
                disabled={!input.trim() || isStreaming}
                onClick={() => void handleSend()}
                sx={{
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  width: "2.25rem",
                  height: "2.25rem",
                  borderRadius: "0.75rem",
                  flexShrink: 0,
                  "&:hover": { bgcolor: "primary.dark" },
                  "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
                }}
              >
                <SendIcon sx={{ fontSize: "1rem" }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Drawer>
    </>
  )
}

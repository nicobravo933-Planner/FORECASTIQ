"use client"

/**
 * FloatingChat — FAB robot + burbuja chat expandida.
 *
 * FAB: cara de robot (Lottie) + pulso verde "online"
 * Bubble: 28rem × 30rem, sin WelcomeScreen (chat simple)
 * Lottie: sin fondo circular, transparente
 */

import { useEffect, useRef, useState } from "react"
import Box from "@mui/material/Box"
import ClickAwayListener from "@mui/material/ClickAwayListener"
import Divider from "@mui/material/Divider"
import Fab from "@mui/material/Fab"
import Grow from "@mui/material/Grow"
import IconButton from "@mui/material/IconButton"
import Paper from "@mui/material/Paper"
import Popper from "@mui/material/Popper"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import CloseIcon from "@mui/icons-material/Close"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import OpenInFullIcon from "@mui/icons-material/OpenInFull"
import SendIcon from "@mui/icons-material/Send"
import { usePathname, useRouter } from "next/navigation"
import { ChatBox } from "./ChatBox"
import { ModelSelector } from "./ModelSelector"
import { QuickQuestions } from "./QuickQuestions"
import { RobotAvatar } from "./RobotAvatar"
import { useChat } from "@/hooks/useChat"
import { appStore } from "@/lib/appStore"
import { getPreferredModel } from "@/lib/preferredModel"
import { type LlmModelId } from "@/lib/types"

const BUBBLE_WIDTH  = "28rem"
const BUBBLE_HEIGHT = "30rem"

// ── Simple empty state for the floating bubble (no welcome screen) ────────
function BubbleEmptyState() {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        px: "1.5rem",
        textAlign: "center",
        opacity: 0.6,
      }}
    >
      <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
        Preguntá sobre tus datos, el forecast o los modelos ML
      </Typography>
    </Box>
  )
}

// ── Robot FAB con luz verde online ────────────────────────────────────────
function RobotFab({
  fabRef,
  open,
  unread,
  onClick,
}: {
  fabRef: React.RefObject<HTMLButtonElement>
  open: boolean
  unread: number
  onClick: () => void
}) {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      {/* Pulse verde online — solo cuando está cerrado */}
      {!open && (
        <>
          <Box
            sx={{
              position: "absolute",
              bottom: "0.125rem",
              right: "0.125rem",
              width: "0.75rem",
              height: "0.75rem",
              borderRadius: "50%",
              bgcolor: "#10b981",
              border: "2px solid",
              borderColor: "background.default",
              zIndex: 2,
              animation: "greenPulse 2s ease-in-out infinite",
              "@keyframes greenPulse": {
                "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.7)" },
                "50%":      { boxShadow: "0 0 0 0.375rem rgba(16,185,129,0)" },
              },
            }}
          />
          {/* Badge de mensajes no leídos */}
          {unread > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: "-0.25rem",
                right: "-0.25rem",
                width: "1.25rem",
                height: "1.25rem",
                borderRadius: "50%",
                bgcolor: "error.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3,
                fontSize: "0.625rem",
                fontWeight: 700,
                color: "white",
              }}
            >
              {unread}
            </Box>
          )}
        </>
      )}

      <Tooltip title={open ? "" : "Chat IA"} placement="left">
        <Fab
          ref={fabRef}
          onClick={onClick}
          aria-label="Abrir chat IA"
          sx={{
            width: "3.5rem",
            height: "3.5rem",
            background: open
              ? "rgba(17,24,39,0.95)"
              : "linear-gradient(135deg, #1e3a6e 0%, #1e40af 100%)",
            boxShadow: open
              ? "0 0.25rem 1rem rgba(0,0,0,0.4)"
              : "0 0.25rem 1rem rgba(59,130,246,0.45), 0 0 0 1px rgba(59,130,246,0.2)",
            border: "1px solid rgba(59,130,246,0.3)",
            overflow: "visible",
            "&:hover": {
              transform: "scale(1.06)",
              boxShadow: "0 0.5rem 1.5rem rgba(59,130,246,0.6)",
            },
            transition: "all 0.2s ease",
            p: 0,
          }}
        >
          {open ? (
            <CloseIcon sx={{ fontSize: "1.25rem", color: "white" }} />
          ) : (
            // Lottie robot sin fondo
            <Box sx={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", overflow: "hidden" }}>
              <RobotAvatar size={56} transparent />
            </Box>
          )}
        </Fab>
      </Tooltip>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export function FloatingChat() {
  const pathname = usePathname()
  const router   = useRouter()
  const fabRef   = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen]   = useState(false)
  const [model, setModel] = useState<LlmModelId>(getPreferredModel)
  const [input, setInput] = useState("")

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [jobId, setJobId]         = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const ctx = appStore.getChatContext()
      setDatasetId(ctx.datasetId)
      setJobId(ctx.jobId)
      setTimeout(() => inputRef.current?.focus(), 200)
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

  const handleClose = () => { setOpen(false); setInput("") }
  const handleExpand = () => { handleClose(); router.push("/dashboard/chat") }
  const unread = messages.filter((m) => m.role === "assistant").length

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Box sx={{ position: "fixed", bottom: "1.75rem", right: "1.75rem", zIndex: 1300 }}>

        {/* ── Bubble ─────────────────────────────────────────── */}
        <Popper
          open={open}
          anchorEl={fabRef.current}
          placement="top-end"
          transition
          modifiers={[{ name: "offset", options: { offset: [0, 12] } }]}
          style={{ zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps} style={{ transformOrigin: "bottom right" }}>
              <Paper
                elevation={8}
                sx={{
                  width: BUBBLE_WIDTH,
                  height: BUBBLE_HEIGHT,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "1rem",
                  overflow: "hidden",
                  border: "1px solid rgba(59,130,246,0.25)",
                  boxShadow: "0 1rem 3rem rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1)",
                }}
              >
                {/* Header */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing="0.5rem"
                  sx={{
                    px: "0.875rem",
                    py: "0.5rem",
                    borderBottom: "1px solid rgba(59,130,246,0.12)",
                    flexShrink: 0,
                  }}
                >
                  {/* Robot mini sin fondo */}
                  <Box sx={{ flexShrink: 0, lineHeight: 0 }}>
                    <RobotAvatar size={26} transparent />
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} sx={{ fontSize: "0.8125rem", lineHeight: 1.2 }}>
                      Chat IA
                    </Typography>
                    {datasetId && (
                      <Typography sx={{ fontSize: "0.6rem", color: "success.main", fontWeight: 600 }}>
                        ● dataset activo
                      </Typography>
                    )}
                  </Box>

                  <ModelSelector value={model} onChange={setModel} disabled={isStreaming} compact />

                  <Tooltip title="Pantalla completa">
                    <IconButton size="small" onClick={handleExpand} sx={{ color: "text.secondary" }}>
                      <OpenInFullIcon sx={{ fontSize: "0.8125rem" }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Limpiar">
                    <span>
                      <IconButton
                        size="small"
                        onClick={clearMessages}
                        disabled={isStreaming || messages.length === 0}
                        sx={{ color: "text.secondary" }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: "0.8125rem" }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton size="small" onClick={handleClose} sx={{ color: "text.secondary" }}>
                    <CloseIcon sx={{ fontSize: "0.8125rem" }} />
                  </IconButton>
                </Stack>

                {/* Messages or empty state */}
                {messages.length === 0 && !isStreaming ? (
                  <BubbleEmptyState />
                ) : (
                  <ChatBox
                    messages={messages}
                    activeToolCall={activeToolCall}
                    isStreaming={isStreaming}
                    compact
                  />
                )}

                {error && (
                  <Box sx={{ px: "0.875rem", pb: "0.375rem", flexShrink: 0 }}>
                    <Typography color="error" sx={{ fontSize: "0.75rem" }}>⚠️ {error}</Typography>
                  </Box>
                )}

                {suggestions.length > 0 && (
                  <Box sx={{ px: "0.875rem", pt: "0.375rem", pb: "0.125rem", flexShrink: 0 }}>
                    <QuickQuestions
                      suggestions={suggestions}
                      onSelect={(q) => void handleSend(q)}
                      disabled={isStreaming}
                    />
                  </Box>
                )}

                <Divider sx={{ borderColor: "rgba(59,130,246,0.1)" }} />

                {/* Input */}
                <Stack
                  direction="row"
                  alignItems="flex-end"
                  spacing="0.375rem"
                  sx={{ px: "0.75rem", py: "0.625rem", flexShrink: 0 }}
                >
                  <TextField
                    inputRef={inputRef}
                    fullWidth
                    multiline
                    maxRows={3}
                    placeholder="Preguntá sobre tus datos…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming}
                    size="small"
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "0.625rem", fontSize: "0.8125rem" } }}
                  />
                  <Tooltip title={isStreaming ? "Procesando…" : "Enviar"}>
                    <span>
                      <IconButton
                        disabled={!input.trim() || isStreaming}
                        onClick={() => void handleSend()}
                        sx={{
                          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                          color: "white",
                          width: "2rem",
                          height: "2rem",
                          borderRadius: "0.625rem",
                          flexShrink: 0,
                          "&:hover": { background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)" },
                          "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
                        }}
                      >
                        <SendIcon sx={{ fontSize: "0.875rem" }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Paper>
            </Grow>
          )}
        </Popper>

        {/* ── FAB robot ────────────────────────────────────────── */}
        <RobotFab
          fabRef={fabRef}
          open={open}
          unread={unread}
          onClick={() => setOpen((v) => !v)}
        />

      </Box>
    </ClickAwayListener>
  )
}

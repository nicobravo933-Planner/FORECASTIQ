"use client"

/**
 * FloatingChat — FAB + bubble chat expandida estilo ecommerce.
 *
 * - FAB fijo abajo-derecha
 * - Al hacer clic: burbuja expandida (Popper+Grow) anclada encima del FAB
 * - NO es un sidebar/Drawer — es un panel flotante 22rem × 36rem
 * - Hidden en /dashboard/chat (página completa ya lo cubre)
 */

import { useEffect, useRef, useState } from "react"
import Badge from "@mui/material/Badge"
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
import ChatIcon from "@mui/icons-material/Chat"
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

const BUBBLE_WIDTH  = "22rem"
const BUBBLE_HEIGHT = "36rem"

export function FloatingChat() {
  const pathname  = usePathname()
  const router    = useRouter()
  const fabRef    = useRef<HTMLButtonElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const [open, setOpen]   = useState(false)
  const [model, setModel] = useState<LlmModelId>(getPreferredModel)
  const [input, setInput] = useState("")

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [jobId, setJobId]         = useState<string | null>(null)

  // Refresh context each time bubble opens
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

  // Hidden on full chat page — redundant there
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

  const handleExpand = () => {
    handleClose()
    router.push("/dashboard/chat")
  }

  const unread = messages.filter((m) => m.role === "assistant").length

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Box sx={{ position: "fixed", bottom: "1.75rem", right: "1.75rem", zIndex: 1300 }}>

        {/* ── Bubble panel ─────────────────────────────────────── */}
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
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {/* Header */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing="0.5rem"
                  sx={{
                    px: "0.875rem",
                    py: "0.625rem",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    flexShrink: 0,
                  }}
                >
                  <RobotAvatar size={28} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} sx={{ fontSize: "0.875rem", lineHeight: 1.2 }}>
                      Chat IA
                    </Typography>
                    {datasetId && (
                      <Typography sx={{ fontSize: "0.625rem", color: "success.main", fontWeight: 600 }}>
                        ● dataset activo
                      </Typography>
                    )}
                  </Box>

                  <ModelSelector value={model} onChange={setModel} disabled={isStreaming} compact />

                  <Tooltip title="Abrir pantalla completa">
                    <IconButton size="small" onClick={handleExpand} sx={{ color: "text.secondary" }}>
                      <OpenInFullIcon sx={{ fontSize: "0.875rem" }} />
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
                        <DeleteOutlineIcon sx={{ fontSize: "0.875rem" }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton size="small" onClick={handleClose} sx={{ color: "text.secondary" }}>
                    <CloseIcon sx={{ fontSize: "0.875rem" }} />
                  </IconButton>
                </Stack>

                {/* Messages */}
                <ChatBox
                  messages={messages}
                  activeToolCall={activeToolCall}
                  isStreaming={isStreaming}
                  onQuickSelect={(q) => void handleSend(q)}
                  compact
                />

                {/* Error */}
                {error && (
                  <Box sx={{ px: "0.875rem", pb: "0.375rem", flexShrink: 0 }}>
                    <Typography color="error" sx={{ fontSize: "0.75rem" }}>⚠️ {error}</Typography>
                  </Box>
                )}

                {/* Follow-up chips */}
                {suggestions.length > 0 && (
                  <Box sx={{ px: "0.875rem", pt: "0.375rem", pb: "0.125rem", flexShrink: 0 }}>
                    <QuickQuestions
                      suggestions={suggestions}
                      onSelect={(q) => void handleSend(q)}
                      disabled={isStreaming}
                    />
                  </Box>
                )}

                <Divider />

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
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "0.625rem",
                        fontSize: "0.8125rem",
                      },
                    }}
                  />
                  <Tooltip title={isStreaming ? "Procesando…" : "Enviar"}>
                    <span>
                      <IconButton
                        disabled={!input.trim() || isStreaming}
                        onClick={() => void handleSend()}
                        sx={{
                          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                          color: "white",
                          width: "2rem",
                          height: "2rem",
                          borderRadius: "0.625rem",
                          flexShrink: 0,
                          "&:hover": { background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)" },
                          "&.Mui-disabled": { background: "action.disabledBackground" },
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

        {/* ── FAB ──────────────────────────────────────────────── */}
        <Tooltip title={open ? "" : "Chat con IA"} placement="left">
          <Badge
            badgeContent={!open && unread > 0 ? unread : null}
            color="secondary"
            overlap="circular"
          >
            <Fab
              ref={fabRef}
              color="primary"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir chat IA"
              sx={{
                background: open
                  ? "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)"
                  : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                boxShadow: "0 0.25rem 1rem rgba(99,102,241,0.45)",
                "&:hover": { transform: "scale(1.06)" },
                transition: "transform 0.15s ease, background 0.2s ease",
              }}
            >
              {open ? <CloseIcon /> : <ChatIcon />}
            </Fab>
          </Badge>
        </Tooltip>

      </Box>
    </ClickAwayListener>
  )
}

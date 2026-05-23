"use client"

/**
 * FloatingChat — FAB robot + burbuja chat expandida.
 *
 * Fix 1: FAB hover — no se pone blanco, X se pone azul
 * Fix 2: bolita online/offline en header del globo
 * Fix 3: Expandir transfiere mensajes al chat completo (no los pierde)
 *        + burbuja resizable con resize: both
 */

import { useEffect, useRef, useState } from "react"
import Box from "@mui/material/Box"
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
import SmartToyIcon from "@mui/icons-material/SmartToy"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { ChatBox } from "./ChatBox"
import { ModelSelector } from "./ModelSelector"
import { QuickQuestions } from "./QuickQuestions"
import { useChat } from "@/hooks/useChat"
import { useModelStatus } from "@/hooks/useModelStatus"
import { appStore } from "@/lib/appStore"
import { getPreferredModel } from "@/lib/preferredModel"
import { type LlmModelId } from "@/lib/types"

const BUBBLE_MIN_W = "22rem"
const BUBBLE_MIN_H = "24rem"
const BUBBLE_DEF_W = "28rem"
const BUBBLE_DEF_H = "30rem"

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: "checking" | "online" | "offline" }) {
  const color = status === "online" ? "#10b981" : status === "offline" ? "#ef4444" : "#9ca3af"
  return (
    <Box
      sx={{
        width: "0.5rem",
        height: "0.5rem",
        borderRadius: "50%",
        bgcolor: color,
        flexShrink: 0,
        ...(status !== "checking" && {
          animation: "statusPulse 2s ease-in-out infinite",
          "@keyframes statusPulse": {
            "0%, 100%": { boxShadow: `0 0 0 0 ${color}80` },
            "50%":      { boxShadow: `0 0 0 0.25rem ${color}00` },
          },
        }),
      }}
    />
  )
}

function BubbleEmptyState() {
  return (
    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: "1.5rem" }}>
      <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", textAlign: "center", opacity: 0.7 }}>
        Preguntá sobre tus datos, el forecast o los modelos ML
      </Typography>
    </Box>
  )
}

export function FloatingChat() {
  const pathname  = usePathname()
  const router    = useRouter()
  const fabRef    = useRef<HTMLButtonElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const [open, setOpen]   = useState(false)
  const [model, setModel] = useState<LlmModelId>(getPreferredModel)
  const [input, setInput] = useState("")

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [jobId, setJobId]         = useState<string | null>(null)

  const { status: modelStatus } = useModelStatus(model)

  // Close on outside click — ignora MUI portals (Select, Menu, etc.)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (bubbleRef.current?.contains(target)) return
      if (fabRef.current?.contains(target)) return
      const portalRoot = document.querySelector("[data-mui-portal]")
      if (portalRoot?.contains(target)) return
      const muiPopovers = document.querySelectorAll(".MuiPopover-root, .MuiMenu-root, .MuiModal-root")
      for (const el of muiPopovers) {
        if (el.contains(target)) return
      }
      setOpen(false)
      setInput("")
    }
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClick)
    }
  }, [open])

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

  // Transfiere mensajes al chat completo antes de navegar
  const handleExpand = () => {
    if (messages.length > 0) appStore.savePendingMessages(messages)
    handleClose()
    router.push("/dashboard/chat")
  }

  const unread = messages.filter((m) => m.role === "assistant").length

  return (
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
              ref={bubbleRef}
              elevation={8}
              sx={{
                width: BUBBLE_DEF_W,
                height: BUBBLE_DEF_H,
                minWidth: BUBBLE_MIN_W,
                minHeight: BUBBLE_MIN_H,
                maxWidth: "90vw",
                maxHeight: "80vh",
                // Resize libre con el handle de la esquina
                resize: "both",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                borderRadius: "1rem",
                border: "1px solid rgba(59,130,246,0.25)",
                boxShadow: "0 1rem 3rem rgba(0,0,0,0.15), 0 0 0 1px rgba(59,130,246,0.1)",
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
                  cursor: "default",
                }}
              >
                <Image src="/chip.png" alt="AI" width={33} height={33} style={{ objectFit: "contain", flexShrink: 0 }} />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing="0.375rem">
                    <Typography fontWeight={600} sx={{ fontSize: "0.8125rem", lineHeight: 1.2 }}>
                      Chat IA
                    </Typography>
                    {/* Bolita online/offline */}
                    <Tooltip title={
                      modelStatus === "online"  ? "Modelo disponible" :
                      modelStatus === "offline" ? "Modelo no disponible" :
                      "Verificando…"
                    }>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <StatusDot status={modelStatus} />
                      </Box>
                    </Tooltip>
                  </Stack>
                  {datasetId && (
                    <Typography sx={{ fontSize: "0.6rem", color: "success.main", fontWeight: 600 }}>
                      ● dataset activo
                    </Typography>
                  )}
                </Box>

                <Box onClick={(e) => e.stopPropagation()}>
                  <ModelSelector value={model} onChange={setModel} disabled={isStreaming} compact />
                </Box>

                <Tooltip title="Ampliar al chat completo (conserva conversación)">
                  <IconButton size="small" onClick={handleExpand}
                    sx={{ color: "text.secondary", "&:hover": { color: "primary.main", bgcolor: "rgba(59,130,246,0.08)" } }}>
                    <OpenInFullIcon sx={{ fontSize: "0.8125rem" }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Limpiar">
                  <span>
                    <IconButton size="small" onClick={clearMessages}
                      disabled={isStreaming || messages.length === 0}
                      sx={{ color: "text.secondary" }}>
                      <DeleteOutlineIcon sx={{ fontSize: "0.8125rem" }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton size="small" onClick={handleClose}
                  sx={{ color: "text.secondary", "&:hover": { color: "error.main", bgcolor: "rgba(239,68,68,0.08)" } }}>
                  <CloseIcon sx={{ fontSize: "0.8125rem" }} />
                </IconButton>
              </Stack>

              {messages.length === 0 && !isStreaming ? (
                <BubbleEmptyState />
              ) : (
                <ChatBox messages={messages} activeToolCall={activeToolCall} isStreaming={isStreaming} compact />
              )}

              {error && (
                <Box sx={{ px: "0.875rem", pb: "0.375rem", flexShrink: 0 }}>
                  <Typography color="error" sx={{ fontSize: "0.75rem" }}>⚠️ {error}</Typography>
                </Box>
              )}

              {suggestions.length > 0 && (
                <Box sx={{ px: "0.875rem", pt: "0.375rem", pb: "0.125rem", flexShrink: 0 }}>
                  <QuickQuestions suggestions={suggestions} onSelect={(q) => void handleSend(q)} disabled={isStreaming} />
                </Box>
              )}

              <Divider sx={{ borderColor: "rgba(59,130,246,0.1)" }} />

              <Stack direction="row" alignItems="flex-end" spacing="0.375rem"
                sx={{ px: "0.75rem", py: "0.625rem", flexShrink: 0 }}>
                <TextField
                  inputRef={inputRef}
                  fullWidth multiline maxRows={3}
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
                    <IconButton disabled={!input.trim() || isStreaming} onClick={() => void handleSend()}
                      sx={{
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        color: "white", width: "2rem", height: "2rem",
                        borderRadius: "0.625rem", flexShrink: 0,
                        "&:hover": { background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)" },
                        "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
                      }}>
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
      <Box sx={{ position: "relative", display: "inline-flex", mt: open ? 0 : "0.75rem" }}>
        {!open && unread > 0 && (
          <Box sx={{
            position: "absolute", top: "-0.375rem", right: "-0.375rem",
            width: "1.25rem", height: "1.25rem", borderRadius: "50%",
            bgcolor: "error.main", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 10, fontSize: "0.625rem",
            fontWeight: 700, color: "white", border: "2px solid",
            borderColor: "background.default", pointerEvents: "none",
          }}>
            {unread}
          </Box>
        )}

        <Tooltip title={open ? "" : "Chat IA"} placement="left">
          <Fab
            ref={fabRef}
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir chat IA"
            sx={{
              width: "3.5rem",
              height: "3.5rem",
              background: open
                ? "linear-gradient(135deg, #1e3a6e 0%, #1e40af 100%)"
                : "linear-gradient(135deg, #1e3a6e 0%, #1e40af 100%)",
              boxShadow: "0 0.25rem 1rem rgba(59,130,246,0.45), 0 0 0 1px rgba(59,130,246,0.2)",
              border: "1px solid rgba(59,130,246,0.3)",
              p: 0,
              // Evitar el overlay blanco de MUI en hover
              "&:hover": {
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                boxShadow: "0 0.5rem 1.5rem rgba(59,130,246,0.6)",
                transform: "scale(1.06)",
              },
              // Sobrescribe el pseudo-elemento overlay de MUI
              "& .MuiTouchRipple-root": { color: "rgba(255,255,255,0.2)" },
              transition: "all 0.2s ease",
            }}
          >
            {open ? (
              <CloseIcon sx={{ fontSize: "1.25rem", color: "white" }} />
            ) : (
              <SmartToyIcon sx={{ fontSize: "1.75rem", color: "white" }} />
            )}
          </Fab>
        </Tooltip>
      </Box>

    </Box>
  )
}

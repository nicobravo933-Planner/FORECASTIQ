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
import Popover from "@mui/material/Popover"
import Stack from "@mui/material/Stack"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import CloseIcon from "@mui/icons-material/Close"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import OpenInFullIcon from "@mui/icons-material/OpenInFull"
import SendIcon from "@mui/icons-material/Send"
import SmartToyIcon from "@mui/icons-material/SmartToy"
import EmojiEmotionsOutlinedIcon from "@mui/icons-material/EmojiEmotionsOutlined"
import AttachFileIcon from "@mui/icons-material/AttachFile"
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

// ── Catálogo de emojis por categoría ─────────────────────────────────────────────────

const EMOJI_CATS = [
  { label: "😀 Caras", emojis: [
    "😀","😁","😂","😃","😄","😅","😆","😇","😈","😉","😊","😋",
    "😌","😍","😎","😏","😐","😑","😒","😓","😔","😕","😖","😗",
    "😘","😙","😚","😛","😜","😝","😞","😟","😠","😡","😢","😣",
    "😤","😥","😦","😧","😨","😩","😪","😫","😬","😭","😮","😯",
    "😰","😱","😲","😳","😴","😵","😶","🤔","🤗","🤣","🤩","🤪",
    "🤫","🤬","🤭","🤮","🤯","🥰","🥳","🥺","🥻","🥼","🥽","🥾",
  ]},
  { label: "👍 Gestos", emojis: [
    "👍","👎","👏","✌️","✍️","🤝","🙏","🤣","👊","✊","✋","🖕",
    "🖖","👆","👇","👈","👉","☝️","👌","✏️","✂️","💪","👃","👂",
  ]},
  { label: "❤️ Corazones", emojis: [
    "❤️","🧡","💛","💚","💙","💜","💗","💘","💓","💔","💕","💖",
    "♥️","🖤","💝","❣️","💟","💯","✨","💫","🔥","💥","⚡","🌈",
  ]},
  { label: "📈 Trabajo", emojis: [
    "📈","📉","📊","📋","💼","💰","💱","💲","💳","💴","💵","💶",
    "💷","💸","💹","📝","📧","📨","📩","📪","📱","💻","🖥️","⚙️",
    "🔍","🔎","🔗","📑","📒","📓","📔","📕","📖","📗","📘","📙",
  ]},
  { label: "✅ Símbolos", emojis: [
    "✅","❌","⚠️","ℹ️","✔️","❎","✖️","✳️","✴️","❇️","‼️","⁉️",
    "♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓",
    "🔴","🔵","💚","🚀","🏆","🌟","⭐","👑","🍎","🎉","🎈","🤖",
  ]},
]

// Picker de emojis con categorías
function EmojiPicker({ anchor, onClose, onSelect }: {
  anchor: HTMLElement | null
  onClose: () => void
  onSelect: (e: string) => void
}) {
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState("")

  const filtered = search
    ? EMOJI_CATS.flatMap(c => c.emojis).filter(() => true)  // búsqueda futura
    : EMOJI_CATS[tab].emojis

  return (
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => { onClose(); setSearch("") }}
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
      transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      PaperProps={{ sx: { borderRadius:"0.75rem", boxShadow:4, width:"18rem" } }}>
      <Box sx={{ p:"0.5rem 0.625rem 0", borderBottom:"1px solid", borderColor:"divider" }}>
        <TextField size="small" fullWidth placeholder="Buscar emoji..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb:"0.375rem", "& .MuiInputBase-input": { fontSize:"0.8125rem", py:"0.375rem" } }}/>
        {!search && (
          <Tabs value={tab} onChange={(_,v) => setTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ minHeight:"2rem", "& .MuiTab-root": { minHeight:"2rem", fontSize:"1rem", p:"0.125rem 0.375rem", minWidth:"2rem" } }}>
            {EMOJI_CATS.map((c,i) => (
              <Tab key={i} label={c.emojis[0]} title={c.label}/>
            ))}
          </Tabs>
        )}
      </Box>
      <Box sx={{ p:"0.5rem", display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"0.125rem", maxHeight:"12rem", overflowY:"auto" }}>
        {(search
          ? EMOJI_CATS.flatMap(c => c.emojis).filter(e => {
              // búsqueda simple por posición en la lista (sin diccionario)
              return true  // todos pasan por ahora, mejora futura con nombre de emojis
            })
          : filtered
        ).map(emoji => (
          <IconButton key={emoji} size="small" onClick={() => { onSelect(emoji); onClose() }}
            sx={{ fontSize:"1.25rem", p:"0.25rem", borderRadius:"0.375rem", "&:hover": { bgcolor:"action.hover" } }}>
            {emoji}
          </IconButton>
        ))}
      </Box>
    </Popover>
  )
}

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
  const containerRef = useRef<HTMLDivElement>(null)

  // Posición draggable del FAB
  const [pos, setPos] = useState({ bottom: 28, right: 28 })  // en px
  const dragState = useRef<{ startX: number; startY: number; startBottom: number; startRight: number } | null>(null)

  const handleDragStart = (e: React.MouseEvent) => {
    // Solo drag si NO es click (click tiene delta < 5px)
    dragState.current = {
      startX: e.clientX, startY: e.clientY,
      startBottom: pos.bottom, startRight: pos.right,
    }
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return
      const dx = ev.clientX - dragState.current.startX
      const dy = ev.clientY - dragState.current.startY
      setPos({
        bottom: Math.max(8, dragState.current.startBottom - dy),
        right:  Math.max(8, dragState.current.startRight  - dx),
      })
    }
    const onUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      const dx = Math.abs(ev.clientX - dragState.current!.startX)
      const dy = Math.abs(ev.clientY - dragState.current!.startY)
      // Si movió menos de 5px, es un click — dejar que el FAB lo maneje
      if (dx > 5 || dy > 5) e.stopPropagation()
      dragState.current = null
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const [open, setOpen]   = useState(false)
  const [model, setModel] = useState<LlmModelId>(getPreferredModel)
  const [input, setInput] = useState("")
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    <Box ref={containerRef} sx={{ position: "fixed", bottom: `${pos.bottom}px`, right: `${pos.right}px`, zIndex: 1300 }}>

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

              <Stack direction="row" alignItems="flex-end" spacing="0.25rem"
                sx={{ px: "0.5rem", py: "0.5rem", flexShrink: 0 }}>

                {/* Emoji */}
                <Tooltip title="Emoji">
                  <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)}
                    sx={{ color:"text.secondary", mb:"0.0625rem", "&:hover": { color:"warning.main" } }}>
                    <EmojiEmotionsOutlinedIcon sx={{ fontSize:"1.125rem" }} />
                  </IconButton>
                </Tooltip>

                {/* Adjuntar */}
                <Tooltip title="Adjuntar archivo">
                  <IconButton size="small" onClick={() => fileInputRef.current?.click()}
                    sx={{ color:"text.secondary", mb:"0.0625rem", "&:hover": { color:"primary.main" } }}>
                    <AttachFileIcon sx={{ fontSize:"1.125rem" }} />
                  </IconButton>
                </Tooltip>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.png,.jpg,.pdf" style={{ display:"none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setInput(p => p + ` [${f.name}]`)
                    e.target.value = ""
                  }} />

                <TextField
                  inputRef={inputRef}
                  fullWidth multiline maxRows={3}
                  placeholder="Preguntá sobre tus datos…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius:"1rem", fontSize:"0.8125rem" } }}
                />

                <Tooltip title={isStreaming ? "Procesando…" : "Enviar"}>
                  <span>
                    <IconButton disabled={!input.trim() || isStreaming} onClick={() => void handleSend()}
                      sx={{
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        color: "white", width: "2rem", height: "2rem",
                        borderRadius: "50%", flexShrink: 0,
                        "&:hover": { background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)" },
                        "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
                      }}>
                      <SendIcon sx={{ fontSize:"0.875rem" }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              {/* Emoji picker */}
              <EmojiPicker
                anchor={emojiAnchor}
                onClose={() => setEmojiAnchor(null)}
                onSelect={(e) => { setInput(p => p + e); inputRef.current?.focus() }}
              />
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

        <Tooltip title={open ? "" : "Chat IA (arrastrá para mover)"} placement="left">
          <Fab
            ref={fabRef}
            onMouseDown={handleDragStart}
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir chat IA"
            sx={{
              width: "3.5rem",
              height: "3.5rem",
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
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

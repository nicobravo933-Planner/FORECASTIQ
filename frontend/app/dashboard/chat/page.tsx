"use client"

/**
 * Chat page — full-height AI assistant.
 *
 * Layout:
 *   header: avatar + title + model selector + sidebar toggle
 *   messages (flex:1, scrollable)
 *   follow-up chips
 *   input bar: emoji | adjunto | textfield | mic | enviar
 */

import { useEffect, useRef, useState } from "react"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import HistoryIcon from "@mui/icons-material/History"
import SendIcon from "@mui/icons-material/Send"
import EmojiEmotionsOutlinedIcon from "@mui/icons-material/EmojiEmotionsOutlined"
import AttachFileIcon from "@mui/icons-material/AttachFile"
import MicNoneIcon from "@mui/icons-material/MicNone"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import Popover from "@mui/material/Popover"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import Image from "next/image"
import { ChatBox } from "@/components/chat/ChatBox"
import { ConversationSidebar } from "@/components/chat/ConversationSidebar"
import { ModelSelector } from "@/components/chat/ModelSelector"
import { ModelStatusBar } from "@/components/chat/ModelStatusBar"
import { QuickQuestions } from "@/components/chat/QuickQuestions"
import { useChat } from "@/hooks/useChat"
import { useConversations } from "@/hooks/useConversations"
import { useModelStatus } from "@/hooks/useModelStatus"
import { appStore } from "@/lib/appStore"
import { type ChatConversation, type ChatMessage, type LlmModelId } from "@/lib/types"
import { getPreferredModel } from "@/lib/preferredModel"

const EMOJI_LIST = [
  "😄","😊","🤔","😮","👍","👎","✅","❌",
  "🔥","💡","📈","📉","💫","🤖","📊","📋",
  "❤️","🤝","⚠️","ℹ️","🚨","🏆","💥","🙏",
  "🚀","🔍","📝","🛠️","🎯","⏰","📅","💰",
]

export default function ChatPage() {
  const [model, setModel] = useState<LlmModelId>(getPreferredModel)
  const [input, setInput] = useState("")
  const inputRef   = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null)

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [jobId, setJobId]         = useState<string | null>(null)
  const [detectionReport, setDetectionReport] = useState<Record<string, unknown> | null>(null)  // P6
  const [multiSerieSummary, setMultiSerieSummary] = useState<string | null>(null)               // P6

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)   // oculto por defecto

  useEffect(() => {
    const ctx = appStore.getChatContext()
    setDatasetId(ctx.datasetId)
    setJobId(ctx.jobId)
    // P6: detection report del detector automático
    setDetectionReport(appStore.getDetectionReport())
    // P6: resumen del benchmark multi-serie (si existe)
    const msResult = appStore.getLastMultiSerieResult<Record<string, unknown>>()
    if (msResult) {
      const entities = (msResult.results as unknown[])?.length ?? 0
      const winner = (msResult.ranking as Array<{model: string}>)?.[0]?.model ?? "unknown"
      setMultiSerieSummary(
        `Multi-series benchmark: ${entities} entities analyzed. Best overall model: ${winner}. ` +
        `Run at ${msResult.run_at as string ?? "unknown date"}.`
      )
    }
  }, [])

  const pendingMessages = appStore.popPendingMessages() as ChatMessage[]

  const { messages, suggestions, isStreaming, activeToolCall, error, tokensUsed, sendMessage, clearMessages, setMessages } =
    useChat({ datasetId, jobId, detectionReport, multiSerieSummary, initialMessages: pendingMessages.length > 0 ? pendingMessages : undefined })

  // Keep last non-empty suggestions so chips don’t disappear while the user types
  const lastSuggestionsRef = useRef<string[]>([])
  if (suggestions.length > 0) lastSuggestionsRef.current = suggestions
  const displayedSuggestions = lastSuggestionsRef.current

  const { conversations, isLoading: convLoading, saveConversation, loadConversation, deleteConversation, refresh } =
    useConversations()

  const { status: modelStatus } = useModelStatus(model)

  // Auto-save after each completed assistant message
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    const justFinished = prevStreamingRef.current && !isStreaming
    prevStreamingRef.current = isStreaming
    if (!justFinished || messages.length === 0) return
    void saveConversation({ conversationId: activeConversationId, messages, model }).then((id) => {
      if (id && !activeConversationId) setActiveConversationId(id)
    })
  }, [isStreaming, messages, activeConversationId, model, saveConversation])

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || isStreaming) return
    setInput("")
    await sendMessage(msg, model)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  const handleSelectConversation = async (conv: ChatConversation) => {
    if (conv.id === activeConversationId) return
    const detail = await loadConversation(conv.id)
    if (!detail) return
    clearMessages(); setMessages(detail.messages); setActiveConversationId(conv.id)
  }

  const handleNewChat = () => { clearMessages(); setActiveConversationId(null); void refresh(); lastSuggestionsRef.current = [] }

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id)
    if (id === activeConversationId) handleNewChat()
  }

  const handleEditMessage   = (m: ChatMessage) => { setInput(m.content); inputRef.current?.focus() }
  const handleResendMessage = (m: ChatMessage) => { void handleSend(m.content) }

  return (
    <Box sx={{
      display: "flex", flexDirection: "column",
      height: "100%",
      bgcolor: "background.default",
      borderRadius: "0.75rem", overflow: "hidden",
      border: "1px solid", borderColor: "divider",
    }}>

      {/* Outer row: sidebar + main */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        {sidebarOpen && (
          <ConversationSidebar
            conversations={conversations} activeId={activeConversationId}
            isLoading={convLoading}
            onSelect={(conv) => void handleSelectConversation(conv)}
            onNew={handleNewChat}
            onDelete={(id) => void handleDeleteConversation(id)}
          />
        )}

        {/* Main column */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Header */}
          <Stack direction="row" alignItems="center" gap="0.75rem" sx={{
            px: "1rem", py: "0.625rem",
            bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider",
            flexShrink: 0, boxShadow: 1,
          }}>
            <Image src="/chip.png" alt="AI" width={42} height={42} style={{ objectFit: "contain", flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={600} sx={{ fontSize: "0.9375rem", lineHeight: 1.2, mb: "0.375rem" }}>
                AI Assistant
              </Typography>
              <ModelStatusBar model={model} status={modelStatus} tokensUsed={tokensUsed} />
            </Box>
            <Stack direction="row" alignItems="center" spacing="0.5rem" sx={{ flexShrink: 0 }}>
              <Tooltip title={sidebarOpen ? "Ocultar historial" : "Mostrar historial"}>
                <IconButton size="small" onClick={() => setSidebarOpen(v => !v)}
                  sx={{ color: sidebarOpen ? "primary.main" : "text.secondary" }}>
                  <HistoryIcon sx={{ fontSize: "1.125rem" }} />
                </IconButton>
              </Tooltip>
              <ModelSelector value={model} onChange={setModel} disabled={isStreaming} />
              <Tooltip title="Limpiar conversacion">
                <span>
                  <IconButton size="small"
                    onClick={() => { clearMessages(); lastSuggestionsRef.current = [] }}
                    disabled={isStreaming || messages.length === 0} sx={{ color: "text.secondary" }}>
                    <DeleteOutlineIcon sx={{ fontSize: "1.125rem" }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Error banner */}
          {error && (
            <Alert severity="error" sx={{ mx: "1rem", mt: "0.625rem", fontSize: "0.875rem", flexShrink: 0 }}>
              {error}
            </Alert>
          )}

          {/* Messages */}
          <ChatBox
            messages={messages} activeToolCall={activeToolCall} isStreaming={isStreaming}
            onQuickSelect={(q) => void handleSend(q)}
            onEditMessage={handleEditMessage} onResendMessage={handleResendMessage}
          />

          <Divider />

          {/* Follow-up chips — persisten hasta nueva conversación */}
          {displayedSuggestions.length > 0 && (
            <Box sx={{ px: "1rem", pt: "0.625rem", pb: "0.25rem", flexShrink: 0 }}>
              <QuickQuestions suggestions={displayedSuggestions} onSelect={(q) => void handleSend(q)} disabled={isStreaming} />
            </Box>
          )}

          {/* Input bar — estilo WhatsApp */}
          <Stack direction="row" alignItems="flex-end" spacing="0.25rem" sx={{
            px: "0.75rem", py: "0.625rem",
            bgcolor: "background.paper", flexShrink: 0,
          }}>

            {/* Emoji */}
            <Tooltip title="Insertar emoji">
              <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)}
                sx={{ color: "text.secondary", mb: "0.125rem", "&:hover": { color: "warning.main" } }}>
                <EmojiEmotionsOutlinedIcon sx={{ fontSize: "1.375rem" }} />
              </IconButton>
            </Tooltip>

            {/* Adjuntar */}
            <Tooltip title="Adjuntar archivo">
              <IconButton size="small" onClick={() => fileInputRef.current?.click()}
                sx={{ color: "text.secondary", mb: "0.125rem", "&:hover": { color: "primary.main" } }}>
                <AttachFileIcon sx={{ fontSize: "1.375rem" }} />
              </IconButton>
            </Tooltip>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.png,.jpg,.pdf" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setInput(p => p + ` [${f.name}]`)
                e.target.value = ""
              }} />

            {/* TextField */}
            <TextField
              inputRef={inputRef} fullWidth multiline maxRows={5}
              placeholder="Pregunta sobre tus datos, el forecast..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              size="small"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "1.25rem", fontSize: "0.9375rem", bgcolor: "background.default" } }}
            />

            {/* Mic — coming soon tooltip, no dead button in the DOM */}
            <Tooltip title="Dictado de voz: próximamente" placement="top">
              <Box
                component="span"
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "2rem", height: "2rem", mb: "0.125rem",
                  borderRadius: "50%", cursor: "default",
                  color: "text.disabled", opacity: 0.4,
                }}
              >
                <MicNoneIcon sx={{ fontSize: "1.375rem" }} />
              </Box>
            </Tooltip>

            {/* Enviar */}
            <Tooltip title={isStreaming ? "Procesando..." : "Enviar (Enter)"}>
              <span>
                <IconButton color="primary" disabled={!input.trim() || isStreaming}
                  onClick={() => void handleSend()}
                  sx={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    color: "white", width: "2.5rem", height: "2.5rem",
                    borderRadius: "50%", flexShrink: 0,
                    boxShadow: "0 0.125rem 0.5rem rgba(59,130,246,0.3)",
                    "&:hover": { background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)", boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.4)" },
                    "&.Mui-disabled": { background: "rgba(0,0,0,0.12)", boxShadow: "none" },
                  }}>
                  <SendIcon sx={{ fontSize: "1.125rem" }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {/* Emoji Popover */}
          <Popover open={Boolean(emojiAnchor)} anchorEl={emojiAnchor}
            onClose={() => setEmojiAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            transformOrigin={{ vertical: "bottom", horizontal: "left" }}
            PaperProps={{ sx: { p: "0.75rem", borderRadius: "0.75rem", boxShadow: 4 } }}>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: "0.5rem", fontWeight: 600 }}>
              Emojis frecuentes
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "0.125rem" }}>
              {EMOJI_LIST.map(emoji => (
                <IconButton key={emoji} size="small"
                  onClick={() => { setInput(p => p + emoji); setEmojiAnchor(null); inputRef.current?.focus() }}
                  sx={{ fontSize: "1.25rem", borderRadius: "0.375rem", p: "0.25rem", "&:hover": { bgcolor: "action.hover" } }}>
                  {emoji}
                </IconButton>
              ))}
            </Box>
          </Popover>

        </Box>{/* end main column */}
      </Box>{/* end outer row */}
    </Box>
  )
}

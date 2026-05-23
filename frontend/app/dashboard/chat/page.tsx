"use client"

/**
 * Chat page — full-height AI assistant.
 *
 * Layout (mirrors chat.html reference):
 *   ┌─ header: avatar + title + context chips + model selector + clear ─┐
 *   │  messages (flex:1, scrollable)                                     │
 *   │  follow-up chips (when present)                                    │
 *   └─ input bar ────────────────────────────────────────────────────────┘
 */

import { useEffect, useRef, useState } from "react"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import HistoryIcon from "@mui/icons-material/History"
import SendIcon from "@mui/icons-material/Send"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
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

export default function ChatPage() {
  const [model, setModel] = useState<LlmModelId>(getPreferredModel)
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [jobId, setJobId]         = useState<string | null>(null)

  // Active conversation id (null = new unsaved chat)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const ctx = appStore.getChatContext()
    setDatasetId(ctx.datasetId)
    setJobId(ctx.jobId)
  }, [])

  const pendingMessages = appStore.popPendingMessages() as ChatMessage[]

  const { messages, suggestions, isStreaming, activeToolCall, error, tokensUsed, sendMessage, clearMessages, setMessages } =
    useChat({ datasetId, jobId, initialMessages: pendingMessages.length > 0 ? pendingMessages : undefined })

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleSelectConversation = async (conv: ChatConversation) => {
    if (conv.id === activeConversationId) return
    const detail = await loadConversation(conv.id)
    if (!detail) return
    clearMessages()
    setMessages(detail.messages)
    setActiveConversationId(conv.id)
  }

  const handleNewChat = () => {
    clearMessages()
    setActiveConversationId(null)
    void refresh()
  }

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id)
    if (id === activeConversationId) handleNewChat()
  }

  // Edit: pone el texto en el input para que el usuario lo modifique
  const handleEditMessage = (message: ChatMessage) => {
    setInput(message.content)
    inputRef.current?.focus()
  }

  // Resend: reenvía el mensaje directamente sin editar
  const handleResendMessage = (message: ChatMessage) => {
    void handleSend(message.content)
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        // Full height = viewport - header (4rem) - page padding top+bottom (3.5rem)
        height: "calc(100vh - 7.5rem)",
        bgcolor: "background.default",
        borderRadius: "0.75rem",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* ── Outer row: sidebar + main ───────────────────────────── */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Conversation sidebar ──────────────────────────────── */}
        {sidebarOpen && (
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            isLoading={convLoading}
            onSelect={(conv) => void handleSelectConversation(conv)}
            onNew={handleNewChat}
            onDelete={(id) => void handleDeleteConversation(id)}
          />
        )}
        {/* ── Main column ──────────────────────────────────────── */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        gap="0.75rem"
        sx={{
          px: "1rem",
          py: "0.625rem",
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          boxShadow: 1,
        }}
      >
        {/* chip.png */}
        <Image src="/chip.png" alt="AI" width={42} height={42} style={{ objectFit: "contain", flexShrink: 0 }} />

        {/* Title + ModelStatusBar */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={600} sx={{ fontSize: "0.9375rem", lineHeight: 1.2, mb: "0.375rem" }}>
            AI Assistant
          </Typography>
          <ModelStatusBar model={model} status={modelStatus} tokensUsed={tokensUsed} />
        </Box>

        {/* Controls */}
        <Stack direction="row" alignItems="center" spacing="0.5rem" sx={{ flexShrink: 0 }}>
          <Tooltip title={sidebarOpen ? "Ocultar historial" : "Mostrar historial"}>
            <IconButton
              size="small"
              onClick={() => setSidebarOpen((v) => !v)}
              sx={{ color: sidebarOpen ? "primary.main" : "text.secondary" }}
            >
              <HistoryIcon sx={{ fontSize: "1.125rem" }} />
            </IconButton>
          </Tooltip>
          <ModelSelector value={model} onChange={setModel} disabled={isStreaming} />
          <Tooltip title="Limpiar conversación">
            <span>
              <IconButton
                size="small"
                onClick={clearMessages}
                disabled={isStreaming || messages.length === 0}
                sx={{ color: "text.secondary" }}
              >
                <DeleteOutlineIcon sx={{ fontSize: "1.125rem" }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mx: "1rem", mt: "0.625rem", fontSize: "0.875rem", flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <ChatBox
        messages={messages}
        activeToolCall={activeToolCall}
        isStreaming={isStreaming}
        onQuickSelect={(q) => void handleSend(q)}
        onEditMessage={handleEditMessage}
        onResendMessage={handleResendMessage}
      />

      <Divider />

      {/* ── Follow-up chips ───────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <Box sx={{ px: "1rem", pt: "0.625rem", pb: "0.25rem", flexShrink: 0 }}>
          <QuickQuestions
            suggestions={suggestions}
            onSelect={(q) => void handleSend(q)}
            disabled={isStreaming}
          />
        </Box>
      )}

      {/* ── Input bar ────────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="flex-end"
        spacing="0.5rem"
        sx={{
          px: "1rem",
          py: "0.75rem",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={5}
          placeholder="Preguntá sobre tus datos, el forecast, la estacionalidad…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "0.625rem",
              fontSize: "0.9375rem",
              bgcolor: "background.default",
            },
          }}
        />
        <Tooltip title={isStreaming ? "Procesando…" : "Enviar (Enter)"}>
          <span>
            <IconButton
              color="primary"
              disabled={!input.trim() || isStreaming}
              onClick={() => void handleSend()}
              sx={{
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "white",
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "0.625rem",
                flexShrink: 0,
                boxShadow: "0 0.125rem 0.5rem rgba(59,130,246,0.3)",
                "&:hover": {
                  background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                  boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.4)",
                },
                "&.Mui-disabled": {
                  background: "action.disabledBackground",
                  boxShadow: "none",
                },
              }}
            >
              <SendIcon sx={{ fontSize: "1.125rem" }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
        </Box> {/* end main column */}
      </Box> {/* end outer row */}
    </Box>
  )
}

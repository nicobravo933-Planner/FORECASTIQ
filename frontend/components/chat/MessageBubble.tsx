"use client"

/**
 * MessageBubble — single chat message with avatar, animations, and action buttons.
 *
 * User:      right-aligned, primary gradient, slide-in from right
 *            Actions on hover: Copy / Edit / Resend
 * Assistant: left-aligned with avatar, full-width bubble, slide-in from left
 *            Actions: Copy (always visible when complete)
 */

import { useState } from "react"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import CheckIcon from "@mui/icons-material/Check"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import ReplayIcon from "@mui/icons-material/Replay"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import type { ChatMessage } from "@/lib/types"
import { InlineChart, parseChartSpec } from "./InlineChart"
import { StreamingCursor } from "./StreamingCursor"
import { RobotAvatar } from "./RobotAvatar"

// ── Animations (keyframes defined once, referenced by name) ─────────────
const ANIM_USER = {
  animation: "msgInUser 0.22s ease",
  "@keyframes msgInUser": {
    from: { opacity: 0, transform: "translateX(0.875rem) scale(0.97)" },
    to:   { opacity: 1, transform: "translateX(0) scale(1)" },
  },
}

const ANIM_AI = {
  animation: "msgInAi 0.22s ease",
  "@keyframes msgInAi": {
    from: { opacity: 0, transform: "translateX(-0.875rem) scale(0.97)" },
    to:   { opacity: 1, transform: "translateX(0) scale(1)" },
  },
}

// ── Assistant avatar ─────────────────────────────────────────────────────
function AssistantAvatar() {
  return <RobotAvatar size={34} />
}

// ── Markdown renderer (same as before, untouched) ────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  const parts = text.split(/(```[\s\S]*?```)/g)

  parts.forEach((part, i) => {
    const fenceMatch = part.match(/^```(?:json\s+chart-spec|chart-spec)([\s\S]*?)```$/)
    if (fenceMatch) {
      const spec = parseChartSpec(fenceMatch[1])
      if (spec) {
        nodes.push(<InlineChart key={`chart-${i}`} spec={spec} />)
        return
      }
      nodes.push(
        <Box
          key={`code-${i}`}
          component="pre"
          sx={{
            bgcolor: "action.hover",
            p: "0.5rem",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            fontFamily: "monospace",
            overflowX: "auto",
            my: "0.25rem",
          }}
        >
          {fenceMatch[1].trim()}
        </Box>,
      )
      return
    }

    part.split("\n").forEach((line, j, arr) => {
      const inlineParts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, k) => {
        if (chunk.startsWith("**") && chunk.endsWith("**"))
          return <strong key={k}>{chunk.slice(2, -2)}</strong>
        if (chunk.startsWith("`") && chunk.endsWith("`"))
          return (
            <Box
              key={k}
              component="code"
              sx={{
                bgcolor: "action.hover",
                px: "0.25rem",
                borderRadius: "0.25rem",
                fontFamily: "monospace",
                fontSize: "0.8125rem",
              }}
            >
              {chunk.slice(1, -1)}
            </Box>
          )
        return chunk
      })
      nodes.push(
        <span key={`${i}-${j}`}>
          {inlineParts}
          {j < arr.length - 1 && <br />}
        </span>,
      )
    })
  })

  return <>{nodes}</>
}

// ── Main component ───────────────────────────────────────────────────────
interface MessageBubbleProps {
  message: ChatMessage
  onEdit?: (message: ChatMessage) => void
  onResend?: (message: ChatMessage) => void
}

export function MessageBubble({ message, onEdit, onResend }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── User bubble ──────────────────────────────────────────────
  if (isUser) {
    return (
      <Box
        className="msg-user-row"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          px: { xs: "0.5rem", sm: "0.75rem" },
          ...ANIM_USER,
          // Show action buttons on hover
          "&:hover .user-actions": { opacity: 1 },
        }}
      >
        {/* Bubble */}
        <Box
          sx={{
            maxWidth: { xs: "88%", sm: "72%", md: "60%" },
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "white",
            borderRadius: "1rem 1rem 0.25rem 1rem",
            px: "0.9375rem",
            py: "0.625rem",
            boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.3)",
            wordBreak: "break-word",
          }}
        >
          <Box component="span" sx={{ fontSize: "0.9375rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {message.content}
          </Box>
        </Box>

        {/* Action bar: Copy / Edit / Resend — visible on hover */}
        <Box
          className="user-actions"
          sx={{
            display: "flex",
            gap: "0.125rem",
            mt: "0.25rem",
            opacity: 0,
            transition: "opacity 0.15s",
          }}
        >
          {[  
            { title: copied ? "¡Copiado!" : "Copiar",   icon: copied ? <CheckIcon sx={{ fontSize: "0.75rem", color: "success.main" }} /> : <ContentCopyIcon sx={{ fontSize: "0.75rem" }} />, onClick: handleCopy },
            { title: "Editar",   icon: <EditOutlinedIcon sx={{ fontSize: "0.75rem" }} />, onClick: () => onEdit?.(message) },
            { title: "Reenviar", icon: <ReplayIcon sx={{ fontSize: "0.75rem" }} />,        onClick: () => onResend?.(message) },
          ].map(({ title, icon, onClick }) => (
            <Tooltip key={title} title={title}>
              <IconButton
                size="small"
                onClick={onClick}
                sx={{
                  p: "0.25rem",
                  borderRadius: "0.375rem",
                  border: "0.5px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  color: "text.secondary",
                  "&:hover": { color: "primary.main", borderColor: "primary.light" },
                }}
              >
                {icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </Box>
    )
  }

  // ── Assistant bubble ─────────────────────────────────────────
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.625rem",
        px: { xs: "0.5rem", sm: "0.75rem" },
        ...ANIM_AI,
      }}
    >
      <AssistantAvatar />

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {/* Bubble */}
        <Box
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "0.25rem 1rem 1rem 1rem",
            px: "1rem",
            py: "0.75rem",
            boxShadow: 1,
            wordBreak: "break-word",
            // Width: fit-content unless streaming (avoids stretching on short messages)
            width: message.isStreaming ? "100%" : "fit-content",
            maxWidth: "100%",
            position: "relative",
          }}
        >
          <Box
            component="div"
            sx={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {renderMarkdown(message.content)}
            {message.isStreaming && <StreamingCursor />}
          </Box>
        </Box>

        {/* Copy button — only for completed assistant messages */}
        {!message.isStreaming && message.content && (
          <Box sx={{ pl: "0.25rem" }}>
            <Tooltip title={copied ? "¡Copiado!" : "Copiar"}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  opacity: 0.45,
                  "&:hover": { opacity: 1 },
                  p: "0.25rem",
                  borderRadius: "0.375rem",
                  border: "0.5px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                {copied ? (
                  <CheckIcon sx={{ fontSize: "0.8125rem", color: "success.main" }} />
                ) : (
                  <ContentCopyIcon sx={{ fontSize: "0.8125rem" }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  )
}

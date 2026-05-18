"use client"

/**
 * MessageBubble — renders a single chat message.
 * User messages: right-aligned indigo. Assistant: left-aligned paper.
 * Supports Markdown rendering and a copy-to-clipboard button.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import CheckIcon from "@mui/icons-material/Check"
import type { ChatMessage } from "@/lib/types"
import { StreamingCursor } from "./StreamingCursor"

interface MessageBubbleProps {
  message: ChatMessage
}

/** Very lightweight Markdown: bold, inline code, newlines. No heavy lib needed. */
function renderMarkdown(text: string): React.ReactNode {
  // Split by newlines, render each line
  return text.split("\n").map((line, i) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <Box
            key={j}
            component="code"
            sx={{
              bgcolor: "action.hover",
              px: "0.25rem",
              borderRadius: "0.25rem",
              fontFamily: "monospace",
              fontSize: "0.8125rem",
            }}
          >
            {part.slice(1, -1)}
          </Box>
        )
      }
      return part
    })
    return (
      <span key={i}>
        {parts}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    )
  })
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: "0.25rem",
        maxWidth: "100%",
      }}
    >
      <Box
        sx={{
          maxWidth: { xs: "92%", sm: "78%" },
          bgcolor: isUser ? "primary.main" : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          borderRadius: isUser
            ? "1rem 1rem 0.25rem 1rem"
            : "1rem 1rem 1rem 0.25rem",
          px: "1rem",
          py: "0.625rem",
          boxShadow: 1,
          position: "relative",
          wordBreak: "break-word",
        }}
      >
        <Typography
          component="div"
          sx={{ fontSize: "0.9375rem", lineHeight: 1.6 }}
        >
          {renderMarkdown(message.content)}
          {message.isStreaming && <StreamingCursor />}
        </Typography>
      </Box>

      {/* Copy button — only for assistant messages with content */}
      {!isUser && message.content && !message.isStreaming && (
        <Tooltip title={copied ? "Copied!" : "Copy"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{ opacity: 0.5, "&:hover": { opacity: 1 }, p: "0.25rem" }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: "0.875rem" }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: "0.875rem" }} />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

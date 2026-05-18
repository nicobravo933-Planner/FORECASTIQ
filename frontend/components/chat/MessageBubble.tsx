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
import { InlineChart, parseChartSpec } from "./InlineChart"
import { StreamingCursor } from "./StreamingCursor"

interface MessageBubbleProps {
  message: ChatMessage
}

/**
 * Renders Markdown-like text with support for:
 *   - **bold**, `inline code`
 *   - ```json chart-spec blocks → InlineChart
 *   - newlines → <br />
 */
function renderMarkdown(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  // Split on fenced code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g)

  parts.forEach((part, i) => {
    // Check for ```json chart-spec block
    const fenceMatch = part.match(/^```(?:json\s+chart-spec|chart-spec)([\s\S]*?)```$/)
    if (fenceMatch) {
      const spec = parseChartSpec(fenceMatch[1])
      if (spec) {
        nodes.push(<InlineChart key={`chart-${i}`} spec={spec} />)
        return
      }
      // Not a valid chart spec — render as plain code block
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

    // Regular inline Markdown (bold + code + newlines)
    part.split("\n").forEach((line, j, arr) => {
      const inlineParts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, k) => {
        if (chunk.startsWith("**") && chunk.endsWith("**")) {
          return <strong key={k}>{chunk.slice(2, -2)}</strong>
        }
        if (chunk.startsWith("`") && chunk.endsWith("`")) {
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
        }
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

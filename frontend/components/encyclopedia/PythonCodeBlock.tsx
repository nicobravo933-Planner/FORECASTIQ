"use client"

/**
 * PythonCodeBlock — syntax-highlighted Python code with copy button.
 * No execution — purely educational display.
 */

import CheckIcon from "@mui/icons-material/Check"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { useState } from "react"

interface PythonCodeBlockProps {
  code: string
  title?: string
}

/** Very lightweight tokenizer — colors keywords, strings, comments, numbers */
function highlight(code: string): React.ReactNode[] {
  const lines = code.split("\n")
  return lines.map((line, li) => {
    // tokenize each line into segments
    const segments: React.ReactNode[] = []
    let rest = line

    // comment
    const commentIdx = rest.indexOf("#")
    let commentPart = ""
    if (commentIdx !== -1) {
      commentPart = rest.slice(commentIdx)
      rest = rest.slice(0, commentIdx)
    }

    // simple token regex — keywords, strings, numbers, builtins
    const tokenRe = /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'[^']*'|\b(def|class|return|import|from|if|else|elif|for|while|in|not|and|or|True|False|None|lambda|with|as|try|except|raise|yield|pass|break|continue|async|await)\b|\b\d+(?:\.\d+)?\b)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = tokenRe.exec(rest)) !== null) {
      if (m.index > last) segments.push(<span key={`t${li}-${last}`}>{rest.slice(last, m.index)}</span>)
      const tok = m[0]
      const isKw = m[2] !== undefined
      const isStr = tok.startsWith('"') || tok.startsWith("'")
      const isNum = /^\d/.test(tok)
      const color = isKw ? "#c678dd" : isStr ? "#98c379" : isNum ? "#d19a66" : "inherit"
      segments.push(<span key={`t${li}-${m.index}`} style={{ color }}>{tok}</span>)
      last = m.index + tok.length
    }
    if (last < rest.length) segments.push(<span key={`t${li}-end`}>{rest.slice(last)}</span>)
    if (commentPart) segments.push(<span key={`c${li}`} style={{ color: "#7f848e", fontStyle: "italic" }}>{commentPart}</span>)

    return (
      <div key={li} style={{ lineHeight: "1.6" }}>
        {segments.length ? segments : <span>&nbsp;</span>}
      </div>
    )
  })
}

export function PythonCodeBlock({ code, title }: PythonCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Box
      sx={{
        my: "1.25rem",
        borderRadius: "0.5rem",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#282c34",
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: "1rem",
          py: "0.375rem",
          bgcolor: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
          {title ?? "Python"}
        </Typography>
        <Tooltip title={copied ? "¡Copiado!" : "Copiar código"} placement="left">
          <IconButton size="small" onClick={handleCopy} sx={{ color: "rgba(255,255,255,0.45)", "&:hover": { color: "#fff" } }}>
            {copied ? <CheckIcon sx={{ fontSize: "0.875rem" }} /> : <ContentCopyIcon sx={{ fontSize: "0.875rem" }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Code */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: "1rem",
          overflowX: "auto",
          fontSize: "0.8125rem",
          fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          color: "#abb2bf",
          lineHeight: 1.6,
          "& span": { fontFamily: "inherit" },
        }}
      >
        {highlight(code)}
      </Box>
    </Box>
  )
}

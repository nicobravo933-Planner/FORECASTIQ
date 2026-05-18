"use client"

/**
 * StreamingCursor — blinking cursor shown while the LLM is streaming.
 */

import Box from "@mui/material/Box"
import { keyframes } from "@mui/system"

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
`

export function StreamingCursor() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: "0.5rem",
        height: "1rem",
        bgcolor: "primary.main",
        ml: "0.125rem",
        verticalAlign: "text-bottom",
        borderRadius: "0.125rem",
        animation: `${blink} 0.9s step-start infinite`,
      }}
      aria-hidden
    />
  )
}

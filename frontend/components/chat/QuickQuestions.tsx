"use client"

/**
 * QuickQuestions — follow-up suggestion chips.
 *
 * When suggestions come from the LLM: accent-colored pill chips with bolt icon,
 * hover lift effect — mirrors .fu-chip from chat.html reference.
 * When no suggestions: hidden (welcome screen handles the empty state).
 */

import BoltIcon from "@mui/icons-material/Bolt"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"

interface QuickQuestionsProps {
  suggestions?: string[]
  onSelect: (question: string) => void
  disabled?: boolean
}

export function QuickQuestions({ suggestions, onSelect, disabled }: QuickQuestionsProps) {
  // Only render when there are LLM-generated suggestions
  if (!suggestions || suggestions.length === 0) return null

  return (
    <Stack spacing="0.375rem">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: "0.6875rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
      >
        <BoltIcon sx={{ fontSize: "0.75rem", color: "primary.main" }} />
        Sugerencias
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
        {suggestions.map((q) => (
          <Box
            key={q}
            component="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3125rem",
              bgcolor: "rgba(99,102,241,0.08)",
              border: "0.5px solid rgba(99,102,241,0.28)",
              borderRadius: "999px",
              px: "0.75rem",
              py: "0.3125rem",
              fontSize: "0.75rem",
              color: "primary.main",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
              maxWidth: "22rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              "&:hover:not(:disabled)": {
                bgcolor: "rgba(99,102,241,0.16)",
                borderColor: "rgba(99,102,241,0.55)",
                transform: "translateY(-0.0625rem)",
                boxShadow: "0 0.125rem 0.5rem rgba(99,102,241,0.2)",
              },
              "&:disabled": {
                opacity: 0.45,
                cursor: "not-allowed",
              },
            }}
          >
            <BoltIcon sx={{ fontSize: "0.6875rem", flexShrink: 0 }} />
            {q}
          </Box>
        ))}
      </Box>
    </Stack>
  )
}

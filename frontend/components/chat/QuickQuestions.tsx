"use client"

/**
 * QuickQuestions — chips for suggested follow-up questions.
 * Shows default suggestions when chat is empty,
 * and LLM-extracted suggestions after each response.
 */

import Chip from "@mui/material/Chip"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"

const DEFAULT_QUESTIONS = [
  "¿Cuál fue el mes con mayor venta?",
  "¿Cuánto error tiene el forecast actual?",
  "¿Hay estacionalidad en los datos?",
  "¿Qué modelo ML se usó y por qué?",
  "¿Qué eventos impactan el forecast?",
]

interface QuickQuestionsProps {
  suggestions?: string[]
  onSelect: (question: string) => void
  disabled?: boolean
}

export function QuickQuestions({
  suggestions,
  onSelect,
  disabled,
}: QuickQuestionsProps) {
  const items = suggestions && suggestions.length > 0 ? suggestions : DEFAULT_QUESTIONS

  return (
    <Stack spacing="0.5rem">
      {suggestions && suggestions.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          Suggested follow-ups:
        </Typography>
      )}
      <Stack direction="row" flexWrap="wrap" gap="0.5rem">
        {items.map((q) => (
          <Chip
            key={q}
            label={q}
            size="small"
            variant="outlined"
            clickable
            disabled={disabled}
            onClick={() => onSelect(q)}
            sx={{
              fontSize: "0.8125rem",
              height: "auto",
              py: "0.25rem",
              "& .MuiChip-label": { whiteSpace: "normal", textAlign: "left" },
              maxWidth: "20rem",
              cursor: "pointer",
            }}
          />
        ))}
      </Stack>
    </Stack>
  )
}

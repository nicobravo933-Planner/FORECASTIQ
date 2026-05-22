"use client"

/**
 * ModelSelector — dropdown to choose the active LLM model.
 * Fetches available models from the backend on mount.
 */

import { useEffect, useState } from "react"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import Select, { SelectChangeEvent } from "@mui/material/Select"
import Skeleton from "@mui/material/Skeleton"
import { api } from "@/lib/api"
import { FREE_MODELS, type LlmModel, type LlmModelId } from "@/lib/types"

interface ModelSelectorProps {
  value: LlmModelId
  onChange: (model: LlmModelId) => void
  disabled?: boolean
  compact?: boolean  // smaller width for FloatingChat bubble
}

export function ModelSelector({ value, onChange, disabled, compact }: ModelSelectorProps) {
  const [models, setModels] = useState<LlmModel[]>(FREE_MODELS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<LlmModel[]>("/api/chat/models")
      .then((data) => {
        if (data.length > 0) setModels(data)
      })
      .catch(() => {
        // Fallback to hardcoded list if backend is unreachable
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton variant="rounded" width={compact ? "8rem" : "12rem"} height="2rem" />

  return (
    <FormControl size="small" sx={{ minWidth: compact ? "8rem" : "12rem" }}>
      <InputLabel id="model-select-label" sx={{ fontSize: "0.875rem" }}>
        Model
      </InputLabel>
      <Select
        labelId="model-select-label"
        value={value}
        label="Model"
        disabled={disabled}
        onChange={(e: SelectChangeEvent) => onChange(e.target.value as LlmModelId)}
        sx={{ fontSize: "0.875rem" }}
      >
        {models.map((m) => (
          <MenuItem key={m.id} value={m.id} sx={{ fontSize: "0.875rem" }}>
            {m.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

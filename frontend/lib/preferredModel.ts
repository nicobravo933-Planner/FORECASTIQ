/**
 * getPreferredModel — reads the user's preferred LLM model from localStorage.
 * Falls back to DeepSeek V4 Flash (index 5) if nothing is stored.
 * Safe to call during render (returns default on SSR / missing key).
 */

import { FREE_MODELS, type LlmModelId } from "@/lib/types"

const LS_MODEL_KEY = "forecastiq:preferred_model"

export function getPreferredModel(): LlmModelId {
  if (typeof window === "undefined") return FREE_MODELS[5].id
  const stored = localStorage.getItem(LS_MODEL_KEY) as LlmModelId | null
  if (stored && FREE_MODELS.some((m) => m.id === stored)) return stored
  return FREE_MODELS[5].id
}

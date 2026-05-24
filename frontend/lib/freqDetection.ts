"use client"

/**
 * useFreqDetection — infers the most likely DataFreq from a date column's
 * sample values returned by the /preview endpoint.
 *
 * Strategy: compute median interval between the sample dates and map it:
 *   < 2 days    → "D"
 *   2–9 days    → "W"
 *   10–45 days  → "M"
 *   > 45 days   → "Q"
 *
 * Returns null when inference is not possible (< 2 samples, parse errors).
 * This is intentionally lightweight — the user can always override manually.
 */

import type { DataFreq } from "@/lib/types"

export interface FreqDetectionResult {
  freq:       DataFreq
  label:      string   // human-readable label, e.g. "Mensual"
  medianDays: number   // median interval in days (for tooltip)
}

const FREQ_LABELS: Record<DataFreq, string> = {
  D: "Diaria",
  W: "Semanal",
  M: "Mensual",
  Q: "Trimestral",
}

/**
 * Given a list of raw date strings (sample_values from the preview endpoint),
 * returns the inferred DataFreq or null if inference fails.
 */
export function inferFreqFromSamples(samples: string[]): FreqDetectionResult | null {
  if (samples.length < 2) return null

  // Parse dates — filter out unparseable values
  const dates = samples
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length < 2) return null

  // Compute intervals in days
  const intervals: number[] = []
  for (let i = 1; i < dates.length; i++) {
    const days = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    if (days > 0) intervals.push(days)
  }

  if (intervals.length === 0) return null

  // Median interval
  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  let freq: DataFreq
  if (median < 2)       freq = "D"
  else if (median < 10) freq = "W"
  else if (median < 46) freq = "M"
  else                  freq = "Q"

  return { freq, label: FREQ_LABELS[freq], medianDays: Math.round(median) }
}

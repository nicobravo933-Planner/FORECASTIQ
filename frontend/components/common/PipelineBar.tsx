"use client"

/**
 * PipelineBar — contextual pipeline progress bar.
 *
 * Renders a horizontal strip of chips showing where the user is
 * in the active pipeline flow, determined from appStore.
 *
 * Flow A (no entityCol): Datos → EDA → ETL → Forecast
 * Flow B (entityCol set): Datos → Multi-serie → Forecast
 *
 * Step states:
 *   completed  → filled chip, click navigates to that view
 *   active     → outlined + primary color, no-click (you're here)
 *   pending    → grey outlined, no-click
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import { appStore } from "@/lib/appStore"

type StepState = "completed" | "active" | "pending"

interface PipelineStep {
  label: string
  href:  string
  state: StepState
  tooltip?: string
}

interface PipelineBarProps {
  /**
   * Which step is the current page.
   * Pass "/dashboard/home" (or omit) to show pipeline state without any active step.
   */
  activeStep:
    | "/dashboard/home"
    | "/dashboard/dataset"
    | "/dashboard/eda"
    | "/dashboard/etl"
    | "/dashboard/forecast"
    | "/dashboard/multi-serie"
  /** When true, removes the bottom margin (useful when embedded inside a card). */
  noMargin?: boolean
}

export function PipelineBar({ activeStep, noMargin }: PipelineBarProps) {
  const router = useRouter()
  const [steps, setSteps] = useState<PipelineStep[]>([])

  useEffect(() => {
    const datasetId  = appStore.getActiveDatasetId()
    const jobId      = appStore.getActiveJobId()
    const entityCol  = appStore.getEntityCol()
    const qualScore  = appStore.getQualityScore()
    const cleanedId  = appStore.getCleanedDatasetId()

    const hasDataset = !!datasetId
    const hasQuality = !!qualScore
    const hasCleaned = !!cleanedId
    const hasForecast = !!jobId

    const stepState = (href: string, doneCondition: boolean): StepState => {
      if (href === activeStep) return "active"
      if (doneCondition)       return "completed"
      return "pending"
    }

    if (entityCol && hasDataset) {
      // Flow B: multi-entity
      setSteps([
        {
          label: "Datos",
          href:  "/dashboard/dataset",
          state: stepState("/dashboard/dataset", hasDataset),
          tooltip: hasDataset ? `Dataset activo` : "Subí un archivo para empezar",
        },
        {
          label: "Multi-serie",
          href:  "/dashboard/multi-serie",
          state: stepState("/dashboard/multi-serie", hasForecast),
          tooltip: `Columna de entidad: ${entityCol}`,
        },
        {
          label: "Forecast",
          href:  "/dashboard/forecast",
          state: stepState("/dashboard/forecast", hasForecast),
          tooltip: hasForecast ? "Resultado disponible" : "Corré un forecast primero",
        },
      ])
    } else {
      // Flow A: single series
      setSteps([
        {
          label: "Datos",
          href:  "/dashboard/dataset",
          state: stepState("/dashboard/dataset", hasDataset),
          tooltip: hasDataset ? "Dataset activo" : "Subí un archivo para empezar",
        },
        {
          label: "EDA",
          href:  "/dashboard/eda",
          state: stepState("/dashboard/eda", hasQuality),
          tooltip: hasQuality ? `Quality score: ${qualScore?.score}/100` : "Analizá tus datos primero",
        },
        {
          label: "ETL",
          href:  "/dashboard/etl",
          state: stepState("/dashboard/etl", hasCleaned),
          tooltip: hasCleaned ? "Dataset limpio disponible" : "Limpiá los datos antes del forecast",
        },
        {
          label: "Forecast",
          href:  "/dashboard/forecast",
          state: stepState("/dashboard/forecast", hasForecast),
          tooltip: hasForecast ? "Resultado disponible" : "Configurá y corré el modelo",
        },
      ])
    }
  }, [activeStep])

  if (steps.length === 0) return null

  return (
    <Box
      sx={{
        display:        "flex",
        alignItems:     "center",
        gap:            "0.375rem",
        flexWrap:       "wrap",
        px:             "1rem",
        py:             "0.5rem",
        borderRadius:   "0.75rem",
        bgcolor:        "background.paper",
        border:         "1px solid",
        borderColor:    "divider",
        mb:             noMargin ? 0 : "1.25rem",
        boxShadow:      "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {steps.map((step, idx) => (
        <Box key={step.href} sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {/* Step chip */}
          <Tooltip title={step.tooltip ?? ""} arrow>
            <span> {/* span wrapper needed — Tooltip on disabled element */}
              <Chip
                label={step.label}
                size="small"
                icon={step.state === "completed" ? <CheckCircleIcon sx={{ fontSize: "0.875rem !important" }} /> : undefined}
                variant={step.state === "active" ? "outlined" : "filled"}
                color={
                  step.state === "completed" ? "success"
                  : step.state === "active"  ? "primary"
                  : "default"
                }
                onClick={step.state === "completed" ? () => router.push(step.href) : undefined}
                sx={{
                  fontWeight:     step.state === "active" ? 700 : 500,
                  fontSize:       "0.75rem",
                  cursor:         step.state === "completed" ? "pointer" : "default",
                  opacity:        step.state === "pending" ? 0.5 : 1,
                  // Active step: stronger border
                  ...(step.state === "active" && {
                    borderWidth: "2px",
                  }),
                }}
              />
            </span>
          </Tooltip>

          {/* Arrow separator — not after last step */}
          {idx < steps.length - 1 && (
            <ArrowForwardIosIcon sx={{ fontSize: "0.625rem", color: "text.disabled" }} />
          )}
        </Box>
      ))}
    </Box>
  )
}

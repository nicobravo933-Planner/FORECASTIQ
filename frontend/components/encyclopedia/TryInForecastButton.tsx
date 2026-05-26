"use client"

/**
 * TryInForecastButton — used inside encyclopedia chapters to let the user
 * jump to the Forecast view with a model pre-selected.
 *
 * Flow:
 *   1. Saves the modelId in appStore (localStorage) via setPendingModel()
 *   2. Navigates to /dashboard/forecast
 *   3. Forecast page reads + clears the pending model on mount
 */

import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import Button from "@mui/material/Button"
import { useRouter } from "next/navigation"
import { appStore } from "@/lib/appStore"

interface TryInForecastButtonProps {
  /** Model id to pre-select — must match the ids in ForecastConfigPanel */
  modelId: "moving_average" | "ses" | "holt_simple" | "holt_winters" | "sarima" | "linear_splines" | "lightgbm"
  /** Human-readable label shown in the button */
  label?: string
}

export function TryInForecastButton({ modelId, label }: TryInForecastButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    appStore.setPendingModel(modelId)
    router.push("/dashboard/forecast")
  }

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<ShowChartIcon sx={{ fontSize: "0.9rem !important" }} />}
      endIcon={<ArrowForwardIcon sx={{ fontSize: "0.9rem !important" }} />}
      onClick={handleClick}
      sx={{
        mt: "1.5rem",
        fontSize: "0.8125rem",
        fontWeight: 600,
        borderRadius: "0.5rem",
        borderColor: "primary.main",
        color: "primary.main",
        textTransform: "none",
        "&:hover": {
          bgcolor: "rgba(59,130,246,0.06)",
          borderColor: "primary.dark",
        },
      }}
    >
      {label ?? "Probar en Forecast"}
    </Button>
  )
}

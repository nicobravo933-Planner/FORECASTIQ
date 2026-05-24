"use client"

/**
 * ActiveDatasetBar — banner compacto que muestra el dataset activo en todo el dashboard.
 *
 * Se monta una sola vez en DashboardLayout, justo debajo del header.
 * Aparece solo cuando hay un dataset_id guardado en appStore.
 * Al hacer clic va a /dashboard/forecast con el dataset pre-seleccionado.
 * Incluye botón X para ocultar sin limpiar el estado (persiste en memoria de sesión).
 */

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import DatasetLinkedIcon from "@mui/icons-material/DatasetLinked"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import CloseIcon from "@mui/icons-material/Close"
import { appStore } from "@/lib/appStore"
import { api } from "@/lib/api"
import type { DatasetListItem } from "@/lib/types"
import { getSessionIds } from "@/lib/sessionDatasets"

interface ActiveInfo {
  datasetId:  string
  filename:   string
  dateCol:    string
  targetCol:  string
  freq:       string
}

const FREQ_LABEL: Record<string, string> = {
  D: "Diaria", W: "Semanal", M: "Mensual", Q: "Trimestral",
}

// Pages where the bar is redundant (Forecast manages its own context)
const HIDDEN_ON = ["/dashboard/forecast"]

export function ActiveDatasetBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [info, setInfo]           = useState<ActiveInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id      = appStore.getActiveDatasetId()
    const dateCol = appStore.getActiveDateCol()
    const tgtCol  = appStore.getActiveTargetCol()
    const freq    = appStore.getActiveFreq()

    if (!id || !dateCol || !tgtCol) { setInfo(null); return }

    setDismissed(false)  // reset when dataset changes on navigation

    const sessionIds = getSessionIds()
    const url = sessionIds
      ? `/api/datasets/?session_ids=${encodeURIComponent(sessionIds)}`
      : "/api/datasets/"

    api.get<{ datasets: DatasetListItem[] }>(url)
      .then((res) => {
        const ds = res.datasets.find((d) => d.dataset_id === id)
        setInfo({
          datasetId: id,
          filename:  ds?.filename ?? id.slice(0, 12) + "…",
          dateCol,
          targetCol: tgtCol,
          freq:      freq ?? "M",
        })
      })
      .catch(() => {
        setInfo({ datasetId: id, filename: id.slice(0, 12) + "…", dateCol, targetCol: tgtCol, freq: freq ?? "M" })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!info || dismissed) return null
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null

  return (
    <Box
      sx={{
        position: "fixed",
        top: "4rem",           // debajo del header
        left: 0,
        right: 0,
        zIndex: 105,
        bgcolor: "rgba(15,32,68,0.93)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(59,130,246,0.3)",
        display: "flex",
        alignItems: "center",
        px: "1.25rem",
        py: "0.375rem",
        gap: "0.625rem",
        cursor: "pointer",
        "&:hover": { bgcolor: "rgba(15,32,68,1)" },
        transition: "background 0.15s",
      }}
      onClick={() => router.push("/dashboard/forecast")}
    >
      <DatasetLinkedIcon sx={{ fontSize: "0.9375rem", color: "rgba(147,197,253,0.85)", flexShrink: 0 }} />

      <Typography variant="caption"
        sx={{ color: "rgba(147,197,253,0.65)", fontWeight: 600, flexShrink: 0, fontSize: "0.6875rem" }}>
        Dataset activo:
      </Typography>

      <Typography variant="caption"
        sx={{ color: "#fff", fontWeight: 700, fontSize: "0.75rem",
          maxWidth: "14rem", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", flexShrink: 0 }}>
        {info.filename}
      </Typography>

      <Box sx={{ display: "flex", gap: "0.3125rem", flexWrap: "nowrap", alignItems: "center" }}>
        <Chip label={`📅 ${info.dateCol}`} size="small"
          sx={{ height: "1.25rem", fontSize: "0.6875rem",
            bgcolor: "rgba(59,130,246,0.25)", color: "#bfdbfe",
            border: "1px solid rgba(59,130,246,0.4)",
            "& .MuiChip-label": { px: "0.5rem" } }} />
        <Chip label={`📊 ${info.targetCol}`} size="small"
          sx={{ height: "1.25rem", fontSize: "0.6875rem",
            bgcolor: "rgba(16,185,129,0.2)", color: "#a7f3d0",
            border: "1px solid rgba(16,185,129,0.35)",
            "& .MuiChip-label": { px: "0.5rem" } }} />
        <Chip label={FREQ_LABEL[info.freq] ?? info.freq} size="small"
          sx={{ height: "1.25rem", fontSize: "0.6875rem",
            bgcolor: "rgba(139,92,246,0.2)", color: "#ddd6fe",
            border: "1px solid rgba(139,92,246,0.35)",
            "& .MuiChip-label": { px: "0.5rem" } }} />
      </Box>

      <Box sx={{ flex: 1 }} />

      <Typography variant="caption"
        sx={{ color: "rgba(147,197,253,0.55)", fontSize: "0.6875rem", flexShrink: 0 }}>
        Ir a Forecast
      </Typography>
      <ArrowForwardIosIcon sx={{ fontSize: "0.6875rem", color: "rgba(147,197,253,0.55)", flexShrink: 0 }} />

      <Tooltip title="Ocultar barra">
        <IconButton size="small"
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          sx={{ color: "rgba(147,197,253,0.45)", "&:hover": { color: "#fff" }, p: "0.1875rem", ml: "0.25rem" }}>
          <CloseIcon sx={{ fontSize: "0.875rem" }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

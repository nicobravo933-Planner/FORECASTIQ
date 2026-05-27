"use client"

/**
 * EDA page — Análisis Exploratorio de Datos (E1).
 *
 * DatasetSelector en el header:
 *  - Dropdown de dataset
 *  - Selectores inline de columna fecha / objetivo / frecuencia
 *  - Se actualiza appStore en tiempo real al cambiar cualquier selector
 *
 * El análisis se dispara automáticamente cuando los 4 valores están presentes.
 */

import { useCallback, useEffect, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Typography from "@mui/material/Typography"
import AssessmentIcon from "@mui/icons-material/Assessment"

import { appStore } from "@/lib/appStore"
import { api } from "@/lib/api"
import { useEda } from "@/hooks/useEda"
import { QualityScoreCard } from "@/components/eda/QualityScoreCard"
import { SeriesSummaryTable } from "@/components/eda/SeriesSummaryTable"
import { OutlierChart } from "@/components/eda/OutlierChart"
import { DatasetSelector } from "@/components/common/DatasetSelector"
import { PipelineBar } from "@/components/common/PipelineBar"

interface PreviewRow { [key: string]: string }
interface PreviewResponse { rows: PreviewRow[]; total_rows: number }

export default function EdaPage() {
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [dateCol,   setDateCol]   = useState<string | null>(null)
  const [targetCol, setTargetCol] = useState<string | null>(null)
  const [freq,      setFreq]      = useState<string | null>(null)

  const [seriesData, setSeriesData]       = useState<Array<{ date: string; value: number }>>([])
  const [seriesLoading, setSeriesLoading] = useState(false)

  // Read appStore on client mount
  useEffect(() => {
    setDatasetId(appStore.getActiveDatasetId())
    setDateCol(appStore.getActiveDateCol())
    setTargetCol(appStore.getActiveTargetCol())
    setFreq(appStore.getActiveFreq())
  }, [])

  // DatasetSelector calls this whenever dataset OR columns change
  // appStore is already updated before this fires — just re-sync local state
  const handleDatasetSelect = useCallback((newId: string) => {
    setDatasetId(newId)
    setDateCol(appStore.getActiveDateCol())
    setTargetCol(appStore.getActiveTargetCol())
    setFreq(appStore.getActiveFreq())
    setSeriesData([])
  }, [])

  // Load series for OutlierChart
  useEffect(() => {
    if (!datasetId || !dateCol || !targetCol) return
    setSeriesLoading(true)
    api
      .get<PreviewResponse>(`/api/datasets/${datasetId}/page?page=1&page_size=200`)
      .then((res) => {
        const pts = res.rows
          .map((r) => ({ date: r[dateCol] ?? "", value: parseFloat(r[targetCol] ?? "0") }))
          .filter((pt) => pt.date && !isNaN(pt.value))
          .sort((a, b) => a.date.localeCompare(b.date))
        setSeriesData(pts)
      })
      .catch(() => setSeriesData([]))
      .finally(() => setSeriesLoading(false))
  }, [datasetId, dateCol, targetCol])

  const { summary, outliers, quality, models, loading, error } = useEda({
    datasetId,
    dateCol,
    targetCol,
    freq,
  })

  // E5: persist quality score to appStore
  useEffect(() => {
    if (!quality || !models) return
    const availIds = models.models.filter((m) => m.available).map((m) => m.id)
    appStore.setQualityScore(quality.score, quality.label, availIds)
  }, [quality, models])

  const canAnalyze = !!datasetId && !!dateCol && !!targetCol

  return (
    <Box sx={{ width: "100%" }}>

      {/* ── Header ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: "1rem", mb: "1.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <AssessmentIcon sx={{ fontSize: "1.75rem", color: "primary.main" }} />
          <Box>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
              Análisis Exploratorio
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.125rem" }}>
              {summary
                ? `${summary.n_observations.toLocaleString()} obs · ${summary.date_start} → ${summary.date_end} · ${summary.freq}`
                : canAnalyze
                  ? "Analizando…"
                  : "Seleccioná un dataset para analizar"
              }
            </Typography>
          </Box>
        </Box>

        <DatasetSelector
          activeDatasetId={datasetId}
          onSelect={handleDatasetSelect}
          showEtlBadge
        />
      </Box>

      {/* ── Pipeline progress bar ── */}
      <PipelineBar activeStep="/dashboard/eda" showEtlCta />

      {/* ── Empty state: no dataset ── */}
      {!datasetId && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "40vh", flexDirection: "column", gap: "1rem" }}>
          <AssessmentIcon sx={{ fontSize: "4rem", color: "text.disabled", opacity: 0.4 }} />
          <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "text.secondary" }}>
            Seleccioná un dataset para empezar el análisis
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", textAlign: "center", maxWidth: "28rem" }}>
            Usá el selector de arriba. Se detectan automáticamente las columnas de fecha
            y objetivo — podés ajustarlas con los selectores inline si es necesario.
          </Typography>
        </Box>
      )}

      {/* ── Waiting for columns ── */}
      {datasetId && !canAnalyze && !loading && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "30vh", flexDirection: "column", gap: "0.75rem" }}>
          <CircularProgress size={32} />
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            Detectando columnas…
          </Typography>
        </Box>
      )}

      {/* ── Loading ── */}
      {canAnalyze && loading && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "60vh", gap: "1rem" }}>
          <CircularProgress size={40} />
          <Typography sx={{ fontSize: "0.9375rem", color: "text.secondary" }}>
            Analizando el dataset…
          </Typography>
        </Box>
      )}

      {/* ── Error ── */}
      {canAnalyze && error && (
        <Alert severity="error" sx={{ mt: "1rem", borderRadius: "0.75rem" }}>{error}</Alert>
      )}

      {/* ── Main content ── */}
      {canAnalyze && !loading && !error && summary && outliers && quality && models && (
        <>
          {/* ── Fila 1: Quality Score + Serie + Modelos ──
               Grid 3-col: [18rem quality] [1fr chart] [15rem models]
               alignItems stretch = misma altura en las 3 columnas */}
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "18rem 1fr" },
            gap: "1.25rem",
            mb: "1.25rem",
            alignItems: "stretch",
          }}>

            {/* Col 1: Quality Score */}
            <QualityScoreCard data={quality} />

            {/* Col 2: Serie con outliers */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {summary.n_observations < 24 && (
                <Alert severity="warning" sx={{ borderRadius: "0.75rem" }}>
                  <strong>Historia insuficiente para Holt-Winters.</strong>{" "}
                  Tu serie tiene {summary.n_observations} observaciones. Holt-Winters requiere al menos
                  24. Solo Moving Average disponible.
                </Alert>
              )}
              {summary.n_observations < 8 && (
                <Alert severity="error" sx={{ borderRadius: "0.75rem" }}>
                  <strong>Serie demasiado corta.</strong>{" "}
                  Con {summary.n_observations} observaciones no es posible hacer un forecast confiable.
                  Necesitás al menos 8 períodos.
                </Alert>
              )}
              {seriesLoading ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                  flex: 1, minHeight: "18rem" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : seriesData.length > 0 ? (
                <OutlierChart summary={summary} outliers={outliers} series={seriesData} />
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                  flex: 1, minHeight: "18rem", bgcolor: "rgba(0,0,0,0.02)",
                  borderRadius: "0.75rem", border: "1px dashed", borderColor: "divider" }}>
                  <Typography sx={{ fontSize: "0.875rem", color: "text.disabled" }}>
                    No se pudo cargar la serie para el gráfico
                  </Typography>
                </Box>
              )}
            </Box>

          </Box>

          {/* ── Fila 2: Tabla de estadísticas + completitud inline */}
          <SeriesSummaryTable data={summary} />
        </>
      )}
    </Box>
  )
}

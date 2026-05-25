"use client"

/**
 * EDA page — Análisis Exploratorio de Datos (E1).
 *
 * El DatasetSelector en el header permite elegir qué dataset analizar
 * sin necesidad de pasar por otra vista. Al cambiar el dataset se resetea
 * el análisis y se recalculan todos los endpoints de EDA.
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
import { ModelsAvailablePanel } from "@/components/eda/ModelsAvailablePanel"
import { DataCompletenessBar } from "@/components/eda/DataCompletenessBar"
import { DatasetSelector } from "@/components/common/DatasetSelector"

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

  // When DatasetSelector activates a new dataset, re-read appStore
  const handleDatasetSelect = useCallback((newId: string) => {
    setDatasetId(newId)
    setDateCol(appStore.getActiveDateCol())
    setTargetCol(appStore.getActiveTargetCol())
    setFreq(appStore.getActiveFreq())
    setSeriesData([])   // reset chart
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

  // E5: persist quality score to appStore so Forecast reads it without re-calling backend
  useEffect(() => {
    if (!quality || !models) return
    const availIds = models.models.filter((m) => m.available).map((m) => m.id)
    appStore.setQualityScore(quality.score, quality.label, availIds)
  }, [quality, models])

  return (
    <Box sx={{ maxWidth: "75rem", mx: "auto" }}>

      {/* ── Page header with inline DatasetSelector ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: "1rem", mb: "1.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <AssessmentIcon sx={{ fontSize: "1.75rem", color: "primary.main" }} />
          <Box>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
              Análisis Exploratorio
            </Typography>
            {summary ? (
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.125rem" }}>
                {summary.n_observations.toLocaleString()} observaciones ·{" "}
                {summary.date_start} → {summary.date_end} · frecuencia {summary.freq}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.125rem" }}>
                Seleccioná un dataset para analizar
              </Typography>
            )}
          </Box>
        </Box>

        {/* Dataset selector — always visible in the header */}
        <DatasetSelector
          activeDatasetId={datasetId}
          onSelect={handleDatasetSelect}
          showEtlBadge
        />
      </Box>

      {/* ── Empty state: no dataset selected ── */}
      {!datasetId && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "40vh", flexDirection: "column", gap: "1rem" }}>
          <AssessmentIcon sx={{ fontSize: "4rem", color: "text.disabled", opacity: 0.4 }} />
          <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "text.secondary" }}>
            Seleccioná un dataset para empezar el análisis
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", textAlign: "center", maxWidth: "28rem" }}>
            Usá el selector de arriba para elegir uno de tus datasets o cargar el demo.
            El EDA calcula automáticamente la calidad de los datos, detecta outliers y
            recomienda los mejores modelos.
          </Typography>
        </Box>
      )}

      {/* ── Missing columns warning ── */}
      {datasetId && (!dateCol || !targetCol) && !loading && (
        <Alert severity="warning" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>
          <strong>Columnas no detectadas automáticamente.</strong>{" "}
          Andá a la vista{" "}
          <a href="/dashboard/dataset" style={{ color: "inherit", fontWeight: 700 }}>
            Datos
          </a>{" "}
          para seleccionar manualmente las columnas de fecha y objetivo.
        </Alert>
      )}

      {/* ── Loading ── */}
      {datasetId && loading && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "60vh", gap: "1rem" }}>
          <CircularProgress size={40} />
          <Typography sx={{ fontSize: "0.9375rem", color: "text.secondary" }}>
            Analizando el dataset…
          </Typography>
        </Box>
      )}

      {/* ── Error ── */}
      {datasetId && error && (
        <Alert severity="error" sx={{ mt: "1rem", borderRadius: "0.75rem" }}>{error}</Alert>
      )}

      {/* ── Main content — only when data is ready ── */}
      {datasetId && !loading && !error && summary && outliers && quality && models && (
        <>
          {/* Row 1: Quality Score + Outlier Chart */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "22rem 1fr" },
            gap: "1.25rem", mb: "1.25rem" }}>
            <QualityScoreCard data={quality} />
            <Box>
              {seriesLoading ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", minHeight: "16rem" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : seriesData.length > 0 ? (
                <OutlierChart summary={summary} outliers={outliers} series={seriesData} />
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", minHeight: "16rem", bgcolor: "rgba(0,0,0,0.02)",
                  borderRadius: "0.75rem", border: "1px dashed", borderColor: "divider" }}>
                  <Typography sx={{ fontSize: "0.875rem", color: "text.disabled" }}>
                    No se pudo cargar la serie para el gráfico
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Banners: insufficient history */}
          {summary.n_observations < 24 && (
            <Alert severity="warning" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>
              <strong>Historia insuficiente para Holt-Winters.</strong>{" "}
              Tu serie tiene {summary.n_observations} observaciones. Holt-Winters requiere al menos
              2 ciclos estacionales completos (mínimo recomendado: 24). Solo Moving Average disponible.
            </Alert>
          )}
          {summary.n_observations < 8 && (
            <Alert severity="error" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>
              <strong>Serie demasiado corta.</strong>{" "}
              Con {summary.n_observations} observaciones no es posible hacer un forecast confiable.
              Necesitás al menos 8 períodos para Moving Average.
            </Alert>
          )}

          {/* Completeness bar */}
          <Box sx={{ mb: "1.25rem" }}>
            <DataCompletenessBar data={summary} />
          </Box>

          {/* Row 2: Summary table + Models */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 22rem" },
            gap: "1.25rem" }}>
            <SeriesSummaryTable data={summary} />
            <ModelsAvailablePanel data={models} />
          </Box>
        </>
      )}
    </Box>
  )
}

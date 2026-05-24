"use client"

/**
 * EDA page — Análisis Exploratorio de Datos (E1).
 *
 * Lee dataset_id, dateCol, targetCol y freq desde appStore (localStorage).
 * Construye la serie para el OutlierChart desde el endpoint /preview.
 * Layout: Quality Score (izq) | Gráfico outliers (der) / Resumen | Modelos
 */

import { useEffect, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import Typography from "@mui/material/Typography"
import AssessmentIcon from "@mui/icons-material/Assessment"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import Link from "next/link"

import { appStore } from "@/lib/appStore"
import { api } from "@/lib/api"
import { useEda } from "@/hooks/useEda"
import { QualityScoreCard } from "@/components/eda/QualityScoreCard"
import { SeriesSummaryTable } from "@/components/eda/SeriesSummaryTable"
import { OutlierChart } from "@/components/eda/OutlierChart"
import { ModelsAvailablePanel } from "@/components/eda/ModelsAvailablePanel"
import { DataCompletenessBar } from "@/components/eda/DataCompletenessBar"

// Preview response shape (subset de lo que retorna el backend)
interface PreviewRow {
  [key: string]: string
}
interface PreviewResponse {
  rows: PreviewRow[]
  total_rows: number
}

export default function EdaPage() {
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [dateCol,   setDateCol]   = useState<string | null>(null)
  const [targetCol, setTargetCol] = useState<string | null>(null)
  const [freq,      setFreq]      = useState<string | null>(null)

  // Serie completa para el OutlierChart (cargada desde /preview paginado)
  const [seriesData, setSeriesData] = useState<Array<{ date: string; value: number }>>([])
  const [seriesLoading, setSeriesLoading] = useState(false)

  // Leer appStore en el cliente (no en SSR)
  useEffect(() => {
    setDatasetId(appStore.getActiveDatasetId())
    setDateCol(appStore.getActiveDateCol())
    setTargetCol(appStore.getActiveTargetCol())
    setFreq(appStore.getActiveFreq())
  }, [])

  // Cargar la serie completa desde /preview para el gráfico
  useEffect(() => {
    if (!datasetId || !dateCol || !targetCol) return

    setSeriesLoading(true)
    api
      .get<PreviewResponse>(`/api/datasets/${datasetId}/page?page=1&page_size=200`)
      .then((res) => {
        const pts = res.rows
          .map((r) => ({
            date:  r[dateCol]   ?? "",
            value: parseFloat(r[targetCol] ?? "0"),
          }))
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

  // E5: persistir quality score en appStore para que Forecast lo lea sin re-llamar al backend
  useEffect(() => {
    if (!quality || !models) return
    const availIds = models.models.filter((m) => m.available).map((m) => m.id)
    appStore.setQualityScore(quality.score, quality.label, availIds)
  }, [quality, models])

  // Estado: sin dataset activo
  if (!datasetId || !dateCol || !targetCol) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "1rem" }}>
        <AssessmentIcon sx={{ fontSize: "3.5rem", color: "text.disabled" }} />
        <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, color: "text.secondary" }}>
          No hay dataset activo
        </Typography>
        <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", textAlign: "center", maxWidth: "26rem" }}>
          Subí un dataset y seleccioná las columnas de fecha y objetivo en la vista de datos.
        </Typography>
        <Button component={Link} href="/dashboard/forecast" variant="outlined" startIcon={<ArrowBackIcon />}>
          Ir a Forecast
        </Button>
      </Box>
    )
  }

  // Estado: cargando
  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "1rem" }}>
        <CircularProgress size={40} />
        <Typography sx={{ fontSize: "0.9375rem", color: "text.secondary" }}>
          Analizando el dataset…
        </Typography>
      </Box>
    )
  }

  // Estado: error
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: "1rem", borderRadius: "0.75rem" }}>
        {error}
      </Alert>
    )
  }

  // Sin datos aún (loading acabó pero no llegaron datos — edge case)
  if (!summary || !outliers || !quality || !models) return null

  return (
    <Box sx={{ maxWidth: "75rem", mx: "auto" }}>
      {/* Header de la página */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", mb: "1.75rem" }}>
        <AssessmentIcon sx={{ fontSize: "1.75rem", color: "primary.main" }} />
        <Box>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
            Análisis Exploratorio
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.125rem" }}>
            {summary.n_observations.toLocaleString()} observaciones ·{" "}
            {summary.date_start} → {summary.date_end} · frecuencia {summary.freq}
          </Typography>
        </Box>
      </Box>

      {/* Layout: Quality Score + Gráfico en la primera fila */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "22rem 1fr" },
          gap: "1.25rem",
          mb: "1.25rem",
        }}
      >
        <QualityScoreCard data={quality} />

        {/* Gráfico de outliers — solo si tenemos la serie cargada */}
        <Box>
          {seriesLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "16rem" }}>
              <CircularProgress size={28} />
            </Box>
          ) : seriesData.length > 0 ? (
            <OutlierChart summary={summary} outliers={outliers} series={seriesData} />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "16rem", bgcolor: "rgba(0,0,0,0.02)", borderRadius: "0.75rem", border: "1px dashed", borderColor: "divider" }}>
              <Typography sx={{ fontSize: "0.875rem", color: "text.disabled" }}>
                No se pudo cargar la serie para el gráfico
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Banner: historia insuficiente para Holt-Winters (< 24 obs) */}
      {summary.n_observations < 24 && (
        <Alert severity="warning" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>
          <strong>Historia insuficiente para Holt-Winters.</strong>{" "}
          Tu serie tiene {summary.n_observations} observaciones. Holt-Winters requiere al menos
          2 ciclos estacionales completos (mínimo recomendado: 24). Solo Moving Average disponible.
        </Alert>
      )}

      {/* Banner: serie muy corta en general (< 8 obs) */}
      {summary.n_observations < 8 && (
        <Alert severity="error" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>
          <strong>Serie demasiado corta.</strong>{" "}
          Con {summary.n_observations} observaciones no es posible hacer un forecast confiable.
          Necesitás al menos 8 períodos para Moving Average.
        </Alert>
      )}

      {/* Barra de completitud */}
      <Box sx={{ mb: "1.25rem" }}>
        <DataCompletenessBar data={summary} />
      </Box>

      {/* Segunda fila: Resumen + Modelos */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 22rem" },
          gap: "1.25rem",
        }}
      >
        <SeriesSummaryTable data={summary} />
        <ModelsAvailablePanel data={models} />
      </Box>
    </Box>
  )
}

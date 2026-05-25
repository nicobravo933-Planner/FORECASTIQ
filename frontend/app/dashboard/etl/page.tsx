"use client"

/**
 * ETL page — Limpieza de Datos (E2).
 *
 * DatasetSelector en el header permite cambiar el dataset a limpiar sin
 * salir de la vista. El análisis se resetea al cambiar de dataset.
 *
 * Two tabs:
 *   Tab 0: Winsorización — clip extreme values
 *   Tab 1: Imputación de gaps — fill missing time periods
 */

import { useCallback, useEffect, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import Typography from "@mui/material/Typography"
import Snackbar from "@mui/material/Snackbar"
import CleaningServicesIcon from "@mui/icons-material/CleaningServices"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import Link from "next/link"

import { appStore } from "@/lib/appStore"
import { api } from "@/lib/api"
import { useEtl } from "@/hooks/useEtl"
import { useEda } from "@/hooks/useEda"
import { BeforeAfterChart } from "@/components/etl/BeforeAfterChart"
import { WinsorizationPanel } from "@/components/etl/WinsorizationPanel"
import { FillGapsPanel } from "@/components/etl/FillGapsPanel"
import { ExportButton } from "@/components/dataset/ExportButton"
import { DatasetSelector } from "@/components/common/DatasetSelector"

interface Capabilities { tier: string }

// E5: model unlock thresholds
const MODEL_UNLOCK_THRESHOLDS: Record<number, string> = {
  30: "Holt-Winters",
  60: "SARIMA",
  80: "LightGBM",
}
const MODEL_SCORE_CATALOG: Record<string, number> = {
  moving_average: 0,
  holt_winters: 30,
  sarima: 60,
  lightgbm: 80,
}

export default function EtlPage() {
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [dateCol,   setDateCol]   = useState<string | null>(null)
  const [targetCol, setTargetCol] = useState<string | null>(null)
  const [freq,      setFreq]      = useState<string | null>(null)

  const [tier, setTier]           = useState<"local" | "cloud">("cloud")
  const [tierLoaded, setTierLoaded] = useState(false)
  const [tab, setTab]             = useState(0)

  // Read appStore on client mount
  useEffect(() => {
    setDatasetId(appStore.getActiveDatasetId())
    setDateCol(appStore.getActiveDateCol())
    setTargetCol(appStore.getActiveTargetCol())
    setFreq(appStore.getActiveFreq())
  }, [])

  // Load server tier
  useEffect(() => {
    api
      .get<Capabilities>("/api/capabilities")
      .then((c) => setTier(c.tier === "local" ? "local" : "cloud"))
      .catch(() => setTier("cloud"))
      .finally(() => setTierLoaded(true))
  }, [])

  // When DatasetSelector activates a new dataset, re-read appStore
  const handleDatasetSelect = useCallback((newId: string) => {
    setDatasetId(newId)
    setDateCol(appStore.getActiveDateCol())
    setTargetCol(appStore.getActiveTargetCol())
    setFreq(appStore.getActiveFreq())
    setTab(0)  // reset to first tab
  }, [])

  const { summary: edaSummary } = useEda({ datasetId, dateCol, targetCol, freq })

  const {
    loading, error, mode,
    winsorize, fillGaps,
    activeDatasetId,
    applyWinsorize, applyFillGaps, resetToOriginal,
  } = useEtl({ datasetId, dateCol, targetCol, freq })

  const etlApplied = activeDatasetId !== datasetId && activeDatasetId !== null

  // E5: notify when ETL unlocks new models
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null)

  useEffect(() => {
    const result = tab === 0 ? winsorize : fillGaps
    if (!result) return
    const prevQ     = appStore.getQualityScore()
    const prevScore = prevQ?.score ?? 0
    const newScore  = result.new_quality_score
    if (newScore <= prevScore) return
    const crossed = Object.entries(MODEL_UNLOCK_THRESHOLDS)
      .filter(([thresh]) => prevScore < Number(thresh) && newScore >= Number(thresh))
      .map(([, label]) => label)
    if (crossed.length > 0) {
      setUnlockMsg(`¡${crossed.join(" y ")} desbloqueado${crossed.length > 1 ? "s" : ""}! Score: ${newScore}`)
    }
    const newModelIds = Object.entries(MODEL_SCORE_CATALOG)
      .filter(([, min]) => newScore >= min)
      .map(([id]) => id)
    appStore.setQualityScore(newScore, result.new_quality_label, newModelIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winsorize, fillGaps])

  if (!tierLoaded) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: "1rem" }}>
        <CircularProgress size={32} />
      </Box>
    )
  }

  const activeResult = tab === 0 ? winsorize : fillGaps
  const activeMode   = tab === 0 ? "winsorize" : "fill-gaps"
  const nChanged     = tab === 0 ? (winsorize?.n_winsorized ?? 0) : (fillGaps?.n_imputed ?? 0)

  return (
    <Box sx={{ maxWidth: "75rem", mx: "auto" }}>

      {/* ── Page header with DatasetSelector ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        mb: "1.75rem", flexWrap: "wrap", gap: "0.75rem" }}>

        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <CleaningServicesIcon sx={{ fontSize: "1.75rem", color: "primary.main" }} />
          <Box>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
              Limpieza de Datos — ETL
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.125rem" }}>
              {datasetId
                ? <>Dataset: <code style={{ fontSize: "0.75rem" }}>{datasetId.slice(0, 8)}…</code>
                    {etlApplied && (
                      <Box component="span" sx={{ ml: "0.625rem", px: "0.5rem", py: "0.125rem",
                        bgcolor: "rgba(34,197,94,0.1)", color: "#16a34a",
                        borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 600 }}>
                        ✓ ETL aplicado
                      </Box>
                    )}
                  </>
                : "Seleccioná un dataset para limpiar"
              }
            </Typography>
          </Box>
        </Box>

        {/* Right: selector + action buttons */}
        <Box sx={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", alignItems: "center" }}>
          <DatasetSelector
            activeDatasetId={datasetId}
            onSelect={handleDatasetSelect}
            showEtlBadge
          />
          {etlApplied && (
            <Button variant="outlined" size="small" startIcon={<RestartAltIcon />}
              onClick={resetToOriginal} sx={{ textTransform: "none", fontWeight: 600 }}>
              Volver al original
            </Button>
          )}
          {datasetId && (
            <ExportButton datasetId={activeDatasetId ?? datasetId} showBoth />
          )}
          <Button component={Link} href="/dashboard/forecast" variant="contained" size="small"
            endIcon={<ArrowForwardIcon />} sx={{ textTransform: "none", fontWeight: 600 }}>
            Ir a Forecast
          </Button>
        </Box>
      </Box>

      {/* ── Empty state when no dataset ── */}
      {!datasetId && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "40vh", flexDirection: "column", gap: "1rem" }}>
          <CleaningServicesIcon sx={{ fontSize: "4rem", color: "text.disabled", opacity: 0.4 }} />
          <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "text.secondary" }}>
            Seleccioná un dataset para limpiar
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", textAlign: "center", maxWidth: "28rem" }}>
            Usá el selector de arriba para elegir un dataset. Podés winsorizarlo o imputar
            gaps antes de hacer el forecast.
          </Typography>
        </Box>
      )}

      {/* ── Content — only when dataset is active ── */}
      {datasetId && (
        <>
          {etlApplied && (
            <Alert severity="success" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>
              <strong>Dataset limpio activo.</strong>{" "}
              El forecast usará automáticamente los datos procesados. Podés volver al original
              con el botón &quot;Volver al original&quot;.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: "1.25rem", borderRadius: "0.75rem" }}>{error}</Alert>
          )}

          <Tabs value={tab} onChange={(_e, v) => setTab(v as number)}
            sx={{ mb: "1.5rem", borderBottom: "1px solid", borderColor: "divider" }}>
            <Tab label="Winsorización"       sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
            <Tab label="Imputación de gaps"  sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
          </Tabs>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "20rem 1fr" },
            gap: "1.25rem", alignItems: "start" }}>
            {tab === 0 ? (
              <WinsorizationPanel tier={tier} loading={loading && mode === "winsorize"}
                onApply={applyWinsorize} currentResult={winsorize ?? null} />
            ) : (
              <FillGapsPanel loading={loading && mode === "fill-gaps"}
                nGaps={edaSummary?.n_gaps ?? 0}
                onApply={applyFillGaps} currentResult={fillGaps ?? null} />
            )}

            {activeResult ? (
              <BeforeAfterChart series={activeResult.series}
                mode={activeMode as "winsorize" | "fill-gaps"} nChanged={nChanged}
                winsorLower={tab === 0 && winsorize ? winsorize.winsor_lower : undefined}
                winsorUpper={tab === 0 && winsorize ? winsorize.winsor_upper : undefined}
              />
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "20rem", bgcolor: "rgba(0,0,0,0.02)", borderRadius: "0.75rem",
                border: "1px dashed", borderColor: "divider", flexDirection: "column", gap: "0.625rem" }}>
                {loading ? (
                  <>
                    <CircularProgress size={28} />
                    <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>Procesando…</Typography>
                  </>
                ) : (
                  <>
                    <CleaningServicesIcon sx={{ fontSize: "2.5rem", color: "text.disabled" }} />
                    <Typography sx={{ fontSize: "0.875rem", color: "text.disabled" }}>
                      {tab === 0
                        ? "Configurá los percentiles y aplicá la winsorización para ver el resultado."
                        : "Elegí el método e imputá los gaps para ver la serie completada."}
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Box>
        </>
      )}

      {/* E5: unlock snackbar */}
      <Snackbar open={unlockMsg !== null} autoHideDuration={5000}
        onClose={() => setUnlockMsg(null)} message={unlockMsg ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        ContentProps={{ sx: { bgcolor: "success.main", color: "success.contrastText",
          fontWeight: 700, fontSize: "0.875rem", borderRadius: "0.5rem" } }}
      />
    </Box>
  )
}

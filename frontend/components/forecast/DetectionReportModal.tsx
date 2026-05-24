"use client"

/**
 * DetectionReportModal — E6.
 *
 * Shows the full transparent detection pipeline step by step:
 *   1. History length check
 *   2. Outlier detection (MAD)
 *   3. Seasonality (FFT)
 *   4. Trend (Seasonal Mann-Kendall)
 *   5. Volatility (CV)
 *   → Decision: why THIS model was chosen
 *
 * Data comes from the cached DetectionResult in appStore (set after POST /detect).
 * No backend call needed here — zero latency.
 */

import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import LinearProgress from "@mui/material/LinearProgress"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import CancelIcon from "@mui/icons-material/Cancel"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import PsychologyIcon from "@mui/icons-material/Psychology"
import type { DecisionStep, DetectionResult } from "@/lib/types"

// ── Model display helpers ─────────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  moving_average: "Promedio Móvil",
  holt_winters:   "Holt-Winters",
  sarima:         "SARIMA",
  lightgbm:       "LightGBM",
}

const MODEL_COLORS: Record<string, "default" | "primary" | "secondary" | "warning" | "success"> = {
  moving_average: "default",
  holt_winters:   "primary",
  sarima:         "secondary",
  lightgbm:       "success",
}

// ── Sub-component: single decision step card ──────────────────────────────────

function StepCard({ step, isLast }: { step: DecisionStep; isLast: boolean }) {
  // Step 2 (outliers) is always informative — no pass/fail coloring
  const isInformative = step.step === 2

  const borderColor = isInformative
    ? "rgba(148,163,184,0.3)"
    : step.passed
    ? "rgba(34,197,94,0.35)"
    : "rgba(234,179,8,0.35)"

  const bgColor = isInformative
    ? undefined
    : step.passed
    ? "rgba(34,197,94,0.06)"
    : "rgba(234,179,8,0.06)"

  const iconBg = isInformative
    ? "action.selected"
    : step.passed
    ? "rgba(34,197,94,0.85)"
    : "rgba(234,179,8,0.85)"

  return (
    <Box sx={{ display: "flex", gap: "0.875rem", mb: isLast ? 0 : "0.5rem" }}>
      {/* Left: icon + connector */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "1.75rem" }}>
        <Box
          sx={{
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: iconBg,
            flexShrink: 0,
          }}
        >
          {isInformative ? (
            <InfoOutlinedIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
          ) : step.passed ? (
            <CheckCircleIcon sx={{ fontSize: "0.9rem", color: "white" }} />
          ) : (
            <CancelIcon sx={{ fontSize: "0.9rem", color: "white" }} />
          )}
        </Box>
        {!isLast && (
          <Box sx={{ width: "2px", flex: 1, minHeight: "0.75rem", bgcolor: "divider", mt: "0.25rem" }} />
        )}
      </Box>

      {/* Right: content card */}
      <Box
        sx={{
          flex: 1,
          p: "0.75rem",
          borderRadius: "0.5rem",
          border: "1px solid",
          mb: isLast ? 0 : "0.25rem",
        }}
        style={{ borderColor, backgroundColor: bgColor }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", mb: "0.25rem" }}>
          <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ fontSize: "0.8125rem" }}>
            {step.label}
          </Typography>
          <Chip
            label={step.value}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.6875rem", height: "1.25rem" }}
          />
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: "0.25rem", fontSize: "0.6875rem" }}>
          Umbral: {step.threshold}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
          {step.explanation}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface DetectionReportModalProps {
  open:    boolean
  onClose: () => void
  report:  DetectionResult | null
}

export function DetectionReportModal({ open, onClose, report }: DetectionReportModalProps) {
  if (!report) return null

  const modelLabel    = MODEL_LABELS[report.model] ?? report.model
  const modelColor    = MODEL_COLORS[report.model]  ?? "default"
  const confidencePct = Math.round(report.confidence * 100)

  const steps = report.decision_steps ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: "0.75rem" } }}
    >
      <DialogTitle sx={{ pb: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <PsychologyIcon sx={{ color: "primary.main", fontSize: "1.375rem" }} />
          <Typography variant="h6" fontWeight={700}>
            ¿Por qué este modelo?
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem", fontWeight: 400 }}>
          El detector automático explica su razonamiento paso a paso.
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: "1.25rem" }}>

        {/* ── Resultado final ── */}
        <Box
          sx={{ p: "1rem", mb: "1.25rem", borderRadius: "0.625rem", border: "1px solid" }}
          style={{ backgroundColor: "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.4)" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", mb: "0.5rem" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: "0.75rem" }}>
              MODELO SELECCIONADO
            </Typography>
            <Chip label={modelLabel} color={modelColor} size="small" sx={{ fontWeight: 700 }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: "0.75rem" }}>
            {report.reason}
          </Typography>
          {/* Confidence bar */}
          <Tooltip title={`Nivel de confianza del detector: ${confidencePct}%`} placement="bottom">
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "help" }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6875rem", minWidth: "5rem" }}>
                Confianza: {confidencePct}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={confidencePct}
                sx={{ flex: 1, height: "0.375rem", borderRadius: "0.25rem" }}
                color={confidencePct >= 80 ? "success" : confidencePct >= 65 ? "warning" : "error"}
              />
            </Box>
          </Tooltip>
        </Box>

        {/* ── Stats rápidas ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", mb: "1.25rem" }}>
          {[
            { label: "Observaciones", value: String(report.n_observations) },
            { label: "Outliers",      value: `${report.outlier_count} (${report.outlier_pct.toFixed(1)}%)` },
            { label: "CV",            value: report.cv.toFixed(3) },
          ].map(({ label, value }) => (
            <Box key={label} sx={{ p: "0.625rem", borderRadius: "0.375rem", bgcolor: "action.hover", textAlign: "center" }}>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", fontSize: "0.625rem" }}>
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700} color="text.primary">
                {value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: "1.25rem" }} />

        {/* ── Pipeline de pasos ── */}
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mb: "0.875rem" }}>
          Pipeline de detección
        </Typography>

        {steps.length === 0 ? (
          <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>
            Los pasos de detección no están disponibles. Usá el botón &ldquo;Analizar serie&rdquo; para regenerarlos.
          </Alert>
        ) : (
          <Box>
            {steps.map((step, idx) => (
              <StepCard key={step.step} step={step} isLast={idx === steps.length - 1} />
            ))}
          </Box>
        )}

        {/* ── Nota educativa ── */}
        <Alert
          severity="info"
          sx={{ mt: "1rem", fontSize: "0.75rem" }}
          icon={<InfoOutlinedIcon fontSize="small" />}
        >
          Podés anular la recomendación cambiando el modelo manualmente en el panel de configuración.
          El detector es un punto de partida — no una obligación.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: "1.25rem", py: "0.875rem" }}>
        <Button onClick={onClose} variant="contained" size="small">
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  )
}

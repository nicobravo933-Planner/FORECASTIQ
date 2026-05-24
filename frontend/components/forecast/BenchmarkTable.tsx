"use client"

/**
 * BenchmarkTable — E7.
 *
 * Renders a multi-model comparison table from a BenchmarkResult.
 * Columns: Model | WAPE | MAE | BIAS | RMSE | FVA vs Naive
 *
 * Visual cues:
 *   - Winner row: gold border + trophy icon
 *   - Seasonal Naive row: grey (baseline reference)
 *   - WAPE semaphore: green ≤ 15% | yellow ≤ 30% | red > 30%
 *   - FVA: green if positive (model beats naive), red if negative
 *   - Error rows: shown with warning icon + error message
 *
 * Also shows the auto-generated educational conclusion at the bottom.
 */

import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import Alert from "@mui/material/Alert"
import Divider from "@mui/material/Divider"
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents"
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import type { BenchmarkResult, BenchmarkModelResult } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface BenchmarkTableProps {
  result: BenchmarkResult
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** WAPE color: green ≤ 15%, yellow ≤ 30%, red > 30% */
function wapeColor(wape: number | null): string {
  if (wape === null) return "text.disabled"
  if (wape <= 0.15)  return "success.main"
  if (wape <= 0.30)  return "warning.main"
  return "error.main"
}

/** Format a metric value as percentage or absolute with fallback dash */
function fmtPct(v: number | null, decimals = 1): string {
  if (v === null || v === undefined) return "—"
  return `${(v * 100).toFixed(decimals)}%`
}

function fmtAbs(v: number | null, decimals = 0): string {
  if (v === null || v === undefined) return "—"
  return v.toFixed(decimals)
}

function fmtFva(v: number | null): string {
  if (v === null || v === undefined) return "—"
  const sign = v >= 0 ? "+" : ""
  return `${sign}${v.toFixed(1)}%`
}

// ── FVA chip ──────────────────────────────────────────────────────────────────

function FvaChip({ fva }: { fva: number | null }) {
  if (fva === null) return <Typography variant="caption" color="text.disabled">—</Typography>
  const color  = fva >= 0 ? "success" : "error"
  const label  = fmtFva(fva)
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant="outlined"
      sx={{ fontSize: "0.6875rem", height: "1.375rem", fontWeight: 600 }}
    />
  )
}

// ── Header cell ───────────────────────────────────────────────────────────────

function HeaderCell({ label, tooltip, align = "right" }: { label: string; tooltip?: string; align?: "left" | "right" }) {
  const content = (
    <Typography
      variant="caption"
      color="text.secondary"
      fontWeight={700}
      sx={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em" }}
    >
      {label}
    </Typography>
  )
  return (
    <Box sx={{ textAlign: align, px: "0.75rem", py: "0.5rem" }}>
      {tooltip ? <Tooltip title={tooltip} placement="top">{content}</Tooltip> : content}
    </Box>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ModelRow({ row }: { row: BenchmarkModelResult }) {
  const isWinner   = row.is_winner
  const isBaseline = row.is_baseline
  const hasError   = !!row.error

  return (
    <Box
      sx={{
        display: "contents",
        // Highlighted row via a wrapper trick — use grid row highlight via outline
      }}
    >
      {/* Model name cell */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          px: "0.75rem",
          py: "0.625rem",
          borderLeft: isWinner ? "3px solid" : "3px solid transparent",
          borderLeftColor: isWinner ? "warning.main" : "transparent",
          bgcolor: isWinner
            ? "rgba(255, 193, 7, 0.06)"
            : isBaseline
            ? "action.hover"
            : "transparent",
          borderRadius: "0.25rem 0 0 0.25rem",
        }}
      >
        {isWinner && (
          <EmojiEventsIcon sx={{ fontSize: "0.875rem", color: "warning.main", flexShrink: 0 }} />
        )}
        <Typography
          variant="body2"
          fontWeight={isWinner ? 700 : isBaseline ? 400 : 500}
          color={isBaseline ? "text.secondary" : "text.primary"}
          sx={{ fontSize: "0.8125rem" }}
        >
          {row.label}
        </Typography>
        {isBaseline && (
          <Chip
            label="baseline"
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.5625rem", height: "1rem", color: "text.disabled", borderColor: "divider" }}
          />
        )}
        {hasError && (
          <Tooltip title={row.error ?? ""} placement="top">
            <WarningAmberIcon sx={{ fontSize: "0.875rem", color: "warning.main", flexShrink: 0 }} />
          </Tooltip>
        )}
      </Box>

      {/* WAPE */}
      <Box
        sx={{
          textAlign: "right", px: "0.75rem", py: "0.625rem",
          bgcolor: isWinner ? "rgba(255, 193, 7, 0.06)" : isBaseline ? "action.hover" : "transparent",
        }}
      >
        {hasError ? (
          <Typography variant="caption" color="text.disabled">error</Typography>
        ) : (
          <Typography variant="body2" fontWeight={isWinner ? 700 : 400} color={wapeColor(row.wape)} sx={{ fontSize: "0.8125rem" }}>
            {fmtPct(row.wape)}
          </Typography>
        )}
      </Box>

      {/* MAE */}
      <Box
        sx={{
          textAlign: "right", px: "0.75rem", py: "0.625rem",
          bgcolor: isWinner ? "rgba(255, 193, 7, 0.06)" : isBaseline ? "action.hover" : "transparent",
        }}
      >
        <Typography variant="caption" color={hasError ? "text.disabled" : "text.primary"} sx={{ fontSize: "0.8125rem" }}>
          {hasError ? "—" : fmtAbs(row.mae)}
        </Typography>
      </Box>

      {/* BIAS */}
      <Box
        sx={{
          textAlign: "right", px: "0.75rem", py: "0.625rem",
          bgcolor: isWinner ? "rgba(255, 193, 7, 0.06)" : isBaseline ? "action.hover" : "transparent",
        }}
      >
        <Typography
          variant="caption"
          color={
            hasError ? "text.disabled"
            : row.bias === null ? "text.disabled"
            : Math.abs(row.bias * 100) < 5 ? "success.main"
            : Math.abs(row.bias * 100) < 15 ? "warning.main"
            : "error.main"
          }
          sx={{ fontSize: "0.8125rem" }}
        >
          {hasError ? "—" : fmtPct(row.bias)}
        </Typography>
      </Box>

      {/* FVA */}
      <Box
        sx={{
          textAlign: "right", px: "0.75rem", py: "0.625rem",
          display: "flex", justifyContent: "flex-end", alignItems: "center",
          bgcolor: isWinner ? "rgba(255, 193, 7, 0.06)" : isBaseline ? "action.hover" : "transparent",
          borderRadius: "0 0.25rem 0.25rem 0",
        }}
      >
        {hasError ? (
          <Typography variant="caption" color="text.disabled">—</Typography>
        ) : (
          <FvaChip fva={row.fva} />
        )}
      </Box>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BenchmarkTable({ result }: BenchmarkTableProps) {
  const { models, conclusion, n_obs, test_periods, naive_wape } = result

  return (
    <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
            Comparativa de modelos
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {n_obs} obs · test: {test_periods} períodos
            {naive_wape !== null && naive_wape !== undefined && (
              <> · Naive WAPE: <strong>{fmtPct(naive_wape)}</strong></>
            )}
          </Typography>
        </Box>
        <Tooltip
          title="FVA = (WAPE_naive − WAPE_modelo) / WAPE_naive × 100. Positivo = el modelo mejora sobre el Naive."
          placement="top"
        >
          <Chip
            label="¿Qué es FVA?"
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.6875rem", height: "1.375rem", cursor: "help" }}
          />
        </Tooltip>
      </Box>

      {/* Table grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 5rem 5.5rem 5rem 5.5rem",
          rowGap: "0.125rem",
          // Header row border
          "& > *:nth-child(-n+5)": {
            borderBottom: "1px solid",
            borderBottomColor: "divider",
          },
        }}
      >
        {/* Column headers */}
        <HeaderCell label="Modelo"  align="left" />
        <HeaderCell label="WAPE"    tooltip="Weighted Absolute Percentage Error — métrica principal" />
        <HeaderCell label="MAE"     tooltip="Mean Absolute Error — en unidades de la serie" />
        <HeaderCell label="BIAS"    tooltip="Sesgo sistemático: positivo = sobreestima, negativo = subestima" />
        <HeaderCell label="FVA"     tooltip="Forecast Value Added vs Seasonal Naive. Verde = el modelo agrega valor." />

        {/* Data rows */}
        {models.map((row) => (
          <ModelRow key={row.model} row={row} />
        ))}
      </Box>

      {/* Conclusion */}
      {conclusion && (
        <>
          <Divider />
          <Alert
            severity={result.winner ? "success" : "info"}
            sx={{ fontSize: "0.8125rem", py: "0.375rem" }}
          >
            {conclusion}
          </Alert>
        </>
      )}

      {/* Educational note */}
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6875rem" }}>
        <strong>Vandeputt:</strong> &ldquo;Nunca reportes un solo modelo. Siempre comparalo contra el naive.
        Si el FVA es negativo, usá el Seasonal Naive directamente.&rdquo;
      </Typography>

    </Paper>
  )
}

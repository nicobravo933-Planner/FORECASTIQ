"use client"

/**
 * CvResultsCard — muestra resultados del rolling window cross-validation (Paso 3).
 *
 * Secciones:
 *  1. KPIs: WAPE media ± std, MAE media, BIAS media
 *  2. Gráfico de barras: WAPE por fold (Recharts BarChart)
 *  3. Tabla detallada: fold, período train, período test, WAPE, MAE, BIAS
 *
 * Si hay un cv_warning (serie demasiado corta) muestra Alert en lugar del card.
 */

import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Alert from "@mui/material/Alert"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import TableContainer from "@mui/material/TableContainer"
import Tooltip from "@mui/material/Tooltip"
import { useTheme } from "@mui/material/styles"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ReferenceLine,
  Cell, ResponsiveContainer,
} from "recharts"
import type { CvSummary } from "@/lib/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function wapeColor(v: number): "success" | "warning" | "error" {
  if (v < 0.15) return "success"
  if (v < 0.30) return "warning"
  return "error"
}

function pct(v: number | null, decimals = 1): string {
  if (v === null || v === undefined) return "—"
  return `${(v * 100).toFixed(decimals)}%`
}

function signedPct(v: number | null): string {
  if (v === null || v === undefined) return "—"
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CvResultsCardProps {
  cvSummary: CvSummary
  cvWarning?: string | null
  modelName: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CvResultsCard({ cvSummary, cvWarning, modelName }: CvResultsCardProps) {
  const theme = useTheme()

  const barData = cvSummary.folds.map((f) => ({
    name:   `Fold ${f.fold}`,
    wape:   f.wape !== null ? +(f.wape * 100).toFixed(2) : 0,
    period: `${f.test_start} → ${f.test_end}`,
    mae:    f.mae,
    bias:   f.bias,
  }))

  const meanPct = cvSummary.wape_mean !== null ? +(cvSummary.wape_mean * 100).toFixed(2) : null
  const stdPct  = cvSummary.wape_std  !== null ? +(cvSummary.wape_std  * 100).toFixed(2) : null

  return (
    <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            Cross-validation rolling
          </Typography>
          <Chip
            label={`${cvSummary.n_folds} folds · ${modelName}`}
            size="small"
            color="secondary"
            variant="outlined"
            sx={{ fontSize: "0.6875rem", height: "1.375rem" }}
          />
        </Box>
        <Tooltip title="WAPE medio ± desv. estándar sobre todos los folds. Un std alto indica sensibilidad al período elegido para entrenar.">
          <Typography variant="caption" color="text.disabled" sx={{ cursor: "help", fontFamily: "monospace" }}>
            {meanPct !== null && stdPct !== null ? `WAPE ${meanPct}% ± ${stdPct}%` : "WAPE —"}
          </Typography>
        </Tooltip>
      </Box>

      {/* ── Warning ──────────────────────────────────────────────────────── */}
      {cvWarning && (
        <Alert severity="warning" sx={{ fontSize: "0.8125rem" }}>{cvWarning}</Alert>
      )}

      {/* ── KPI chips ────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {[
          {
            label:   "WAPE medio",
            value:   meanPct !== null ? `${meanPct}%` : "—",
            sub:     stdPct  !== null ? `± ${stdPct}%` : "",
            bgcolor: cvSummary.wape_mean !== null
              ? wapeColor(cvSummary.wape_mean) === "success"
                ? "rgba(34,197,94,0.12)"
                : wapeColor(cvSummary.wape_mean) === "warning"
                ? "rgba(245,158,11,0.12)"
                : "rgba(239,68,68,0.12)"
              : "action.hover",
            tooltip: "Media del WAPE en todos los folds. Menor es mejor. < 15% es excelente.",
          },
          {
            label:   "MAE medio",
            value:   cvSummary.mae_mean !== null
              ? cvSummary.mae_mean.toLocaleString("es-AR", { maximumFractionDigits: 1 })
              : "—",
            sub:     cvSummary.mae_std !== null
              ? `± ${cvSummary.mae_std.toLocaleString("es-AR", { maximumFractionDigits: 1 })}`
              : "",
            bgcolor: "action.hover",
            tooltip: "Error absoluto medio en unidades de la serie.",
          },
          {
            label:   "BIAS medio",
            value:   signedPct(cvSummary.bias_mean),
            sub:     "",
            bgcolor: cvSummary.bias_mean !== null && Math.abs(cvSummary.bias_mean) < 0.05
              ? "rgba(34,197,94,0.12)"
              : "action.hover",
            tooltip: "BIAS positivo = sobreestima (stock excesivo). Negativo = subestima (quiebres).",
          },
        ].map(({ label, value, sub, bgcolor, tooltip }) => (
          <Tooltip key={label} title={tooltip} placement="top">
            <Box
              sx={{
                display: "flex", flexDirection: "column", alignItems: "center",
                bgcolor,
                border: "1px solid", borderColor: "divider",
                borderRadius: "0.5rem",
                px: "1rem", py: "0.5rem",
                minWidth: "7rem",
                cursor: "default",
              }}
            >
              <Typography variant="caption" color="text.disabled" fontWeight={500}>{label}</Typography>
              <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.2 }}>
                {value}
              </Typography>
              {sub && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.625rem" }}>
                  {sub}
                </Typography>
              )}
            </Box>
          </Tooltip>
        ))}
      </Box>

      {/* ── Bar chart WAPE por fold ───────────────────────────────────────── */}
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.5rem", display: "block" }}>
          WAPE por fold (%)
        </Typography>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} unit="%" domain={[0, "auto"]} />
            <RechartTooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
              }}
              formatter={(val: number, _name: string, props: { payload?: { period?: string; mae?: number | null; bias?: number | null } }) => {
                const p = props.payload
                const extra = p ? ` · MAE: ${p.mae?.toFixed(1) ?? "—"} · BIAS: ${signedPct(p.bias ?? null)}` : ""
                return [`${val}%${extra}`, "WAPE"]
              }}
              labelFormatter={(label: string, payload: { payload?: { period?: string } }[]) =>
                payload?.[0]?.payload?.period ?? label
              }
            />
            {/* Línea WAPE medio */}
            {meanPct !== null && (
              <ReferenceLine
                y={meanPct}
                stroke={theme.palette.secondary.main}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: `Media ${meanPct}%`, position: "insideTopRight", fontSize: 10, fill: theme.palette.secondary.main }}
              />
            )}
            <ReferenceLine y={15} stroke={theme.palette.success.main} strokeDasharray="3 2"
              label={{ value: "15%", fontSize: 9, fill: theme.palette.success.main, position: "insideTopLeft" }} />
            <ReferenceLine y={30} stroke={theme.palette.warning.main} strokeDasharray="3 2"
              label={{ value: "30%", fontSize: 9, fill: theme.palette.warning.main, position: "insideTopLeft" }} />
            <Bar dataKey="wape" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {barData.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.wape < 15 ? theme.palette.success.main
                    : d.wape < 30 ? theme.palette.warning.main
                    : theme.palette.error.main
                  }
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Typography variant="caption" color="text.disabled">
          Verde &lt;15% · Amarillo 15-30% · Rojo &gt;30% · Línea punteada = media
        </Typography>
      </Box>

      {/* ── Tabla detallada ───────────────────────────────────────────────── */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {["Fold", "Período train", "Período test", "Obs.", "WAPE", "MAE", "BIAS"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary", py: "0.5rem" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {cvSummary.folds.map((f) => (
              <TableRow key={f.fold} hover>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.8125rem" }}>#{f.fold}</TableCell>
                <TableCell sx={{ fontSize: "0.6875rem", color: "text.secondary", fontFamily: "monospace" }}>
                  {f.train_start}<br />{f.train_end}
                </TableCell>
                <TableCell sx={{ fontSize: "0.6875rem", color: "text.secondary", fontFamily: "monospace" }}>
                  {f.test_start}<br />{f.test_end}
                </TableCell>
                <TableCell sx={{ fontSize: "0.75rem", color: "text.disabled" }}>{f.train_size}</TableCell>
                <TableCell>
                  <Chip
                    label={pct(f.wape)}
                    size="small"
                    color={f.wape !== null ? wapeColor(f.wape) : "default"}
                    variant="outlined"
                    sx={{ height: "1.25rem", fontSize: "0.6875rem", fontFamily: "monospace" }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                  {f.mae !== null ? f.mae.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "—"}
                </TableCell>
                <TableCell sx={{
                  fontSize: "0.75rem", fontFamily: "monospace",
                  color: f.bias !== null && Math.abs(f.bias) > 0.1 ? "warning.main" : "text.primary",
                }}>
                  {signedPct(f.bias)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

    </Paper>
  )
}

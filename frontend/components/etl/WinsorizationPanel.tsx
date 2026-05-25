"use client"

/**
 * WinsorizationPanel — controls for the ETL winsorization step.
 *
 * Adaptive UI based on server tier (from /api/capabilities):
 *   tier === "local"          → sliders with 300ms debounce (instant feedback)
 *   tier === "ec2" | "cloud"  → number inputs + explicit "Apply" button
 *
 * Both modes share the same hook call (applyWinsorize) and result display.
 */

import { useState, useEffect, useRef } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import Slider from "@mui/material/Slider"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import TuneIcon from "@mui/icons-material/Tune"

interface WinsorizationPanelProps {
  tier: "local" | "cloud"  // "cloud" covers both ec2 and cloud tiers
  loading: boolean
  onApply: (pLower: number, pUpper: number) => void
  currentResult?: {
    p_lower: number
    p_upper: number
    winsor_lower: number
    winsor_upper: number
    n_winsorized: number
    new_quality_score: number
    new_quality_label: string
  } | null
}

const QUALITY_COLORS: Record<string, string> = {
  excellent: "#22c55e",
  good:      "#84cc16",
  fair:      "#f59e0b",
  poor:      "#ef4444",
}

export function WinsorizationPanel({
  tier,
  loading,
  onApply,
  currentResult,
}: WinsorizationPanelProps) {
  const isLocal = tier === "local"

  const [pLower, setPLower] = useState(5)
  const [pUpper, setPUpper] = useState(95)

  // Debounce ref for local mode
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Skip the first effect run on mount — only fire on actual user changes
  const isMountedRef = useRef(false)

  // Local mode: fire on change with 300ms debounce
  useEffect(() => {
    if (!isLocal) return
    // Skip mount — don't auto-fetch before the user moves a slider
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onApply(pLower, pUpper)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pLower, pUpper, isLocal])

  const handleApply = () => onApply(pLower, pUpper)

  const qualityColor = currentResult
    ? (QUALITY_COLORS[currentResult.new_quality_label] ?? "#94a3b8")
    : null

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}
    >
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "1.25rem" }}>
          <TuneIcon sx={{ fontSize: "1.25rem", color: "primary.main" }} />
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
            Winsorización
          </Typography>
          <Tooltip
            title="La winsorización reemplaza los valores extremos por los límites del rango elegido, sin eliminarlos. Es más suave que eliminar outliers y mantiene la longitud de la serie."
            placement="right"
          >
            <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.disabled", cursor: "help" }} />
          </Tooltip>
        </Box>

        {/* Explanation */}
        <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mb: "1.25rem", lineHeight: 1.6 }}>
          Los valores por debajo del percentil <strong>p{pLower}</strong> y por encima del
          percentil <strong>p{pUpper}</strong> serán clipeados al límite correspondiente.
          {isLocal && (
            <Box component="span" sx={{ color: "primary.main" }}>
              {" "}(modo local — preview en tiempo real)
            </Box>
          )}
        </Typography>

        {/* Controls — adaptive per tier */}
        {isLocal ? (
          /* ── Local: sliders ───────────────────────────────────────── */
          <Box sx={{ px: "0.5rem" }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, mb: "0.25rem" }}>
              Percentil inferior: <strong>p{pLower}</strong>
            </Typography>
            <Slider
              value={pLower}
              min={1}
              max={49}
              step={1}
              onChange={(_e, v) => setPLower(v as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `p${v}`}
              sx={{ mb: "1.25rem" }}
            />
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, mb: "0.25rem" }}>
              Percentil superior: <strong>p{pUpper}</strong>
            </Typography>
            <Slider
              value={pUpper}
              min={51}
              max={99}
              step={1}
              onChange={(_e, v) => setPUpper(v as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `p${v}`}
            />
          </Box>
        ) : (
          /* ── EC2 / Cloud: inputs + button ─────────────────────────── */
          <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Box sx={{ display: "flex", gap: "0.75rem" }}>
              <TextField
                label="Percentil inferior"
                type="number"
                size="small"
                value={pLower}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v >= 1 && v <= 49) setPLower(v)
                }}
                inputProps={{ min: 1, max: 49, step: 1 }}
                helperText={`p${pLower} (default 5)`}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Percentil superior"
                type="number"
                size="small"
                value={pUpper}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v >= 51 && v <= 99) setPUpper(v)
                }}
                inputProps={{ min: 51, max: 99, step: 1 }}
                helperText={`p${pUpper} (default 95)`}
                sx={{ flex: 1 }}
              />
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={handleApply}
              disabled={loading}
              startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : undefined}
              sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 600 }}
            >
              {loading ? "Aplicando…" : "Aplicar winsorización"}
            </Button>
          </Box>
        )}

        {/* Loading indicator for local mode */}
        {isLocal && loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mt: "0.75rem" }}>
            <CircularProgress size="0.875rem" />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              Recalculando…
            </Typography>
          </Box>
        )}

        {/* Result summary */}
        {currentResult && !loading && (
          <>
            <Divider sx={{ my: "1.25rem" }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "text.primary" }}>
                Resultado
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Puntos modificados
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {currentResult.n_winsorized}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Límite inferior (p{currentResult.p_lower})
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {currentResult.winsor_lower.toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Límite superior (p{currentResult.p_upper})
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {currentResult.winsor_upper.toLocaleString()}
                </Typography>
              </Box>

              <Divider sx={{ my: "0.5rem" }} />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Nuevo quality score
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Box
                    sx={{
                      width: "0.625rem",
                      height: "0.625rem",
                      borderRadius: "50%",
                      bgcolor: qualityColor ?? "grey.400",
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: "0.9375rem",
                      fontWeight: 800,
                      color: qualityColor ?? "text.primary",
                    }}
                  >
                    {currentResult.new_quality_score}
                  </Typography>
                </Box>
              </Box>

              {currentResult.n_winsorized === 0 && (
                <Alert severity="info" sx={{ mt: "0.5rem", borderRadius: "0.5rem", fontSize: "0.8125rem" }}>
                  No hay valores fuera del rango p{currentResult.p_lower}–p{currentResult.p_upper}.
                </Alert>
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}

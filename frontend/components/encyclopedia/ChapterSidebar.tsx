"use client"

/**
 * ChapterSidebar — left navigation for the encyclopedia.
 * Shows chapter number, title (collapsible), sections, and reading progress.
 * Sidebar prop: activeSection allows TOC right panel to sync highlight.
 */

import AutoStoriesIcon from "@mui/icons-material/AutoStories"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import SearchIcon from "@mui/icons-material/Search"
import Box from "@mui/material/Box"
import Collapse from "@mui/material/Collapse"
import InputAdornment from "@mui/material/InputAdornment"
import LinearProgress from "@mui/material/LinearProgress"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { useMemo, useState } from "react"

export interface ChapterSection {
  id: string      // e.g. "1-1", "1-2"
  title: string
}

export interface ChapterMeta {
  id: number
  title: string
  subtitle: string
  emoji: string
  readTime: number  // minutes
  sections: ChapterSection[]
}

export const CHAPTERS: ChapterMeta[] = [
  {
    id: 1, title: "¿Por qué forecasteamos?", subtitle: "Demanda, decisiones y cadena de suministro", emoji: "🧭", readTime: 8,
    sections: [
      { id: "1-1", title: "El propósito del forecast" },
      { id: "1-2", title: "Los 5 pasos hacia la excelencia" },
      { id: "1-3", title: "Demanda vs ventas" },
      { id: "1-4", title: "Granularidad y horizonte" },
      { id: "1-5", title: "El costo de equivocarse" },
    ],
  },
  {
    id: 2, title: "Entender los datos", subtitle: "EDA, calidad y completitud", emoji: "🔍", readTime: 9,
    sections: [
      { id: "2-1", title: "El Quality Score" },
      { id: "2-2", title: "Outliers y MAD" },
      { id: "2-3", title: "Gaps temporales" },
      { id: "2-4", title: "Estacionalidad y tendencia" },
      { id: "2-5", title: "Coeficiente de variación" },
    ],
  },
  {
    id: 3, title: "Segmentación ABC-XYZ", subtitle: "Clasificar por volumen y variabilidad", emoji: "📊", readTime: 9,
    sections: [
      { id: "3-1", title: "Clasificación ABC" },
      { id: "3-2", title: "Clasificación XYZ" },
      { id: "3-3", title: "Matriz combinada ABC-XYZ" },
      { id: "3-4", title: "Estrategias por segmento" },
    ],
  },
  {
    id: 4, title: "Métricas de error", subtitle: "WAPE, MAE, BIAS, RMSE, FVA", emoji: "📐", readTime: 11,
    sections: [
      { id: "4-1", title: "BIAS — el indicador de dirección" },
      { id: "4-2", title: "MAPE — el indicador engañoso" },
      { id: "4-3", title: "MAE — error absoluto medio" },
      { id: "4-4", title: "RMSE — penaliza errores grandes" },
      { id: "4-5", title: "WAPE — la métrica principal" },
      { id: "4-6", title: "FVA — Forecast Value Added" },
      { id: "4-7", title: "Código Python completo" },
    ],
  },
  {
    id: 5, title: "Modelo ingenuo y Moving Average", subtitle: "El baseline que todo modelo debe superar", emoji: "📏", readTime: 8,
    sections: [
      { id: "5-1", title: "Seasonal Naive — el baseline" },
      { id: "5-2", title: "Moving Average" },
      { id: "5-3", title: "Elegir el parámetro n" },
      { id: "5-4", title: "Weighted Moving Average" },
      { id: "5-5", title: "Cuándo usar MA vs Naive" },
    ],
  },
  {
    id: 6, title: "Suavizamiento exponencial", subtitle: "SES, Holt y Holt-Winters triple", emoji: "〰️", readTime: 13,
    sections: [
      { id: "6-1", title: "La idea central: pesos decrecientes" },
      { id: "6-2", title: "SES — Nivel solamente" },
      { id: "6-3", title: "Holt — Nivel + Tendencia" },
      { id: "6-4", title: "Holt-Winters Triple" },
      { id: "6-5", title: "Aditivo vs Multiplicativo" },
      { id: "6-6", title: "Damped Trend" },
    ],
  },
  {
    id: 7, title: "ARIMA y SARIMA", subtitle: "Diferenciación, autocorrelación, estacionariedad", emoji: "🌊", readTime: 14,
    sections: [
      { id: "7-1", title: "Estacionariedad" },
      { id: "7-2", title: "AR y MA — componentes base" },
      { id: "7-3", title: "Diferenciación (d)" },
      { id: "7-4", title: "ARIMA(p, d, q)" },
      { id: "7-5", title: "Estacionalidad en SARIMA" },
      { id: "7-6", title: "Auto ARIMA con pmdarima" },
      { id: "7-7", title: "Diagnóstico de residuos" },
    ],
  },
  {
    id: 8, title: "Feature Engineering", subtitle: "Lags, ventanas, variables de calendario", emoji: "⚙️", readTime: 11,
    sections: [
      { id: "8-1", title: "Lags y autocorrelación" },
      { id: "8-2", title: "Rolling statistics" },
      { id: "8-3", title: "Variables de calendario" },
      { id: "8-4", title: "Eventos y promociones" },
      { id: "8-5", title: "Target encoding" },
    ],
  },
  {
    id: 9, title: "LightGBM y Machine Learning", subtitle: "Gradient boosting y Optuna HPO", emoji: "🤖", readTime: 13,
    sections: [
      { id: "9-1", title: "¿Por qué Gradient Boosting?" },
      { id: "9-2", title: "El flujo de entrenamiento" },
      { id: "9-3", title: "Optuna — búsqueda bayesiana" },
      { id: "9-4", title: "Feature importance" },
      { id: "9-5", title: "Predicción recursiva" },
    ],
  },
  {
    id: 10, title: "Validación y overfitting", subtitle: "TimeSeriesSplit y Rolling CV", emoji: "🔬", readTime: 10,
    sections: [
      { id: "10-1", title: "El problema de la validación cruzada" },
      { id: "10-2", title: "TimeSeriesSplit" },
      { id: "10-3", title: "Walk-forward (Rolling CV)" },
      { id: "10-4", title: "Detectar overfitting" },
      { id: "10-5", title: "Cuántos folds usar" },
    ],
  },
  {
    id: 11, title: "FVA — Valor Añadido", subtitle: "¿Tu modelo supera al naive?", emoji: "💡", readTime: 8,
    sections: [
      { id: "11-1", title: "La filosofía del FVA" },
      { id: "11-2", title: "Cálculo paso a paso" },
      { id: "11-3", title: "FVA por nivel de agregación" },
      { id: "11-4", title: "Cuándo aceptar FVA negativo" },
    ],
  },
  {
    id: 12, title: "Sesgos humanos", subtitle: "Por qué los humanos sesgan los pronósticos", emoji: "🧠", readTime: 9,
    sections: [
      { id: "12-1", title: "Tipos de sesgo cognitivo" },
      { id: "12-2", title: "El override estadístico" },
      { id: "12-3", title: "Cómo medir el sesgo humano" },
      { id: "12-4", title: "Cultura de forecasting" },
    ],
  },
]

interface ChapterSidebarProps {
  activeChapter: number
  activeSection: string | null
  onSelect: (id: number, sectionId?: string) => void
  readChapters: Set<number>
}

export function ChapterSidebar({ activeChapter, activeSection, onSelect, readChapters }: ChapterSidebarProps) {
  const [search, setSearch]             = useState("")
  const [expandedChapters, setExpanded] = useState<Set<number>>(() => new Set([activeChapter]))
  const progress = Math.round((readChapters.size / CHAPTERS.length) * 100)

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredChapters = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return CHAPTERS
    return CHAPTERS.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.sections.some((s) => s.title.toLowerCase().includes(q)),
    )
  }, [search])

  return (
    <Box
      sx={{
        width: "15rem",
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Header */}
      <Box sx={{ p: "1rem 1rem 0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "0.625rem" }}>
          <AutoStoriesIcon sx={{ fontSize: "1.125rem", color: "primary.main" }} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "text.primary" }}>
            Enciclopedia
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "0.3rem" }}>
          <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled" }}>Progreso de lectura</Typography>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "primary.main" }}>{progress}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ borderRadius: "0.25rem", height: "0.375rem", bgcolor: "action.hover" }}
        />
      </Box>

      {/* Search */}
      <Box sx={{ px: "0.75rem", pb: "0.5rem" }}>
        <TextField
          size="small"
          placeholder="Buscar capítulo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: "0.9rem", color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": { borderRadius: "0.5rem", fontSize: "0.8125rem" },
          }}
        />
      </Box>

      {/* Chapter list */}
      <List sx={{ flex: 1, overflowY: "auto", pt: "0.25rem", px: 0 }}>
        {filteredChapters.length === 0 && (
          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", textAlign: "center", py: "1rem" }}>
            Sin resultados
          </Typography>
        )}
        {filteredChapters.map((ch) => {
          const isActive   = ch.id === activeChapter
          const isRead     = readChapters.has(ch.id)
          const isExpanded = expandedChapters.has(ch.id)

          return (
            <Box key={ch.id}>
              {/* Chapter row */}
              <ListItemButton
                selected={isActive && !activeSection}
                onClick={() => { onSelect(ch.id); toggleExpand(ch.id) }}
                sx={{
                  mx: "0.5rem",
                  mb: "0.125rem",
                  borderRadius: "0.5rem",
                  px: "0.75rem",
                  py: "0.5rem",
                  gap: "0.625rem",
                  alignItems: "flex-start",
                  borderLeft: "0.1875rem solid transparent",
                  "&.Mui-selected": {
                    bgcolor: "rgba(59,130,246,0.08)",
                    borderLeftColor: "primary.main",
                  },
                  "&:hover:not(.Mui-selected)": { bgcolor: "rgba(59,130,246,0.04)" },
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: "0.125rem", flexShrink: 0, gap: "0.1rem" }}>
                  <Typography sx={{ fontSize: "1rem", lineHeight: 1 }}>{ch.emoji}</Typography>
                  <Typography sx={{ fontSize: "0.5625rem", color: isActive ? "primary.main" : "text.disabled", fontWeight: 700 }}>
                    {String(ch.id).padStart(2, "0")}
                  </Typography>
                </Box>

                <ListItemText
                  primary={ch.title}
                  secondary={`${ch.readTime} min${isRead ? " · ✓ leído" : ""}`}
                  primaryTypographyProps={{
                    fontSize: "0.8125rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "primary.main" : "text.primary",
                    lineHeight: 1.3,
                  }}
                  secondaryTypographyProps={{
                    fontSize: "0.6875rem",
                    color: isRead ? "success.main" : "text.disabled",
                    mt: "0.125rem",
                  }}
                />

                <Box sx={{ ml: "auto", color: "text.disabled", mt: "0.3rem", flexShrink: 0 }}>
                  {isExpanded
                    ? <ExpandLessIcon sx={{ fontSize: "0.875rem" }} />
                    : <ExpandMoreIcon sx={{ fontSize: "0.875rem" }} />
                  }
                </Box>
              </ListItemButton>

              {/* Sub-sections */}
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <List disablePadding sx={{ pl: "2.25rem", pb: "0.25rem" }}>
                  {ch.sections.map((sec) => {
                    const secActive = isActive && activeSection === sec.id
                    return (
                      <ListItemButton
                        key={sec.id}
                        selected={secActive}
                        onClick={(e) => { e.stopPropagation(); onSelect(ch.id, sec.id) }}
                        sx={{
                          borderRadius: "0.375rem",
                          py: "0.275rem",
                          px: "0.5rem",
                          mb: "0.0625rem",
                          borderLeft: "0.125rem solid",
                          borderColor: secActive ? "primary.main" : "divider",
                          "&.Mui-selected": { bgcolor: "rgba(59,130,246,0.06)" },
                          "&:hover:not(.Mui-selected)": { bgcolor: "rgba(59,130,246,0.03)" },
                        }}
                      >
                        <ListItemText
                          primary={sec.title}
                          primaryTypographyProps={{
                            fontSize: "0.75rem",
                            fontWeight: secActive ? 600 : 400,
                            color: secActive ? "primary.main" : "text.secondary",
                            lineHeight: 1.4,
                          }}
                        />
                      </ListItemButton>
                    )
                  })}
                </List>
              </Collapse>
            </Box>
          )
        })}
      </List>

      {/* Footer stats */}
      <Box sx={{ p: "0.75rem 1rem", borderTop: "1px solid", borderColor: "divider" }}>
        <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled", textAlign: "center" }}>
          {readChapters.size} de {CHAPTERS.length} capítulos leídos
          {" · "}
          {CHAPTERS.reduce((s, c) => s + c.readTime, 0)} min totales
        </Typography>
      </Box>
    </Box>
  )
}

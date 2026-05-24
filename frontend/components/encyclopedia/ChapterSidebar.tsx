"use client"

/**
 * ChapterSidebar — left navigation for the encyclopedia.
 * Shows chapter number, title, and reading progress indicator.
 */

import AutoStoriesIcon from "@mui/icons-material/AutoStories"
import Box from "@mui/material/Box"
import LinearProgress from "@mui/material/LinearProgress"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"

export interface ChapterMeta {
  id: number
  title: string
  subtitle: string
  emoji: string
  readTime: number  // minutes
}

export const CHAPTERS: ChapterMeta[] = [
  { id: 1,  title: "¿Por qué forecasteamos?",         subtitle: "Demanda, decisiones y cadena de suministro",    emoji: "🧭", readTime: 6  },
  { id: 2,  title: "Entender los datos",               subtitle: "EDA, calidad y completitud",                   emoji: "🔍", readTime: 7  },
  { id: 3,  title: "Segmentación ABC-XYZ",             subtitle: "Clasificar por volumen y variabilidad",         emoji: "📊", readTime: 8  },
  { id: 4,  title: "Métricas de error",                subtitle: "WAPE, MAE, BIAS, RMSE, FVA",                   emoji: "📐", readTime: 10 },
  { id: 5,  title: "Modelo ingenuo y Moving Average",  subtitle: "El baseline que todo modelo debe superar",      emoji: "📏", readTime: 7  },
  { id: 6,  title: "Suavizamiento exponencial",        subtitle: "SES, Holt y Holt-Winters triple",              emoji: "〰️", readTime: 12 },
  { id: 7,  title: "ARIMA y SARIMA",                   subtitle: "Diferenciación, autocorrelación, estacionariedad", emoji: "🌊", readTime: 12 },
  { id: 8,  title: "Feature Engineering",              subtitle: "Lags, ventanas, variables de calendario",       emoji: "⚙️", readTime: 9  },
  { id: 9,  title: "LightGBM y Machine Learning",      subtitle: "Gradient boosting y Optuna HPO",               emoji: "🤖", readTime: 11 },
  { id: 10, title: "Validación y overfitting",         subtitle: "TimeSeriesSplit y Rolling CV",                  emoji: "🔬", readTime: 9  },
  { id: 11, title: "FVA — Valor Añadido",              subtitle: "¿Tu modelo supera al naive?",                  emoji: "💡", readTime: 7  },
  { id: 12, title: "Sesgos humanos",                   subtitle: "Por qué los humanos sesgan los pronósticos",   emoji: "🧠", readTime: 8  },
]

interface ChapterSidebarProps {
  activeChapter: number
  onSelect: (id: number) => void
  readChapters: Set<number>
}

export function ChapterSidebar({ activeChapter, onSelect, readChapters }: ChapterSidebarProps) {
  const progress = Math.round((readChapters.size / CHAPTERS.length) * 100)

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

      {/* Chapter list */}
      <List sx={{ flex: 1, overflowY: "auto", pt: "0.5rem", px: 0 }}>
        {CHAPTERS.map((ch) => {
          const isActive = ch.id === activeChapter
          const isRead   = readChapters.has(ch.id)
          return (
            <ListItemButton
              key={ch.id}
              selected={isActive}
              onClick={() => onSelect(ch.id)}
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
              {/* Emoji + number badge */}
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
            </ListItemButton>
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

"use client"

/**
 * WelcomeScreen — shown when chat has no messages.
 * 2×2 grid of quick-action cards, each with icon + title + description.
 * Mirrors the quick-grid pattern from the reference chat.html.
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import QueryStatsIcon from "@mui/icons-material/QueryStats"
import TuneIcon from "@mui/icons-material/Tune"
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"

interface QuickCard {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  desc: string
  prompt: string
}

const CARDS: QuickCard[] = [
  {
    icon: <QueryStatsIcon sx={{ fontSize: "1.375rem" }} />,
    iconBg: "rgba(99,102,241,0.12)",
    iconColor: "primary.main",
    title: "Analizar datos",
    desc: "Tendencias y patrones",
    prompt: "¿Cuáles son las tendencias principales en mis datos?",
  },
  {
    icon: <AutoGraphIcon sx={{ fontSize: "1.375rem" }} />,
    iconBg: "rgba(6,182,212,0.12)",
    iconColor: "secondary.main",
    title: "Evaluar forecast",
    desc: "Precisión del modelo",
    prompt: "¿Cuánto error tiene el forecast? ¿Es bueno el WAPE?",
  },
  {
    icon: <TuneIcon sx={{ fontSize: "1.375rem" }} />,
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "warning.main",
    title: "Mejorar modelo",
    desc: "Recomendaciones ML",
    prompt: "¿Qué modelo ML se usó y por qué? ¿Hay uno mejor?",
  },
  {
    icon: <CalendarMonthIcon sx={{ fontSize: "1.375rem" }} />,
    iconBg: "rgba(34,197,94,0.12)",
    iconColor: "success.main",
    title: "Estacionalidad",
    desc: "Ciclos y eventos",
    prompt: "¿Hay estacionalidad en los datos? ¿Qué período?",
  },
]

interface WelcomeScreenProps {
  onSelect: (prompt: string) => void
}

export function WelcomeScreen({ onSelect }: WelcomeScreenProps) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        px: "1.5rem",
        py: "2rem",
        textAlign: "center",
        // Fade-in on mount
        animation: "fadeInUp 0.3s ease",
        "@keyframes fadeInUp": {
          from: { opacity: 0, transform: "translateY(0.75rem)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      {/* Robot avatar */}
      <Box
        sx={{
          width: "4rem",
          height: "4rem",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0.5rem 1.5rem rgba(99,102,241,0.35)",
          flexShrink: 0,
        }}
      >
        <AutoGraphIcon sx={{ fontSize: "1.75rem", color: "white" }} />
      </Box>

      <Box>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.125rem", mb: "0.25rem" }}>
          AI Assistant
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem", maxWidth: "22rem" }}>
          Preguntá sobre tus datos, el forecast y los modelos ML
        </Typography>
      </Box>

      {/* Quick cards grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.625rem",
          width: "100%",
          maxWidth: "28rem",
        }}
      >
        {CARDS.map((card) => (
          <Box
            key={card.title}
            onClick={() => onSelect(card.prompt)}
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "0.875rem",
              p: "0.875rem 0.75rem",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.375rem",
              textAlign: "center",
              transition: "all 0.18s ease",
              boxShadow: 1,
              "&:hover": {
                borderColor: "primary.main",
                bgcolor: "rgba(99,102,241,0.04)",
                transform: "translateY(-0.125rem)",
                boxShadow: 3,
              },
            }}
          >
            <Box
              sx={{
                width: "2.625rem",
                height: "2.625rem",
                borderRadius: "0.625rem",
                bgcolor: card.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card.iconColor,
              }}
            >
              {card.icon}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.2 }}>
              {card.title}
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", lineHeight: 1.3 }}>
              {card.desc}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

import { createTheme } from "@mui/material/styles"

/**
 * ForecastIQ Design System — Dark Navy Fintech + Glassmorphism
 *
 * Palette:
 *   Background:  #070d1b (deepest navy)
 *   Surface:     #0d1625 (card base)
 *   Paper:       #111d35 (elevated panels)
 *   Border:      rgba(59,130,246,0.15) (blue-tinted glass border)
 *   Primary:     #3b82f6 (blue-500) — CTAs, active states
 *   Accent:      #06b6d4 (cyan-500) — highlights, secondary actions
 *
 * Glass recipe (use in sx props where needed):
 *   bgcolor: "rgba(13,22,53,0.55)"
 *   backdropFilter: "blur(12px)"
 *   border: "1px solid rgba(59,130,246,0.18)"
 */

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main:         "#3b82f6",  // blue-500
      light:        "#60a5fa",  // blue-400
      dark:         "#2563eb",  // blue-600
      contrastText: "#ffffff",
    },
    secondary: {
      main:         "#06b6d4",  // cyan-500
      light:        "#22d3ee",  // cyan-400
      dark:         "#0891b2",  // cyan-600
      contrastText: "#ffffff",
    },
    background: {
      default: "#070d1b",  // deepest navy — page bg
      paper:   "#0d1625",  // cards, sidebar, modals
    },
    text: {
      primary:   "#e2e8f0",  // slate-200
      secondary: "#64748b",  // slate-500
      disabled:  "#334155",  // slate-700
    },
    divider: "rgba(59,130,246,0.12)",  // blue-tinted separator
    error:   { main: "#ef4444", light: "#fca5a5" },
    warning: { main: "#f59e0b", light: "#fcd34d" },
    success: { main: "#10b981", light: "#6ee7b7" },
    info:    { main: "#3b82f6" },
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "1.875rem", fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: "1.5rem",  fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: "1.125rem", fontWeight: 500, lineHeight: 1.5 },
    h6: { fontSize: "1rem",    fontWeight: 500, lineHeight: 1.5 },
    body1:  { fontSize: "1rem",     lineHeight: 1.6 },
    body2:  { fontSize: "0.875rem", lineHeight: 1.6 },
    caption:{ fontSize: "0.75rem",  lineHeight: 1.5 },
    button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" },
  },

  shape: { borderRadius: 10 },

  components: {
    // ── Buttons ──────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1.25rem",
          transition: "all 0.18s ease",
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.35)",
          "&:hover": {
            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
            boxShadow: "0 0.375rem 1rem rgba(59,130,246,0.5)",
          },
        },
        outlinedPrimary: {
          borderColor: "rgba(59,130,246,0.4)",
          "&:hover": {
            borderColor: "#3b82f6",
            background: "rgba(59,130,246,0.08)",
          },
        },
      },
    },

    // ── Cards — glass effect ─────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "0.875rem",
          backgroundImage: "none",
          background: "rgba(13,22,53,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(59,130,246,0.15)",
          boxShadow: "0 0.25rem 1.5rem rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            borderColor: "rgba(59,130,246,0.3)",
            boxShadow: "0 0.5rem 2rem rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
          },
        },
      },
    },

    // ── Paper — glass light ───────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          background: "rgba(13,22,53,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(59,130,246,0.12)",
        },
        elevation1: {
          boxShadow: "0 0.125rem 0.75rem rgba(0,0,0,0.3)",
        },
        elevation8: {
          boxShadow: "0 0.5rem 2rem rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        },
      },
    },

    // ── AppBar ────────────────────────────────────────────────────────────
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "rgba(7,13,27,0.8)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(59,130,246,0.12)",
          boxShadow: "none",
        },
      },
    },

    // ── Drawer — glass sidebar ─────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "rgba(7,13,27,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(59,130,246,0.12)",
          boxShadow: "0.25rem 0 1.5rem rgba(0,0,0,0.4)",
        },
      },
    },

    // ── TextField ─────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: "rgba(13,22,53,0.4)",
          backdropFilter: "blur(8px)",
          "& fieldset": {
            borderColor: "rgba(59,130,246,0.2)",
            transition: "border-color 0.15s ease",
          },
          "&:hover fieldset": {
            borderColor: "rgba(59,130,246,0.4)",
          },
          "&.Mui-focused fieldset": {
            borderColor: "#3b82f6",
            boxShadow: "0 0 0 0.1875rem rgba(59,130,246,0.15)",
          },
        },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(8px)",
        },
        filledPrimary: {
          background: "rgba(59,130,246,0.2)",
          border: "1px solid rgba(59,130,246,0.35)",
          color: "#60a5fa",
        },
        outlinedPrimary: {
          borderColor: "rgba(59,130,246,0.35)",
          color: "#60a5fa",
        },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            background: "rgba(59,130,246,0.06)",
            borderBottom: "1px solid rgba(59,130,246,0.15)",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            background: "rgba(59,130,246,0.05)",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(59,130,246,0.08)",
        },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(59,130,246,0.12)",
        },
      },
    },

    // ── List items (sidebar nav) ──────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: "0.5rem",
          transition: "all 0.18s ease",
          "&.Mui-selected": {
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.3)",
            boxShadow: "0 0 0.75rem rgba(59,130,246,0.15)",
            "&:hover": {
              background: "rgba(59,130,246,0.2)",
            },
          },
          "&:hover": {
            background: "rgba(59,130,246,0.08)",
          },
        },
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: "rgba(13,22,53,0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(59,130,246,0.2)",
          fontSize: "0.75rem",
        },
      },
    },

    // ── Alert ─────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(8px)",
          border: "1px solid",
        },
        standardError: {
          background: "rgba(239,68,68,0.1)",
          borderColor: "rgba(239,68,68,0.25)",
        },
        standardSuccess: {
          background: "rgba(16,185,129,0.1)",
          borderColor: "rgba(16,185,129,0.25)",
        },
        standardWarning: {
          background: "rgba(245,158,11,0.1)",
          borderColor: "rgba(245,158,11,0.25)",
        },
        standardInfo: {
          background: "rgba(59,130,246,0.1)",
          borderColor: "rgba(59,130,246,0.25)",
        },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        root: {
          background: "rgba(13,22,53,0.4)",
        },
      },
    },

    // ── Menu (dropdowns) ─────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: "rgba(7,13,27,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(59,130,246,0.2)",
          boxShadow: "0 0.5rem 2rem rgba(0,0,0,0.5)",
        },
      },
    },

    // ── Fab ──────────────────────────────────────────────────────────────
    MuiFab: {
      styleOverrides: {
        primary: {
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          boxShadow: "0 0.25rem 1rem rgba(59,130,246,0.45)",
          "&:hover": {
            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
            boxShadow: "0 0.5rem 1.5rem rgba(59,130,246,0.6)",
          },
        },
      },
    },
  },
})

// ── Glass helper — import this in sx props ────────────────────────────────────
// Usage: sx={{ ...glassCard }}
export const glassCard = {
  background: "rgba(13,22,53,0.6)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(59,130,246,0.15)",
  boxShadow: "0 0.25rem 1.5rem rgba(0,0,0,0.35)",
} as const

export const glassPanel = {
  background: "rgba(7,13,27,0.75)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(59,130,246,0.12)",
} as const

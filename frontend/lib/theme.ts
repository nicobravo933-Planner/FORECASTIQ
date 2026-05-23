import { createTheme } from "@mui/material/styles"

/**
 * ForecastIQ Design System — Navy Pro
 * Fiel al HTML de referencia (navyPro theme):
 *   Header:  gradiente azul marino #0f2044 → #1a3868
 *   Sidebar: blanco con borde gris
 *   Body:    #f0f4f8 (gris azulado claro)
 *   Primary: #3b82f6 / #2563eb
 */

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main:         "#2563eb",
      light:        "#3b82f6",
      dark:         "#1d4ed8",
      contrastText: "#ffffff",
    },
    secondary: {
      main:         "#06b6d4",
      light:        "#22d3ee",
      dark:         "#0891b2",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f0f4f8",
      paper:   "#ffffff",
    },
    text: {
      primary:   "#111827",
      secondary: "#6b7280",
      disabled:  "#9ca3af",
    },
    divider: "#e5e7eb",
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
    body1:   { fontSize: "1rem",     lineHeight: 1.6 },
    body2:   { fontSize: "0.875rem", lineHeight: 1.6 },
    caption: { fontSize: "0.75rem",  lineHeight: 1.5 },
    button:  { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" },
  },

  shape: { borderRadius: 10 },

  components: {
    // ── Buttons ──────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1.125rem",
          transition: "all 0.15s ease",
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          boxShadow: "0 0.125rem 0.5rem rgba(59,130,246,0.35)",
          "&:hover": {
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.45)",
            transform: "translateY(-0.0625rem)",
          },
        },
        outlinedPrimary: {
          borderColor: "#bfdbfe",
          "&:hover": {
            borderColor: "#3b82f6",
            background: "#eff6ff",
          },
        },
      },
    },

    // ── Cards ─────────────────────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "0.75rem",
          backgroundImage: "none",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 0.0625rem 0.1875rem rgba(0,0,0,0.06), 0 0.0625rem 0.125rem rgba(0,0,0,0.04)",
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
          "&:hover": {
            borderColor: "#bfdbfe",
            boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.12)",
          },
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        },
        elevation1: { boxShadow: "0 0.0625rem 0.1875rem rgba(0,0,0,0.06), 0 0.0625rem 0.125rem rgba(0,0,0,0.04)" },
        elevation8: { boxShadow: "0 0.25rem 1.5rem rgba(0,0,0,0.12), 0 0.0625rem 0.25rem rgba(0,0,0,0.08)" },
      },
    },

    // ── AppBar ────────────────────────────────────────────────────────────
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(135deg, #0f2044 0%, #1a3868 100%)",
          boxShadow: "0 0.125rem 0.75rem rgba(0,0,0,0.25)",
        },
      },
    },

    // ── Drawer ────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          boxShadow: "0.125rem 0 0.5rem rgba(0,0,0,0.06)",
        },
      },
    },

    // ── TextField ─────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: "#ffffff",
          "& fieldset": {
            borderColor: "#d1d5db",
            transition: "border-color 0.15s ease",
          },
          "&:hover fieldset": { borderColor: "#93c5fd" },
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
        filledPrimary: {
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          color: "#2563eb",
        },
        outlinedPrimary: {
          borderColor: "#bfdbfe",
          color: "#2563eb",
        },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 600,
            color: "#374151",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { background: "#f9fafb" },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: "1px solid #f3f4f6" },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "#f3f4f6" },
      },
    },

    // ── ListItemButton (sidebar) ──────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: "0.5rem",
          borderLeft: "0.1875rem solid transparent",
          transition: "all 0.15s ease",
          "&.Mui-selected": {
            background: "rgba(59,130,246,0.08)",
            borderLeftColor: "#3b82f6",
            color: "#2563eb",
            "&:hover": { background: "rgba(59,130,246,0.12)" },
          },
          "&:hover:not(.Mui-selected)": {
            background: "rgba(59,130,246,0.04)",
          },
        },
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: "#1f2937",
          fontSize: "0.75rem",
          borderRadius: "0.375rem",
        },
        arrow: { color: "#1f2937" },
      },
    },

    // ── Alert ─────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        standardError:   { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" },
        standardSuccess: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
        standardWarning: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" },
        standardInfo:    { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        root: { background: "#ffffff" },
      },
    },

    // ── Menu ──────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 0.25rem 1rem rgba(0,0,0,0.12)",
        },
      },
    },

    // ── Fab ───────────────────────────────────────────────────────────────
    MuiFab: {
      styleOverrides: {
        primary: {
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          boxShadow: "0 0.25rem 0.75rem rgba(59,130,246,0.4)",
          "&:hover": {
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            boxShadow: "0 0.5rem 1.25rem rgba(59,130,246,0.5)",
          },
        },
      },
    },
  },
})

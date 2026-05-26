import { createTheme, type Theme } from "@mui/material/styles"

// ── Theme presets — ForecastIQ ────────────────────────────────────────────────
// 4 variantes seleccionables desde /settings.
// Cada una extiende la misma tipografía y componentes base.

export type ThemeId = "navyPro" | "graphiteDark" | "blueMui" | "violetAI"

export const THEME_META: Record<ThemeId, { label: string; preview: string[]; appBarBg: string }> = {
  navyPro:      { label: "Navy Pro",      preview: ["#0f2044", "#3b82f6", "#f0f4f8"], appBarBg: "linear-gradient(135deg, #0f2044 0%, #1a3868 100%)" },
  graphiteDark: { label: "Graphite Dark", preview: ["#18181b", "#6366f1", "#09090b"], appBarBg: "#18181b" },
  blueMui:      { label: "Blue MUI",      preview: ["#1565C0", "#1976D2", "#f5f7fa"], appBarBg: "linear-gradient(135deg, #1565C0 0%, #1976D2 100%)" },
  violetAI:     { label: "Violet AI",     preview: ["#2d1b69", "#7c3aed", "#faf7ff"], appBarBg: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #5b21b6 100%)" },
}

export const LS_THEME_KEY = "forecastiq:theme"

// ── Shared typography & shape (all themes) ────────────────────────────────────

const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontSize: "2.25rem",  fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: "1.875rem", fontWeight: 600, lineHeight: 1.3 },
  h3: { fontSize: "1.5rem",   fontWeight: 600, lineHeight: 1.4 },
  h4: { fontSize: "1.25rem",  fontWeight: 600, lineHeight: 1.4 },
  h5: { fontSize: "1.125rem", fontWeight: 500, lineHeight: 1.5 },
  h6: { fontSize: "1rem",     fontWeight: 500, lineHeight: 1.5 },
  body1:   { fontSize: "1rem",     lineHeight: 1.6 },
  body2:   { fontSize: "0.875rem", lineHeight: 1.6 },
  caption: { fontSize: "0.75rem",  lineHeight: 1.5 },
  button:  { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" as const },
}

// ── Component overrides factory ───────────────────────────────────────────────

function makeComponents(accent: string, accentDark: string, isDark: boolean) {
  const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`
  return {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1.125rem",
          transition: "all 0.15s ease",
          "&.Mui-disabled": { color: "rgba(255,255,255,0.6)" },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
          boxShadow: `0 0.125rem 0.5rem ${alpha(accent, 0.35)}`,
          "&:hover": {
            background: `linear-gradient(135deg, ${accentDark} 0%, ${accentDark} 100%)`,
            boxShadow: `0 0.25rem 0.75rem ${alpha(accent, 0.45)}`,
            transform: "translateY(-0.0625rem)",
          },
          "&.Mui-disabled": {
            background: `linear-gradient(135deg, ${alpha(accent, 0.5)} 0%, ${alpha(accentDark, 0.5)} 100%)`,
            color: "#ffffff",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "0.75rem",
          backgroundImage: "none",
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { background: isDark ? "#3f3f46" : "#1f2937", fontSize: "0.75rem", borderRadius: "0.375rem" },
        arrow:   { color: isDark ? "#3f3f46" : "#1f2937" },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardError:   { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" },
        standardSuccess: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
        standardWarning: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" },
        standardInfo:    { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6" } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& fieldset": { transition: "border-color 0.15s ease" },
          "&.Mui-focused fieldset": {
            borderColor: accent,
            boxShadow: `0 0 0 0.1875rem ${alpha(accent, 0.15)}`,
          },
        },
      },
    },
  }
}

// ── Theme factories ───────────────────────────────────────────────────────────

function navyPro(): Theme {
  return createTheme({
    palette: {
      mode: "light",
      primary:    { main: "#2563eb", light: "#3b82f6", dark: "#1d4ed8", contrastText: "#ffffff" },
      secondary:  { main: "#06b6d4", light: "#22d3ee", dark: "#0891b2", contrastText: "#ffffff" },
      background: { default: "#f0f4f8", paper: "#ffffff" },
      text:       { primary: "#111827", secondary: "#6b7280", disabled: "#9ca3af" },
      divider:    "#e5e7eb",
      error:   { main: "#ef4444" },
      warning: { main: "#f59e0b" },
      success: { main: "#10b981" },
      info:    { main: "#3b82f6" },
    },
    typography,
    shape: { borderRadius: 10 },
    components: {
      ...makeComponents("#3b82f6", "#2563eb", false),
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: "linear-gradient(135deg, #0f2044 0%, #1a3868 100%)",
            boxShadow: "0 0.125rem 0.75rem rgba(0,0,0,0.25)",
          },
        },
      },
    },
  })
}

function graphiteDark(): Theme {
  return createTheme({
    palette: {
      mode: "dark",
      primary:    { main: "#6366f1", light: "#818cf8", dark: "#4f46e5", contrastText: "#ffffff" },
      secondary:  { main: "#a78bfa", light: "#c4b5fd", dark: "#7c3aed", contrastText: "#ffffff" },
      background: { default: "#09090b", paper: "#18181b" },
      text:       { primary: "#fafafa", secondary: "#a1a1aa", disabled: "#71717a" },
      divider:    "#27272a",
      error:   { main: "#f87171" },
      warning: { main: "#fbbf24" },
      success: { main: "#34d399" },
      info:    { main: "#60a5fa" },
    },
    typography,
    shape: { borderRadius: 10 },
    components: {
      ...makeComponents("#6366f1", "#4f46e5", true),
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: "#18181b",
            borderBottom: "1px solid #27272a",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { background: "#1c1c1f", borderRight: "1px solid #27272a" },
        },
      },
    },
  })
}

function blueMui(): Theme {
  return createTheme({
    palette: {
      mode: "light",
      primary:    { main: "#1976D2", light: "#42a5f5", dark: "#1565C0", contrastText: "#ffffff" },
      secondary:  { main: "#9c27b0", light: "#ba68c8", dark: "#7b1fa2", contrastText: "#ffffff" },
      background: { default: "#f5f7fa", paper: "#ffffff" },
      text:       { primary: "#111827", secondary: "#6b7280", disabled: "#9ca3af" },
      divider:    "#e5e7eb",
      error:   { main: "#ef4444" },
      warning: { main: "#f59e0b" },
      success: { main: "#10b981" },
      info:    { main: "#1976D2" },
    },
    typography,
    shape: { borderRadius: 10 },
    components: {
      ...makeComponents("#1976D2", "#1565C0", false),
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: "linear-gradient(135deg, #1565C0 0%, #1976D2 100%)",
            boxShadow: "0 0.125rem 0.625rem rgba(21,101,192,0.35)",
          },
        },
      },
    },
  })
}

function violetAI(): Theme {
  return createTheme({
    palette: {
      mode: "light",
      primary:    { main: "#7c3aed", light: "#a78bfa", dark: "#6d28d9", contrastText: "#ffffff" },
      secondary:  { main: "#ec4899", light: "#f9a8d4", dark: "#be185d", contrastText: "#ffffff" },
      background: { default: "#faf7ff", paper: "#ffffff" },
      text:       { primary: "#1a1033", secondary: "#6b7280", disabled: "#9ca3af" },
      divider:    "#ede9fe",
      error:   { main: "#ef4444" },
      warning: { main: "#f59e0b" },
      success: { main: "#10b981" },
      info:    { main: "#7c3aed" },
    },
    typography,
    shape: { borderRadius: 10 },
    components: {
      ...makeComponents("#7c3aed", "#6d28d9", false),
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #5b21b6 100%)",
            boxShadow: "0 0.125rem 1rem rgba(76,29,149,0.4)",
          },
        },
      },
    },
  })
}

// ── Public factory ─────────────────────────────────────────────────────────────

const FACTORIES: Record<ThemeId, () => Theme> = {
  navyPro,
  graphiteDark,
  blueMui,
  violetAI,
}

export function buildTheme(id: ThemeId): Theme {
  return FACTORIES[id]?.() ?? navyPro()
}

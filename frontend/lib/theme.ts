import { createTheme } from "@mui/material/styles"

// Single source of truth for all colors and typography.
// Never hardcode colors anywhere else — always use theme tokens.
export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#6366f1",   // indigo-500
      light: "#818cf8",  // indigo-400
      dark: "#4f46e5",   // indigo-600
    },
    secondary: {
      main: "#06b6d4",   // cyan-500
      light: "#22d3ee",  // cyan-400
      dark: "#0891b2",   // cyan-600
    },
    background: {
      default: "#0f172a", // slate-900
      paper: "#1e293b",   // slate-800
    },
    text: {
      primary: "#f1f5f9",   // slate-100
      secondary: "#94a3b8", // slate-400
    },
    divider: "#334155",     // slate-700
    error: { main: "#ef4444" },
    warning: { main: "#f59e0b" },
    success: { main: "#10b981" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    // All font sizes in rem
    h1: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "1.875rem", fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: "1.125rem", fontWeight: 500, lineHeight: 1.5 },
    h6: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.5 },
    body1: { fontSize: "1rem", lineHeight: 1.6 },
    body2: { fontSize: "0.875rem", lineHeight: 1.6 },
    caption: { fontSize: "0.75rem", lineHeight: 1.5 },
    button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: "0.5rem", padding: "0.5rem 1.25rem" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: "0.75rem", backgroundImage: "none" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
})

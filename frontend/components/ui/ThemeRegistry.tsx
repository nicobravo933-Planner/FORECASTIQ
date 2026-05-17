"use client"

// MUI v6 requires this wrapper for App Router SSR compatibility.
// Handles emotion cache injection server-side.
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import { theme } from "@/lib/theme"

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

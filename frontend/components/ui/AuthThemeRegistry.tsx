"use client"

/**
 * AuthThemeRegistry — isolated ThemeProvider for the (auth) route group.
 *
 * Completely independent from the dashboard ThemeRegistry.
 * Reads the auth theme preference from localStorage (key: forecastiq:auth-theme).
 * Default: "spaceAuth" (dark space background with particle canvas).
 *
 * The "authMinimal" fallback renders the same layout without canvas animations
 * for users who prefer reduced motion or a lighter aesthetic.
 */

import { useEffect, useState } from "react"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import { buildTheme } from "@/lib/themePresets"
import type { AuthThemeId } from "@/lib/themePresets"
import { LS_AUTH_THEME_KEY } from "@/lib/themePresets"

// Map auth theme id → the MUI theme to apply
const AUTH_TO_MUI: Record<AuthThemeId, Parameters<typeof buildTheme>[0]> = {
  spaceAuth:   "spaceAuth",
  authMinimal: "navyPro",   // reuse navyPro light for the minimal variant
}

function getStoredAuthTheme(): AuthThemeId {
  if (typeof window === "undefined") return "spaceAuth"
  return (localStorage.getItem(LS_AUTH_THEME_KEY) as AuthThemeId) ?? "spaceAuth"
}

export default function AuthThemeRegistry({ children }: { children: React.ReactNode }) {
  const [authTheme, setAuthTheme] = useState<AuthThemeId>("spaceAuth")

  useEffect(() => {
    setAuthTheme(getStoredAuthTheme())

    // Listen for live updates from the Settings page
    const onThemeChange = (e: Event) => {
      const id = (e as CustomEvent<AuthThemeId>).detail
      setAuthTheme(id)
      localStorage.setItem(LS_AUTH_THEME_KEY, id)
    }

    window.addEventListener("fiq:auth-theme-change", onThemeChange)
    return () => window.removeEventListener("fiq:auth-theme-change", onThemeChange)
  }, [])

  const muiThemeId = AUTH_TO_MUI[authTheme]

  return (
    <ThemeProvider theme={buildTheme(muiThemeId)}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

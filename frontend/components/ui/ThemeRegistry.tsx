"use client"

/**
 * ThemeRegistry — dynamic MUI theme provider.
 * Reads the selected theme from localStorage (key: forecastiq:theme).
 * Reacts to the custom "fiq:theme-change" event emitted by the settings page.
 */
import { useEffect, useState } from "react"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import { buildTheme, LS_THEME_KEY, THEME_META, type ThemeId } from "@/lib/themePresets"

function getStoredThemeId(): ThemeId {
  if (typeof window === "undefined") return "navyPro"
  return (localStorage.getItem(LS_THEME_KEY) as ThemeId) ?? "navyPro"
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("navyPro")

  // Sync from localStorage on mount (client only)
  useEffect(() => {
    setThemeId(getStoredThemeId())

    const onThemeChange = (e: Event) => {
      const id = (e as CustomEvent<ThemeId>).detail
      setThemeId(id)
    }

    window.addEventListener("fiq:theme-change", onThemeChange)
    return () => window.removeEventListener("fiq:theme-change", onThemeChange)
  }, [])

  const appBarBg = THEME_META[themeId]?.appBarBg ?? "#1a3868"

  return (
    <ThemeProvider theme={buildTheme(themeId)}>
      <CssBaseline />
      {/* Inyecta el appBarBg como CSS var para que layout.tsx lo lea sin useTheme frágil */}
      <style>{`:root { --fiq-appbar-bg: ${appBarBg}; }`}</style>
      {children}
    </ThemeProvider>
  )
}

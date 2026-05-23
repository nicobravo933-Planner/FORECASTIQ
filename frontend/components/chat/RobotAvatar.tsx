"use client"

/**
 * RobotAvatar — Lottie robot, siempre fondo transparente.
 * Sin círculo ni gradiente detrás. El contenedor no tiene borderRadius ni overflow.
 */

import { useEffect, useRef } from "react"
import Box from "@mui/material/Box"

interface RobotAvatarProps {
  size?: number
  pulse?: boolean
}

export function RobotAvatar({ size = 40, pulse = false }: RobotAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef      = useRef<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const lottieModule = await import("lottie-web")
        const lottie = ((lottieModule as Record<string, unknown>).default ?? lottieModule) as {
          loadAnimation: (params: unknown) => { destroy: () => void }
        }
        const data = await fetch("/robot.json").then((r) => {
          if (!r.ok) throw new Error("robot.json not found")
          return r.json()
        })
        if (cancelled || !containerRef.current) return
        if (animRef.current) (animRef.current as { destroy: () => void }).destroy()
        animRef.current = lottie.loadAnimation({
          container:     containerRef.current,
          renderer:      "svg",
          loop:          true,
          autoplay:      true,
          animationData: data,
        })
      } catch {
        // silently ignore — no fallback shown
      }
    }

    void load()
    return () => {
      cancelled = true
      if (animRef.current) (animRef.current as { destroy: () => void }).destroy()
    }
  }, [])

  return (
    <Box
      sx={{
        width:      `${size}px`,
        height:     `${size}px`,
        flexShrink: 0,
        position:   "relative",
        background: "transparent",
        // Optional glow pulse
        ...(pulse && {
          animation: "robotGlow 2.5s ease-in-out infinite",
          "@keyframes robotGlow": {
            "0%, 100%": { filter: "drop-shadow(0 0 0.375rem rgba(59,130,246,0.4))" },
            "50%":      { filter: "drop-shadow(0 0 0.875rem rgba(59,130,246,0.75))" },
          },
        }),
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          "& svg": { width: "100% !important", height: "100% !important" },
        }}
      />
    </Box>
  )
}

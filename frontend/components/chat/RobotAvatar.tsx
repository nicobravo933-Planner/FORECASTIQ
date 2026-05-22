"use client"

/**
 * RobotAvatar — Lottie robot animation used in chat header and WelcomeScreen.
 * Falls back to a gradient circle with AutoGraphIcon if Lottie fails to load.
 */

import { useEffect, useRef } from "react"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import Box from "@mui/material/Box"

interface RobotAvatarProps {
  size?: number   // px — default 40
  pulse?: boolean // adds glow pulse animation
}

export function RobotAvatar({ size = 40, pulse = false }: RobotAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef      = useRef<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const lottie = require("lottie-web") as typeof import("lottie-web")
        const data   = await fetch("/robot.json").then((r) => {
          if (!r.ok) throw new Error("robot.json not found")
          return r.json()
        })
        if (cancelled || !containerRef.current) return
        // Clear any previous instance
        if (animRef.current) (animRef.current as { destroy: () => void }).destroy()
        animRef.current = lottie.loadAnimation({
          container:     containerRef.current,
          renderer:      "svg",
          loop:          true,
          autoplay:      true,
          animationData: data,
        })
      } catch {
        // Fallback rendered via CSS — nothing to do here
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
        width:        `${size}px`,
        height:       `${size}px`,
        borderRadius: "50%",
        flexShrink:   0,
        overflow:     "hidden",
        position:     "relative",
        // Glow pulse (optional)
        ...(pulse && {
          animation: "robotGlow 2.5s ease-in-out infinite",
          "@keyframes robotGlow": {
            "0%, 100%": { boxShadow: "0 0 0.5rem rgba(99,102,241,0.4)" },
            "50%":      { boxShadow: "0 0 1.25rem rgba(99,102,241,0.75)" },
          },
        }),
      }}
    >
      {/* Lottie container — fills the circle */}
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          // Lottie SVG overflows slightly — clip it
          "& svg": { width: "100% !important", height: "100% !important" },
        }}
      />

      {/* Fallback gradient circle — shown if Lottie container is empty */}
      <Box
        sx={{
          position:        "absolute",
          inset:           0,
          borderRadius:    "50%",
          background:      "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          // Hide once lottie renders (lottie adds an SVG child)
          "& .lottie-loaded &": { display: "none" },
          zIndex:          -1,
        }}
      >
        <AutoGraphIcon sx={{ fontSize: `${size * 0.45}px`, color: "white" }} />
      </Box>
    </Box>
  )
}

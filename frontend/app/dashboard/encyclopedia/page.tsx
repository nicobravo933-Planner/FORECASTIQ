"use client"

/**
 * Encyclopedia page — interactive book layout
 * Left: ChapterSidebar (15rem fixed)
 * Right: Chapter content with scroll
 * Progress tracking via localStorage
 */

import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import MenuBookIcon from "@mui/icons-material/MenuBook"
import { useEffect, useRef, useState } from "react"
import { ChapterSidebar, CHAPTERS } from "@/components/encyclopedia/ChapterSidebar"
import {
  Chapter01, Chapter02, Chapter03, Chapter04,
  Chapter05, Chapter06, Chapter07, Chapter08,
  Chapter09, Chapter10, Chapter11, Chapter12,
} from "@/components/encyclopedia/chapters"

// Map chapter id → component
const CHAPTER_COMPONENTS: Record<number, React.ComponentType> = {
  1:  Chapter01,
  2:  Chapter02,
  3:  Chapter03,
  4:  Chapter04,
  5:  Chapter05,
  6:  Chapter06,
  7:  Chapter07,
  8:  Chapter08,
  9:  Chapter09,
  10: Chapter10,
  11: Chapter11,
  12: Chapter12,
}

const STORAGE_KEY = "encyclopedia_read_chapters"

function loadReadChapters(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch {
    return new Set()
  }
}

function saveReadChapters(set: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch { /* ignore */ }
}

export default function EncyclopediaPage() {
  const [activeChapter, setActiveChapter] = useState(1)
  const [readChapters, setReadChapters]   = useState<Set<number>>(new Set())
  const contentRef = useRef<HTMLDivElement>(null)

  // Load progress from localStorage on mount
  useEffect(() => {
    setReadChapters(loadReadChapters())
  }, [])

  // Mark chapter as read when user scrolls to bottom
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    // Scroll to top when chapter changes
    el.scrollTop = 0

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollTop + clientHeight >= scrollHeight - 80) {
        setReadChapters((prev) => {
          if (prev.has(activeChapter)) return prev
          const next = new Set(prev)
          next.add(activeChapter)
          saveReadChapters(next)
          return next
        })
      }
    }
    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [activeChapter])

  const handleSelect = (id: number) => setActiveChapter(id)

  const goPrev = () => setActiveChapter((v) => Math.max(1, v - 1))
  const goNext = () => setActiveChapter((v) => Math.min(CHAPTERS.length, v + 1))

  const ChapterContent = CHAPTER_COMPONENTS[activeChapter]
  const meta = CHAPTERS.find((c) => c.id === activeChapter)!

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 4rem)", overflow: "hidden", mx: "-1.75rem", mt: "-1.75rem" }}>

      {/* Left sidebar */}
      <ChapterSidebar
        activeChapter={activeChapter}
        onSelect={handleSelect}
        readChapters={readChapters}
      />

      {/* Right: content area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Chapter header bar */}
        <Box sx={{
          px: "2rem", py: "0.875rem",
          borderBottom: "1px solid", borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0,
        }}>
          <MenuBookIcon sx={{ color: "primary.main", fontSize: "1.25rem" }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", lineHeight: 1 }}>
              Capítulo {meta.id} de {CHAPTERS.length}  ·  {meta.readTime} min lectura
            </Typography>
            <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem", mt: "0.125rem" }}>
              {meta.emoji} {meta.title}
            </Typography>
          </Box>
          {/* Prev / Next navigation */}
          <Box sx={{ display: "flex", gap: "0.375rem" }}>
            <Tooltip title="Capítulo anterior">
              <span>
                <IconButton size="small" onClick={goPrev} disabled={activeChapter === 1}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Capítulo siguiente">
              <span>
                <IconButton size="small" onClick={goNext} disabled={activeChapter === CHAPTERS.length}>
                  <ArrowForwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Scrollable content */}
        <Box
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: "auto",
            px: { xs: "1.5rem", md: "3rem", lg: "4rem" },
            py: "2.5rem",
            maxWidth: "52rem",
            width: "100%",
            mx: "auto",
          }}
        >
          <ChapterContent />

          {/* Bottom navigation */}
          <Box sx={{ mt: "3rem", pt: "1.5rem", borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              {activeChapter > 1 && (
                <Box sx={{ cursor: "pointer", "&:hover": { opacity: 0.7 } }} onClick={goPrev}>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>← Anterior</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>
                    {CHAPTERS[activeChapter - 2].emoji} {CHAPTERS[activeChapter - 2].title}
                  </Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ textAlign: "right" }}>
              {activeChapter < CHAPTERS.length && (
                <Box sx={{ cursor: "pointer", "&:hover": { opacity: 0.7 } }} onClick={goNext}>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>Siguiente →</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>
                    {CHAPTERS[activeChapter].emoji} {CHAPTERS[activeChapter].title}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

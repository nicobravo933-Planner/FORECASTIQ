"use client"

/**
 * Encyclopedia page — 3-column book layout
 * Left  (15rem fixed): ChapterSidebar — chapter list + collapsible sections
 * Center (flex-1):     Chapter content — scrollable, maxWidth 52rem centered
 * Right  (13rem fixed): TOC — sections of active chapter, scroll-spy highlight
 *
 * Progreso: manual. El usuario marca/desmarca cada capítulo como leído con el
 * botón en el header. No hay auto-mark por scroll.
 */

import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import MenuBookIcon from "@mui/icons-material/MenuBook"
import { useEffect, useRef, useState, useCallback } from "react"
import { ChapterSidebar, CHAPTERS } from "@/components/encyclopedia/ChapterSidebar"
import {
  Chapter01, Chapter02, Chapter03, Chapter04,
  Chapter05, Chapter06, Chapter07, Chapter08,
  Chapter09, Chapter10, Chapter11, Chapter12,
} from "@/components/encyclopedia/chapters"

// Map chapter id → component
const CHAPTER_COMPONENTS: Record<number, React.ComponentType> = {
  1:  Chapter01, 2:  Chapter02, 3:  Chapter03, 4:  Chapter04,
  5:  Chapter05, 6:  Chapter06, 7:  Chapter07, 8:  Chapter08,
  9:  Chapter09, 10: Chapter10, 11: Chapter11, 12: Chapter12,
}

const STORAGE_KEY = "encyclopedia_read_chapters"

function loadReadChapters(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch { return new Set() }
}

function saveReadChapters(set: Set<number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])) }
  catch { /* ignore */ }
}

// ── TOC right panel ──────────────────────────────────────────────────────────
function TocPanel({
  chapterId,
  activeSection,
  onSectionClick,
}: {
  chapterId: number
  activeSection: string | null
  onSectionClick: (sectionId: string) => void
}) {
  const meta = CHAPTERS.find((c) => c.id === chapterId)
  if (!meta) return null

  return (
    <Box
      sx={{
        width: "13rem",
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        borderLeft: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        px: "0.875rem",
        py: "1.25rem",
      }}
    >
      <Typography
        sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.06em", mb: "0.75rem" }}
      >
        En este capítulo
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        {meta.sections.map((sec) => {
          const isActive = activeSection === sec.id
          return (
            <Box
              key={sec.id}
              onClick={() => onSectionClick(sec.id)}
              sx={{
                cursor: "pointer",
                px: "0.5rem",
                py: "0.3rem",
                borderRadius: "0.375rem",
                borderLeft: "0.125rem solid",
                borderColor: isActive ? "primary.main" : "transparent",
                bgcolor: isActive ? "rgba(59,130,246,0.07)" : "transparent",
                transition: "all 0.15s ease",
                "&:hover": { bgcolor: "rgba(59,130,246,0.05)", borderColor: "rgba(59,130,246,0.4)" },
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "primary.main" : "text.secondary",
                  lineHeight: 1.45,
                }}
              >
                {sec.title}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EncyclopediaPage() {
  const [activeChapter, setActiveChapter] = useState(1)
  const [activeSection,  setActiveSection]  = useState<string | null>(null)
  const [readChapters,   setReadChapters]   = useState<Set<number>>(new Set())
  const contentRef = useRef<HTMLDivElement>(null)

  // Load progress from localStorage on mount
  useEffect(() => { setReadChapters(loadReadChapters()) }, [])

  // Scroll spy only — sin auto-mark
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.scrollTop = 0
    setActiveSection(null)

    const handleScroll = () => {
      const headings = el.querySelectorAll("[data-section-id]")
      let current: string | null = null
      headings.forEach((h) => {
        const rect = (h as HTMLElement).getBoundingClientRect()
        if (rect.top <= 120) {
          current = (h as HTMLElement).dataset.sectionId ?? null
        }
      })
      setActiveSection(current)
    }

    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [activeChapter])

  // Toggle leído/no leído manualmente
  const toggleRead = useCallback((chapterId: number) => {
    setReadChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      saveReadChapters(next)
      return next
    })
  }, [])

  // Reiniciar todo el progreso
  const resetProgress = useCallback(() => {
    const empty = new Set<number>()
    setReadChapters(empty)
    saveReadChapters(empty)
  }, [])

  // Scroll to section heading when user clicks TOC or sidebar section
  const scrollToSection = useCallback((sectionId: string) => {
    const el = contentRef.current
    if (!el) return
    const target = el.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    setActiveSection(sectionId)
  }, [])

  const handleSelect = (id: number, sectionId?: string) => {
    if (id !== activeChapter) {
      setActiveChapter(id)
      setActiveSection(null)
      if (sectionId) {
        setTimeout(() => scrollToSection(sectionId), 120)
      }
    } else if (sectionId) {
      scrollToSection(sectionId)
    }
  }

  const goPrev = () => setActiveChapter((v) => Math.max(1, v - 1))
  const goNext = () => setActiveChapter((v) => Math.min(CHAPTERS.length, v + 1))

  const ChapterContent = CHAPTER_COMPONENTS[activeChapter]
  const meta    = CHAPTERS.find((c) => c.id === activeChapter)!
  const isRead  = readChapters.has(activeChapter)

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 4rem)", overflow: "hidden" }}>

      {/* Left sidebar — chapter list */}
      <ChapterSidebar
        activeChapter={activeChapter}
        activeSection={activeSection}
        onSelect={handleSelect}
        readChapters={readChapters}
        onResetProgress={resetProgress}
      />

      {/* Center — scrollable content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

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
              Capítulo {meta.id} de {CHAPTERS.length}&nbsp;·&nbsp;{meta.readTime} min lectura
            </Typography>
            <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem", mt: "0.125rem" }}>
              {meta.emoji} {meta.title}
            </Typography>
          </Box>

          {/* Botón manual leído/no leído */}
          <Tooltip title={isRead ? "Marcar como no leído" : "Marcar como leído"} placement="bottom">
            <Chip
              icon={isRead
                ? <CheckCircleIcon sx={{ fontSize: "0.9375rem !important", color: "success.main !important" }} />
                : <CheckCircleOutlineIcon sx={{ fontSize: "0.9375rem !important" }} />
              }
              label={isRead ? "Leído" : "Marcar leído"}
              onClick={() => toggleRead(activeChapter)}
              size="small"
              variant={isRead ? "filled" : "outlined"}
              sx={{
                fontSize: "0.75rem",
                height: "1.75rem",
                cursor: "pointer",
                bgcolor: isRead ? "rgba(34,197,94,0.1)" : "transparent",
                borderColor: isRead ? "success.light" : "divider",
                color: isRead ? "success.dark" : "text.secondary",
                "&:hover": {
                  bgcolor: isRead ? "rgba(34,197,94,0.18)" : "rgba(59,130,246,0.06)",
                },
                transition: "all 0.15s ease",
              }}
            />
          </Tooltip>

          {/* Prev / Next */}
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

        {/* Scrollable chapter content */}
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

      {/* Right — TOC panel */}
      <TocPanel
        chapterId={activeChapter}
        activeSection={activeSection}
        onSectionClick={scrollToSection}
      />
    </Box>
  )
}

"use client"

/**
 * DataSourceTabs — selector de fuente de datos con 4 tabs.
 *   Tab 0: Archivo       → CSV, Excel, Parquet (upload)
 *   Tab 1: Base de datos → conexión efímera PostgreSQL/MySQL/SQLite
 *   Tab 2: Cloud / Lake  → BigQuery, Snowflake, S3/Parquet (Fase 13)
 *   Tab 3: Dataset demo  → 25k SKUs Parquet en Supabase Storage
 *
 * Los tabs deshabilitados muestran un chip "Próximamente" o "Requiere modo local".
 */

import { useState } from "react"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import StorageIcon from "@mui/icons-material/Storage"
import CloudIcon from "@mui/icons-material/Cloud"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import LockIcon from "@mui/icons-material/Lock"
import type { ServerCapabilities } from "@/hooks/useCapabilities"

interface DataSourceTabsProps {
  csvContent:  React.ReactNode
  dbContent:   React.ReactNode
  cloudContent: React.ReactNode
  demoContent: React.ReactNode
  /** Pass caps from useCapabilities() — used to lock/unlock advanced tabs */
  caps?: ServerCapabilities | null
}

export function DataSourceTabs({
  csvContent,
  dbContent,
  cloudContent,
  demoContent,
  caps,
}: DataSourceTabsProps) {
  const [tab, setTab] = useState(0)

  const isLocal = caps?.tier === "local"

  // Tab definitions with lock logic
  const tabs = [
    {
      label: "Archivo",
      icon: <UploadFileIcon sx={{ fontSize: "1rem" }} />,
      locked: false,
      tooltip: "CSV, Excel, Parquet — subí tu archivo directamente",
    },
    {
      label: "Base de datos",
      icon: <StorageIcon sx={{ fontSize: "1rem" }} />,
      locked: false,
      tooltip: "Conectá tu PostgreSQL, MySQL o SQLite — conexión efímera, sin persistencia",
    },
    {
      label: "Cloud / Data Lake",
      icon: <CloudIcon sx={{ fontSize: "1rem" }} />,
      locked: true,
      tooltip: "BigQuery, Snowflake, S3 — disponible en Fase 13",
    },
    {
      label: "Dataset demo",
      icon: <AutoGraphIcon sx={{ fontSize: "1rem" }} />,
      locked: !caps?.features.demo_dataset,
      tooltip: isLocal
        ? "25 000 SKUs × 3 años — dataset sintético de planificación de demanda"
        : "Dataset demo disponible — leerá el Parquet desde Supabase Storage vía DuckDB",
    },
  ]

  // If current tab becomes locked (e.g. caps loaded after mount), fallback to 0
  const effectiveTab = tabs[tab]?.locked ? 0 : tab

  return (
    <Box>
      <Tabs
        value={effectiveTab}
        onChange={(_, v: number) => !tabs[v].locked && setTab(v)}
        sx={{
          mb: "1.5rem",
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": {
            textTransform: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            minHeight: "2.75rem",
            px: "1.125rem",
            color: "text.secondary",
            transition: "color 0.15s ease",
            opacity: 1,
          },
          "& .Mui-selected": { color: "primary.light", fontWeight: 600 },
          "& .MuiTabs-indicator": { bgcolor: "primary.main", height: "2px", borderRadius: "1px" },
          "& .Mui-disabled": { opacity: 0.45 },
        }}
      >
        {tabs.map((t, i) => (
          <Tooltip key={t.label} title={t.tooltip} placement="top" arrow>
            <span>   {/* span needed so Tooltip works on disabled Tab */}
              <Tab
                icon={t.locked
                  ? <LockIcon sx={{ fontSize: "0.875rem", opacity: 0.5 }} />
                  : t.icon
                }
                iconPosition="start"
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    {t.label}
                    {t.locked && (
                      <Chip
                        label="Próximamente"
                        size="small"
                        sx={{
                          height: "1rem",
                          fontSize: "0.625rem",
                          bgcolor: "rgba(99,102,241,0.1)",
                          color: "primary.light",
                          border: "1px solid rgba(99,102,241,0.2)",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </Box>
                }
                disabled={t.locked}
              />
            </span>
          </Tooltip>
        ))}
      </Tabs>

      {effectiveTab === 0 && <Box>{csvContent}</Box>}
      {effectiveTab === 1 && <Box>{dbContent}</Box>}
      {effectiveTab === 2 && <Box>{cloudContent}</Box>}
      {effectiveTab === 3 && <Box>{demoContent}</Box>}
    </Box>
  )
}

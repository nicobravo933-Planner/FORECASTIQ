"use client"

/**
 * DataSourceTabs — selector de fuente de datos con 4 tabs.
 *   Tab 0: Archivo       → CSV, Excel, Parquet (upload)
 *   Tab 1: Base de datos → conexión efímera PostgreSQL/MySQL/SQLite
 *   Tab 2: Dataset demo  → 25k SKUs Parquet en Supabase Storage
 *   Tab 3: Cloud / Lake  → BigQuery, Snowflake, S3/Parquet (Fase 13 — locked)
 */

import { useState } from "react"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import StorageIcon from "@mui/icons-material/Storage"
import CloudIcon from "@mui/icons-material/Cloud"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import LockIcon from "@mui/icons-material/Lock"
import type { ServerCapabilities } from "@/hooks/useCapabilities"

interface DataSourceTabsProps {
  csvContent:   React.ReactNode
  dbContent:    React.ReactNode
  demoContent:  React.ReactNode
  cloudContent: React.ReactNode
  caps?: ServerCapabilities | null
}

const TAB_DEFS = [
  { label: "Archivo",           icon: <UploadFileIcon sx={{ fontSize: "1rem" }} />, locked: false },
  { label: "Base de datos",     icon: <StorageIcon    sx={{ fontSize: "1rem" }} />, locked: false },
  { label: "Dataset demo",      icon: <AutoGraphIcon  sx={{ fontSize: "1rem" }} />, locked: false },
  { label: "Cloud / Data Lake", icon: <CloudIcon      sx={{ fontSize: "1rem" }} />, locked: true  },
]

export function DataSourceTabs({
  csvContent,
  dbContent,
  demoContent,
  cloudContent,
}: DataSourceTabsProps) {
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
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
        {TAB_DEFS.map((t) => (
          <Tab
            key={t.label}
            disabled={t.locked}
            icon={t.locked ? <LockIcon sx={{ fontSize: "0.875rem", opacity: 0.5 }} /> : t.icon}
            iconPosition="start"
            label={
              t.locked ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  {t.label}
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
                </Box>
              ) : t.label
            }
          />
        ))}
      </Tabs>

      {tab === 0 && csvContent}
      {tab === 1 && dbContent}
      {tab === 2 && demoContent}
      {tab === 3 && cloudContent}
    </Box>
  )
}

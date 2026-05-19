"use client"

/**
 * DataSourceTabs — three-tab selector for how the user provides data.
 *   Tab 0: Upload CSV (existing flow, unchanged)
 *   Tab 1: Demo dataset (placeholder → Phase 9)
 *   Tab 2: Connect DB (placeholder → backlog enterprise)
 */

import { useState } from "react"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Box from "@mui/material/Box"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import StorageIcon from "@mui/icons-material/Storage"
import LinkIcon from "@mui/icons-material/Link"

interface DataSourceTabsProps {
  /** Rendered inside Tab 0 */
  csvContent: React.ReactNode
  /** Rendered inside Tab 1 */
  demoContent: React.ReactNode
  /** Rendered inside Tab 2 */
  dbContent: React.ReactNode
}

export function DataSourceTabs({ csvContent, demoContent, dbContent }: DataSourceTabsProps) {
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
            px: "1.25rem",
            color: "text.secondary",
            transition: "color 0.15s ease",
          },
          "& .Mui-selected": { color: "primary.light", fontWeight: 600 },
          "& .MuiTabs-indicator": { bgcolor: "primary.main", height: "2px", borderRadius: "1px" },
        }}
      >
        <Tab
          icon={<UploadFileIcon sx={{ fontSize: "1rem" }} />}
          iconPosition="start"
          label="Subir CSV"
        />
        <Tab
          icon={<StorageIcon sx={{ fontSize: "1rem" }} />}
          iconPosition="start"
          label="Dataset demo"
        />
        <Tab
          icon={<LinkIcon sx={{ fontSize: "1rem" }} />}
          iconPosition="start"
          label="Conectar DB"
        />
      </Tabs>

      {tab === 0 && <Box>{csvContent}</Box>}
      {tab === 1 && <Box>{demoContent}</Box>}
      {tab === 2 && <Box>{dbContent}</Box>}
    </Box>
  )
}

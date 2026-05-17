"use client"

/**
 * Dashboard layout — persistent sidebar + topbar.
 * All dashboard routes share this shell.
 */

import { usePathname } from "next/navigation"
import Link from "next/link"
import Box from "@mui/material/Box"
import Drawer from "@mui/material/Drawer"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"
import ChatIcon from "@mui/icons-material/Chat"
import SettingsIcon from "@mui/icons-material/Settings"

const SIDEBAR_WIDTH = "14rem"

const NAV_ITEMS = [
  { label: "Dataset", href: "/dashboard/dataset", icon: <UploadFileIcon /> },
  { label: "Forecast", href: "/dashboard/forecast", icon: <ShowChartIcon /> },
  { label: "Calendario", href: "/dashboard/calendar", icon: <CalendarMonthIcon /> },
  { label: "Chat IA", href: "/dashboard/chat", icon: <ChatIcon /> },
  { label: "Ajustes", href: "/dashboard/settings", icon: <SettingsIcon /> },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ px: "1.25rem", py: "1.5rem" }}>
          <Typography
            variant="h6"
            color="primary"
            fontWeight={700}
            sx={{ letterSpacing: "-0.03em" }}
          >
            forecastiq
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Forecasting con IA
          </Typography>
        </Box>

        <Divider sx={{ borderColor: "divider" }} />

        {/* Nav */}
        <List sx={{ px: "0.5rem", pt: "0.75rem", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={active}
                sx={{
                  borderRadius: "0.5rem",
                  mb: "0.25rem",
                  "&.Mui-selected": {
                    bgcolor: "primary.dark",
                    color: "primary.contrastText",
                    "& .MuiListItemIcon-root": { color: "primary.light" },
                  },
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ListItemIcon sx={{ minWidth: "2.25rem", color: active ? "primary.light" : "text.secondary" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 400,
                    color: active ? "text.primary" : "text.secondary",
                  }}
                />
              </ListItemButton>
            )
          })}
        </List>

        <Divider sx={{ borderColor: "divider" }} />
        <Box sx={{ px: "1.25rem", py: "1rem" }}>
          <Typography variant="caption" color="text.disabled">
            Phase 1 — Data Ingestion
          </Typography>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          p: "2rem",
          overflow: "auto",
          maxWidth: "64rem",
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

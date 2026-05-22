"use client"

/**
 * Dashboard layout — colapsable glass sidebar + top header.
 *
 * Sidebar states:
 *   expanded  → 15rem  (logo + label)
 *   collapsed → 4rem   (solo íconos, tooltips on hover)
 * Toggle: botón ChevronLeft/Right en el bottom del sidebar.
 *
 * Header: barra superior fija con fecha, notificaciones, avatar.
 */

import BarChartIcon from "@mui/icons-material/BarChart"
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"
import ChatIcon from "@mui/icons-material/Chat"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone"
import ScienceIcon from "@mui/icons-material/Science"
import SettingsIcon from "@mui/icons-material/Settings"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import StorageIcon from "@mui/icons-material/Storage"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { FloatingChat } from "@/components/chat/FloatingChat"
import { signOut, useSession } from "@/lib/auth-client"

// ── Constants ────────────────────────────────────────────────────────────────
const SIDEBAR_EXPANDED  = "15rem"
const SIDEBAR_COLLAPSED = "4rem"
const HEADER_HEIGHT     = "3.5rem"

const NAV_ITEMS = [
  { label: "Mis Datasets", href: "/dashboard/datasets", icon: <StorageIcon fontSize="small" /> },
  { label: "Subir CSV",    href: "/dashboard/dataset",  icon: <UploadFileIcon fontSize="small" /> },
  { label: "Forecast",    href: "/dashboard/forecast", icon: <ShowChartIcon fontSize="small" /> },
  { label: "Calendario",  href: "/dashboard/calendar", icon: <CalendarMonthIcon fontSize="small" /> },
  { label: "Chat IA",     href: "/dashboard/chat",     icon: <ChatIcon fontSize="small" /> },
  { label: "MLOps",       href: "/dashboard/mlops",    icon: <ScienceIcon fontSize="small" /> },
  { label: "Batch",       href: "/dashboard/batch",    icon: <BarChartIcon fontSize="small" /> },
  { label: "Ajustes",     href: "/dashboard/settings", icon: <SettingsIcon fontSize="small" /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(): string {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  })
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/dataset" || href === "/dashboard/datasets") {
    return pathname === href || pathname.startsWith(href + "/")
  }
  return pathname.startsWith(href)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { data: session } = useSession()

  const [collapsed, setCollapsed] = useState(false)
  const [anchorEl, setAnchorEl]   = useState<null | HTMLElement>(null)

  const user     = session?.user
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  const handleLogout = async () => {
    setAnchorEl(null)
    await signOut()
    router.push("/login")
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <Box
        component="nav"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          background: "rgba(7,13,27,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(59,130,246,0.12)",
          boxShadow: "0.25rem 0 1.5rem rgba(0,0,0,0.4)",
          transition: "width 0.25s ease",
          overflow: "hidden",
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            height: HEADER_HEIGHT,
            px: collapsed ? "0.75rem" : "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            flexShrink: 0,
            borderBottom: "1px solid rgba(59,130,246,0.08)",
            overflow: "hidden",
            transition: "padding 0.25s ease",
          }}
        >
          {collapsed ? (
            // Mini logo — just the icon/monogram when collapsed
            <Box
              sx={{
                width: "2rem",
                height: "2rem",
                borderRadius: "0.5rem",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0.75rem rgba(59,130,246,0.4)",
                flexShrink: 0,
              }}
            >
              <ShowChartIcon sx={{ fontSize: "1.125rem", color: "white" }} />
            </Box>
          ) : (
            <Image
              src="/logo_rectangular.png"
              alt="forecastiq"
              width={148}
              height={32}
              style={{ objectFit: "contain", objectPosition: "left", maxWidth: "100%" }}
              priority
            />
          )}
        </Box>

        {/* Nav items */}
        <List sx={{ px: "0.5rem", pt: "0.75rem", flex: 1, overflow: "hidden" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname)
            return (
              <Tooltip
                key={item.href}
                title={collapsed ? item.label : ""}
                placement="right"
                arrow
              >
                <ListItemButton
                  component={Link}
                  href={item.href}
                  selected={active}
                  sx={{
                    borderRadius: "0.5rem",
                    mb: "0.2rem",
                    px: collapsed ? "0.625rem" : "0.75rem",
                    justifyContent: collapsed ? "center" : "flex-start",
                    minHeight: "2.5rem",
                    transition: "all 0.18s ease",
                    // Glass active state
                    "&.Mui-selected": {
                      background: "rgba(59,130,246,0.15)",
                      border: "1px solid rgba(59,130,246,0.28)",
                      boxShadow: "0 0 0.75rem rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
                      "& .MuiListItemIcon-root": { color: "primary.light" },
                      "& .MuiListItemText-primary": { color: "primary.light", fontWeight: 600 },
                    },
                    "&:hover:not(.Mui-selected)": {
                      background: "rgba(59,130,246,0.07)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : "2.25rem",
                      color: active ? "primary.light" : "text.secondary",
                      transition: "color 0.18s ease",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: "0.875rem",
                        fontWeight: active ? 600 : 400,
                        color: active ? "primary.light" : "text.secondary",
                        noWrap: true,
                        sx: { transition: "color 0.18s ease" },
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            )
          })}
        </List>

        <Divider sx={{ borderColor: "rgba(59,130,246,0.08)" }} />

        {/* User footer */}
        {!collapsed && (
          <Box
            sx={{
              px: "1rem",
              py: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
            }}
          >
            <Tooltip title={user?.email ?? "Sin sesión"} placement="top">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
                <Avatar
                  src={user?.image ?? undefined}
                  sx={{
                    width: "2rem",
                    height: "2rem",
                    fontSize: "0.75rem",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    boxShadow: "0 0 0.5rem rgba(59,130,246,0.4)",
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Box sx={{ overflow: "hidden", flex: 1 }}>
              <Typography variant="caption" fontWeight={500} noWrap display="block" color="text.primary">
                {user?.name ?? "Invitado"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontSize: "0.65rem" }}>
                Ver perfil
              </Typography>
            </Box>
          </Box>
        )}

        {/* Collapse toggle button */}
        <Box
          sx={{
            px: "0.5rem",
            pb: "0.75rem",
            display: "flex",
            justifyContent: collapsed ? "center" : "flex-end",
          }}
        >
          <Tooltip title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"} placement="right">
            <IconButton
              onClick={() => setCollapsed((v) => !v)}
              size="small"
              sx={{
                color: "text.secondary",
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.15)",
                borderRadius: "0.5rem",
                width: "2rem",
                height: "2rem",
                "&:hover": {
                  background: "rgba(59,130,246,0.16)",
                  color: "primary.light",
                },
              }}
            >
              {collapsed ? <ChevronRightIcon sx={{ fontSize: "1rem" }} /> : <ChevronLeftIcon sx={{ fontSize: "1rem" }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Main column (header + content) ─────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* ── Top Header ──────────────────────────────────────────────── */}
        <Box
          component="header"
          sx={{
            height: HEADER_HEIGHT,
            position: "sticky",
            top: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: "1rem", md: "2rem" },
            background: "rgba(7,13,27,0.8)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(59,130,246,0.1)",
            boxShadow: "0 0.125rem 1rem rgba(0,0,0,0.3)",
            flexShrink: 0,
          }}
        >
          {/* Left: current page title + date */}
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: "0.75rem", textTransform: "capitalize" }}
            >
              {formatDate()}
            </Typography>
          </Box>

          {/* Right: actions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Notifications placeholder */}
            <Tooltip title="Notificaciones">
              <IconButton
                size="small"
                sx={{
                  color: "text.secondary",
                  "&:hover": { color: "primary.light", background: "rgba(59,130,246,0.1)" },
                }}
              >
                <NotificationsNoneIcon sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            </Tooltip>

            {/* User avatar */}
            <Tooltip title={user?.email ?? "Sin sesión"} placement="bottom">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: "0.25rem" }}>
                <Avatar
                  src={user?.image ?? undefined}
                  sx={{
                    width: "1.75rem",
                    height: "1.75rem",
                    fontSize: "0.7rem",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    boxShadow: "0 0 0.5rem rgba(59,130,246,0.4)",
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Page content ─────────────────────────────────────────────── */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "auto",
            px: { xs: "1rem", sm: "1.5rem", md: "2rem", lg: "2.5rem" },
            py: "2rem",
            // Subtle radial glow from top-left (fintech feel)
            background: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(59,130,246,0.07) 0%, transparent 60%)",
          }}
        >
          {children}
        </Box>
      </Box>

      {/* ── User context menu ─────────────────────────────────────────── */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {user ? (
          [
            <MenuItem key="email" disabled sx={{ fontSize: "0.8125rem", opacity: 0.6 }}>
              {user.email}
            </MenuItem>,
            <Divider key="div" />,
            <MenuItem
              key="logout"
              onClick={handleLogout}
              sx={{ fontSize: "0.875rem", color: "error.main" }}
            >
              Cerrar sesión
            </MenuItem>,
          ]
        ) : (
          <MenuItem component={Link} href="/login" onClick={() => setAnchorEl(null)} sx={{ fontSize: "0.875rem" }}>
            Iniciar sesión
          </MenuItem>
        )}
      </Menu>

      {/* ── Floating chat ─────────────────────────────────────────────── */}
      <FloatingChat />
    </Box>
  )
}

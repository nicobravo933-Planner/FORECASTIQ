"use client"

/**
 * Dashboard layout — Navy Pro
 * Fiel al HTML de referencia:
 *   Header: gradiente azul marino, logo ForecastIQ.png centrado, hamburger izquierda
 *   Sidebar: blanco, borde gris, nav con borde-left de acento activo
 *   Toggle: hamburger en header (no botón en el bottom del sidebar)
 */

import BarChartIcon from "@mui/icons-material/BarChart"
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"
import SmartToyIcon from "@mui/icons-material/SmartToy"
import MenuIcon from "@mui/icons-material/Menu"
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone"
import InsightsIcon from "@mui/icons-material/Insights"
import ScienceIcon from "@mui/icons-material/Science"
import SettingsIcon from "@mui/icons-material/Settings"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import StorageIcon from "@mui/icons-material/Storage"
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
import { useCapabilities } from "@/hooks/useCapabilities"
import Chip from "@mui/material/Chip"
import ComputerIcon from "@mui/icons-material/Computer"
import CloudIcon from "@mui/icons-material/Cloud"
import DnsIcon from "@mui/icons-material/Dns"

// ── Constants ─────────────────────────────────────────────────────────────────
const SIDEBAR_EXPANDED  = "15rem"
const SIDEBAR_COLLAPSED = "4rem"
const HEADER_HEIGHT     = "4rem"   // 64px — igual al HTML

const NAV_ITEMS = [
  { label: "Forecast",    href: "/dashboard/forecast", icon: <ShowChartIcon     fontSize="small" /> },
  { label: "Chat IA",     href: "/dashboard/chat",     icon: <SmartToyIcon      fontSize="small" /> },
  { label: "Calendario",  href: "/dashboard/calendar", icon: <CalendarMonthIcon fontSize="small" /> },
  { label: "Analytics",  href: "/dashboard/analytics",icon: <InsightsIcon      fontSize="small" /> },
  { label: "MLOps",       href: "/dashboard/mlops",    icon: <ScienceIcon       fontSize="small" /> },
  { label: "Batch",       href: "/dashboard/batch",    icon: <BarChartIcon      fontSize="small" /> },
  { label: "Datos",       href: "/dashboard/data",     icon: <StorageIcon       fontSize="small" /> },
]
const NAV_BOTTOM = [
  { label: "Ajustes", href: "/dashboard/settings", icon: <SettingsIcon fontSize="small" /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
// Sub-routes that belong to a nav item but live under a different path
const SUB_ROUTES: Record<string, string[]> = {
  "/dashboard/data": ["/dashboard/dataset", "/dashboard/datasets", "/dashboard/explorer"],
}

function isActive(href: string, pathname: string): boolean {
  if (pathname === href || pathname.startsWith(href + "/")) return true
  return (SUB_ROUTES[href] ?? []).some((sub) => pathname === sub || pathname.startsWith(sub + "/"))
}

// ── NavItem component ─────────────────────────────────────────────────────────
function NavItem({
  item,
  active,
  collapsed,
}: {
  item: { label: string; href: string; icon: React.ReactNode }
  active: boolean
  collapsed: boolean
}) {
  return (
    <Tooltip title={collapsed ? item.label : ""} placement="right" arrow>
      <ListItemButton
        component={Link}
        href={item.href}
        selected={active}
        sx={{
          mb: "0.125rem",
          mx: "0.5rem",
          px: collapsed ? "0.625rem" : "0.75rem",
          justifyContent: collapsed ? "center" : "flex-start",
          minHeight: "2.625rem",
          // Borde izquierdo de acento — fiel al HTML
          borderLeft: "0.1875rem solid transparent",
          borderRadius: collapsed ? "0.5rem" : "0 0.5rem 0.5rem 0",
          transition: "all 0.15s ease",
          "&.Mui-selected": {
            background: "rgba(59,130,246,0.08)",
            borderLeftColor: "#3b82f6",
            "& .MuiListItemIcon-root": { color: "#2563eb" },
          },
          "&.Mui-selected .MuiListItemText-primary": {
            color: "#2563eb",
            fontWeight: 600,
          },
          "&:hover:not(.Mui-selected)": {
            background: "rgba(59,130,246,0.04)",
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: collapsed ? 0 : "2.25rem",
            color: active ? "#2563eb" : "#9ca3af",
            transition: "color 0.15s ease",
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
              color: active ? "#2563eb" : "#6b7280",
              noWrap: true,
            }}
          />
        )}
      </ListItemButton>
    </Tooltip>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { data: session } = useSession()

  const [collapsed, setCollapsed] = useState(false)
  const [anchorEl, setAnchorEl]   = useState<null | HTMLElement>(null)
  const { caps } = useCapabilities()

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
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <Box
        component="nav"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 110,
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
          borderRight: "1px solid #e5e7eb",
          boxShadow: "0.125rem 0 0.5rem rgba(0,0,0,0.06)",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}
      >
        {/* Spacer igual al header */}
        <Box sx={{ height: HEADER_HEIGHT, flexShrink: 0 }} />

        {/* Nav items */}
        <List sx={{ pt: "0.5rem", flex: 1, overflow: "hidden", px: 0 }}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href, pathname)}
              collapsed={collapsed}
            />
          ))}
        </List>

        <Divider />

        {/* Bottom nav */}
        <List sx={{ py: "0.5rem", px: 0 }}>
          {NAV_BOTTOM.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href, pathname)}
              collapsed={collapsed}
            />
          ))}
        </List>

        <Divider />

        {/* User profile footer */}
        <Box
          sx={{
            px: collapsed ? "0.75rem" : "1rem",
            py: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            justifyContent: collapsed ? "center" : "flex-start",
            cursor: "pointer",
            "&:hover": { bgcolor: "rgba(0,0,0,0.03)" },
            transition: "background 0.15s",
          }}
          onClick={(e) => setAnchorEl(e.currentTarget as HTMLElement)}
        >
          <Avatar
            src={user?.image ?? undefined}
            sx={{
              width: "2.125rem",
              height: "2.125rem",
              fontSize: "0.75rem",
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              flexShrink: 0,
            }}
          >
            {initials}
          </Avatar>
          {!collapsed && (
            <Box sx={{ overflow: "hidden", flex: 1 }}>
              <Typography
                sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {user?.name ?? "Invitado"}
              </Typography>
              <Typography sx={{ fontSize: "0.6875rem", color: "#9ca3af", mt: "0.0625rem" }}>
                Ver perfil
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Main column ────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          ml: sidebarWidth,
          transition: "margin-left 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      >

        {/* ── Header ────────────────────────────────────────────────────── */}
        <Box
          component="header"
          sx={{
            height: HEADER_HEIGHT,
            position: "fixed",
            top: 0,
            // header abarca todo el ancho incluyendo sidebar
            left: 0,
            right: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            background: "linear-gradient(135deg, #0f2044 0%, #1a3868 100%)",
            boxShadow: "0 0.125rem 0.75rem rgba(0,0,0,0.25)",
            flexShrink: 0,
          }}
        >
          {/* Left: hamburger — alineado a la izquierda del área del sidebar */}
          <Box sx={{
            width: sidebarWidth,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            pl: "0.75rem",
            transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}>
            <Tooltip title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"} placement="right">
              <IconButton
                onClick={() => setCollapsed((v) => !v)}
                sx={{ color: "rgba(255,255,255,0.75)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
                  borderRadius: "0.5rem" }}
              >
                <MenuIcon sx={{ fontSize: "1.375rem" }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Center: logo ForecastIQ.png */}
          <Box sx={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Image
              src="/ForecastIQ.png"
              alt="ForecastIQ"
              width={160}
              height={38}
              style={{ objectFit: "contain", maxHeight: "2.375rem" }}
              priority
            />
          </Box>

          {/* Right: tier chip + notifications + avatar */}
          <Box sx={{ width: sidebarWidth, flexShrink: 0, display: "flex", alignItems: "center",
            justifyContent: "flex-end", pr: "1rem", gap: "0.25rem",
            transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)" }}>

            {/* Tier chip — always visible. Shows label when sidebar expanded, icon-only when collapsed */}
            <Chip
              icon={
                caps.tier === "local" ? <ComputerIcon /> :
                caps.tier === "ec2"   ? <DnsIcon      /> :
                                         <CloudIcon     />
              }
              label={collapsed ? undefined : caps.tier_label}
              size="small"
              sx={{
                bgcolor: caps.tier === "local" ? "rgba(16,185,129,0.20)" :
                         caps.tier === "ec2"   ? "rgba(59,130,246,0.20)" :
                                                 "rgba(255,255,255,0.10)",
                border: `1px solid ${
                  caps.tier === "local" ? "rgba(16,185,129,0.45)" :
                  caps.tier === "ec2"   ? "rgba(59,130,246,0.45)" :
                                         "rgba(255,255,255,0.20)"
                }`,
                fontWeight: 700,
                fontSize: "0.6875rem",
                mr: "0.25rem",
                // Force white-ish text AND icon regardless of MUI internal theme
                color: "#ffffff !important",
                "& .MuiChip-label": { color: "#ffffff", px: collapsed ? 0 : "0.5rem" },
                "& .MuiChip-icon":  { color: "#ffffff", fontSize: "0.875rem", ml: collapsed ? "0.375rem" : "0.25rem" },
                // When label is hidden (icon-only), keep chip compact
                ...(collapsed && { minWidth: 0, width: "2rem", px: 0, justifyContent: "center" }),
              }}
            />

            <Tooltip title="Notificaciones">
              <IconButton
                sx={{ color: "rgba(255,255,255,0.75)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
                  borderRadius: "0.5rem" }}
              >
                <NotificationsNoneIcon sx={{ fontSize: "1.375rem" }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.email ?? "Sin sesión"} placement="bottom">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: "0.3rem" }}>
                <Avatar
                  src={user?.image ?? undefined}
                  sx={{ width: "2.125rem", height: "2.125rem", fontSize: "0.75rem",
                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
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
            mt: HEADER_HEIGHT,
            px: { xs: "1.25rem", sm: "1.5rem", md: "1.75rem" },
            py: "1.75rem",
            bgcolor: "background.default",
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
            <MenuItem key="logout" onClick={handleLogout} sx={{ fontSize: "0.875rem", color: "error.main" }}>
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

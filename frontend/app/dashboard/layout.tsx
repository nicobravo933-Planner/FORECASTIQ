"use client";

/**
 * Dashboard layout — persistent sidebar + topbar.
 * All dashboard routes share this shell.
 */

import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChatIcon from "@mui/icons-material/Chat";
import ScienceIcon from "@mui/icons-material/Science";
import SettingsIcon from "@mui/icons-material/Settings";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import StorageIcon from "@mui/icons-material/Storage";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

const SIDEBAR_WIDTH = "15rem";

const NAV_ITEMS = [
	{ label: "Mis Datasets", href: "/dashboard/datasets", icon: <StorageIcon /> },
	{ label: "Subir CSV",    href: "/dashboard/dataset",  icon: <UploadFileIcon /> },
	{ label: "Forecast",    href: "/dashboard/forecast", icon: <ShowChartIcon /> },
	{
		label: "Calendario",
		href: "/dashboard/calendar",
		icon: <CalendarMonthIcon />,
	},
	{ label: "Chat IA", href: "/dashboard/chat",     icon: <ChatIcon /> },
	{ label: "MLOps",   href: "/dashboard/mlops",    icon: <ScienceIcon /> },
	{ label: "Batch",   href: "/dashboard/batch",    icon: <BarChartIcon /> },
	{ label: "Ajustes", href: "/dashboard/settings", icon: <SettingsIcon /> },
];

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = useSession();
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

	const user = session?.user;
	const initials = user?.name
		? user.name
				.split(" ")
				.map((n: string) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		: "?";

	const handleLogout = async () => {
		setAnchorEl(null);
		await signOut();
		router.push("/login");
	};

	return (
		<Box
			sx={{
				display: "flex",
				minHeight: "100vh",
				bgcolor: "background.default",
			}}
		>
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
				{/* Logo — single source, vertically centered, fixed height */}
				<Box
					sx={{
						px: "1.25rem",
						height: "3.5rem",
						display: "flex",
						alignItems: "center",
						flexShrink: 0,
					}}
				>
					<Image
						src="/logo_rectangular.png"
						alt="forecastiq"
						width={148}
						height={32}
						style={{ objectFit: "contain", objectPosition: "left", maxWidth: "100%" }}
						priority
					/>
				</Box>

				<Divider sx={{ borderColor: "divider" }} />

				{/* Nav */}
				<List sx={{ px: "0.5rem", pt: "0.75rem", flex: 1 }}>
					{NAV_ITEMS.map((item) => {
						// Exact match for dataset routes to avoid overlap between
						// /dashboard/datasets and /dashboard/dataset
						const active =
							item.href === "/dashboard/dataset" || item.href === "/dashboard/datasets"
								? pathname === item.href || pathname.startsWith(item.href + "/")
								: pathname.startsWith(item.href);
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
								<ListItemIcon
									sx={{
										minWidth: "2.25rem",
										color: active ? "primary.light" : "text.secondary",
									}}
								>
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
						);
					})}
				</List>

				<Divider sx={{ borderColor: "divider" }} />
				<Box
					sx={{
						px: "1rem",
						py: "0.875rem",
						display: "flex",
						alignItems: "center",
						gap: "0.75rem",
					}}
				>
					<Tooltip
						title={user ? `${user.email}` : "Sin sesión"}
						placement="top"
					>
						<IconButton
							onClick={(e) => setAnchorEl(e.currentTarget)}
							sx={{ p: 0 }}
						>
							<Avatar
								src={user?.image ?? undefined}
								sx={{
									width: "2rem",
									height: "2rem",
									fontSize: "0.75rem",
									bgcolor: "primary.main",
								}}
							>
								{initials}
							</Avatar>
						</IconButton>
					</Tooltip>
					<Box sx={{ overflow: "hidden" }}>
						<Typography
							variant="caption"
							fontWeight={500}
							noWrap
							display="block"
						>
							{user?.name ?? "Invitado"}
						</Typography>
						<Typography
							variant="caption"
							color="text.disabled"
							noWrap
							display="block"
							sx={{ fontSize: "0.65rem" }}
						>
							{user ? "Ver perfil" : "Sin cuenta"}
						</Typography>
					</Box>
				</Box>

				{/* User menu */}
				<Menu
					anchorEl={anchorEl}
					open={Boolean(anchorEl)}
					onClose={() => setAnchorEl(null)}
					anchorOrigin={{ vertical: "top", horizontal: "right" }}
					transformOrigin={{ vertical: "bottom", horizontal: "right" }}
				>
					{user ? (
						<MenuItem
							onClick={handleLogout}
							sx={{ fontSize: "0.875rem", color: "error.main" }}
						>
							Cerrar sesion
						</MenuItem>
					) : (
						<MenuItem
							component={Link}
							href="/login"
							onClick={() => setAnchorEl(null)}
							sx={{ fontSize: "0.875rem" }}
						>
							Iniciar sesion
						</MenuItem>
					)}
				</Menu>
			</Drawer>

			{/* Main content — full width, no artificial cap */}
			<Box
				component="main"
				sx={{
					flex: 1,
					minWidth: 0,
					overflow: "auto",
					px: { xs: "1rem", sm: "1.5rem", md: "2rem", lg: "2.5rem" },
					py: "2rem",
				}}
			>
				{children}
			</Box>
		</Box>
	);
}

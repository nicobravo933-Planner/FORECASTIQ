"use client"

/**
 * ConversationSidebar — left panel in /dashboard/chat.
 *
 * Shows the list of past conversations, a "New chat" button,
 * and a delete button per conversation item.
 */

import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined"
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import type { ChatConversation } from "@/lib/types"

interface ConversationSidebarProps {
  conversations: ChatConversation[]
  activeId: string | null
  isLoading: boolean
  onSelect: (conversation: ChatConversation) => void
  onNew: () => void
  onDelete: (id: string) => void
}

/** Formats a date string to a relative label: "Hoy", "Ayer", or "dd/mm". */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Hoy"
  if (diffDays === 1) return "Ayer"
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
}

export function ConversationSidebar({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <Box
      sx={{
        width: "15rem",
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: "0.875rem",
          py: "0.625rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          Historial
        </Typography>
        <Tooltip title="Nueva conversación">
          <IconButton size="small" onClick={onNew} sx={{ color: "primary.main" }}>
            <AddCommentOutlinedIcon sx={{ fontSize: "1.125rem" }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider />

      {/* List */}
      <Box sx={{ flex: 1, overflowY: "auto", py: "0.25rem" }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: "1.5rem" }}>
            <CircularProgress size="1.25rem" />
          </Box>
        ) : conversations.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ display: "block", textAlign: "center", color: "text.disabled", pt: "1.5rem", px: "1rem" }}
          >
            Ninguna conversación guardada aún
          </Typography>
        ) : (
          <List dense disablePadding>
            {conversations.map((conv) => {
              const active = conv.id === activeId
              return (
                <Box
                  key={conv.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mx: "0.375rem",
                    mb: "0.125rem",
                    borderRadius: "0.5rem",
                    bgcolor: active ? "rgba(59,130,246,0.08)" : "transparent",
                    "&:hover": { bgcolor: active ? "rgba(59,130,246,0.08)" : "rgba(0,0,0,0.04)" },
                    "&:hover .delete-btn": { opacity: 1 },
                    transition: "background 0.15s",
                  }}
                >
                  <ListItemButton
                    disableRipple
                    onClick={() => onSelect(conv)}
                    sx={{ flex: 1, px: "0.5rem", py: "0.375rem", borderRadius: "0.5rem", "&:hover": { bgcolor: "transparent" } }}
                  >
                    <ListItemIcon sx={{ minWidth: "1.75rem" }}>
                      <ChatBubbleOutlineIcon
                        sx={{ fontSize: "0.875rem", color: active ? "primary.main" : "text.disabled" }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={conv.title}
                      secondary={formatDate(conv.updated_at)}
                      primaryTypographyProps={{
                        fontSize: "0.8125rem",
                        fontWeight: active ? 600 : 400,
                        color: active ? "primary.main" : "text.primary",
                        noWrap: true,
                      }}
                      secondaryTypographyProps={{
                        fontSize: "0.6875rem",
                        color: "text.disabled",
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>

                  {/* Delete button — visible on hover */}
                  <Tooltip title="Borrar conversación">
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(conv.id)
                      }}
                      sx={{
                        opacity: 0,
                        transition: "opacity 0.15s",
                        color: "text.disabled",
                        mr: "0.25rem",
                        flexShrink: 0,
                        "&:hover": { color: "error.main" },
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: "0.875rem" }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )
            })}
          </List>
        )}
      </Box>
    </Box>
  )
}

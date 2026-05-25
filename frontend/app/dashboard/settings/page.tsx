"use client"

/**
 * Settings page — V2
 * Secciones: Cuenta · Servidor · Chat IA · Datos · Zona de peligro
 */

import { useEffect, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import Divider from "@mui/material/Divider"
import InputAdornment from "@mui/material/InputAdornment"
import IconButton from "@mui/material/IconButton"
import Avatar from "@mui/material/Avatar"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogContentText from "@mui/material/DialogContentText"
import DialogActions from "@mui/material/DialogActions"
import VisibilityIcon from "@mui/icons-material/Visibility"
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff"
import LogoutIcon from "@mui/icons-material/Logout"
import ComputerIcon from "@mui/icons-material/Computer"
import DnsIcon from "@mui/icons-material/Dns"
import CloudIcon from "@mui/icons-material/Cloud"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import StorageIcon from "@mui/icons-material/Storage"
import ChatIcon from "@mui/icons-material/Chat"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "@/lib/auth-client"
import { useCapabilities } from "@/hooks/useCapabilities"
import { appStore } from "@/lib/appStore"
import { FREE_MODELS, type LlmModelId } from "@/lib/types"

const LS_MODEL_KEY  = "forecastiq:preferred_model"
const LS_APIKEY_KEY = "forecastiq:openrouter_api_key"

// ── Section header helper ─────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: "0.875rem" }}>
      <CardContent sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            {title}
          </Typography>
        </Box>
        <Divider />
        {children}
      </CardContent>
    </Card>
  )
}

// ── Model chip colors ─────────────────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = {
  moving_average: "#3b82f6",
  holt_winters:   "#0ea5e9",
  sarima:         "#8b5cf6",
  lightgbm:       "#10b981",
}
const MODEL_LABELS: Record<string, string> = {
  moving_average: "MA",
  holt_winters:   "HW",
  sarima:         "SARIMA",
  lightgbm:       "LGB",
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { caps } = useCapabilities()
  const user = session?.user

  // ── LLM prefs ───────────────────────────────────────────────────────────────
  const [preferredModel, setPreferredModel] = useState<LlmModelId>("deepseek/deepseek-v4-flash:free")
  const [apiKey, setApiKey]   = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved]     = useState(false)

  // ── Confirm dialogs ─────────────────────────────────────────────────────────
  const [confirmChat,    setConfirmChat]    = useState(false)
  const [confirmSession, setConfirmSession] = useState(false)
  const [confirmDataset, setConfirmDataset] = useState(false)

  // ── Feedback messages ───────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "info" } | null>(null)

  const showFeedback = (msg: string, type: "success" | "info" = "success") => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  useEffect(() => {
    const storedModel = localStorage.getItem(LS_MODEL_KEY) as LlmModelId | null
    const storedKey   = localStorage.getItem(LS_APIKEY_KEY)
    if (storedModel) setPreferredModel(storedModel)
    if (storedKey)   setApiKey(storedKey)
  }, [])

  const handleSave = () => {
    localStorage.setItem(LS_MODEL_KEY, preferredModel)
    if (apiKey.trim()) {
      localStorage.setItem(LS_APIKEY_KEY, apiKey.trim())
    } else {
      localStorage.removeItem(LS_APIKEY_KEY)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  const handleClearChat = () => {
    // Remove conversation history keys from localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith("fiq_") && k.includes("conv"))
      .forEach(k => localStorage.removeItem(k))
    setConfirmChat(false)
    showFeedback("Historial del chat eliminado.")
  }

  const handleClearDataset = () => {
    appStore.setActiveDataset("", "", "", "")
    appStore.clearQualityScore()
    appStore.clearDetectionReport()
    appStore.clearDetectedModel()
    if (typeof window !== "undefined") {
      localStorage.removeItem("fiq_active_job_id")
    }
    setConfirmDataset(false)
    showFeedback("Dataset y resultados locales eliminados.")
  }

  const handleClearAll = () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith("fiq_") || k.startsWith("forecastiq:"))
      .forEach(k => localStorage.removeItem(k))
    setConfirmSession(false)
    showFeedback("Sesión local limpiada completamente.", "info")
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  const TierIcon = caps.tier === "local" ? ComputerIcon
    : caps.tier === "ec2" ? DnsIcon : CloudIcon

  const tierColor = caps.tier === "local" ? "#10b981"
    : caps.tier === "ec2" ? "#6366f1" : "#9ca3af"

  const modelsAvailable = (caps.models_available as string[] | undefined) ?? []
  const activeDatasetId = appStore.getActiveDatasetId()
  const activeJobId     = appStore.getActiveJobId()

  // ── OAuth provider detection ─────────────────────────────────────────────
  const provider = (user as { provider?: string } | undefined)?.provider
    ?? (user?.email?.endsWith("@gmail.com") ? "google" : null)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Page header */}
      <Box>
        <Typography variant="h5" fontWeight={700} color="text.primary">Ajustes</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
          Preferencias locales · nunca se envían al servidor
        </Typography>
      </Box>

      {/* 2-column grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: "1.5rem", alignItems: "start" }}>

        {/* ── Columna izquierda ── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── 1. CUENTA ──────────────────────────────────────────────────────── */}
      <SectionCard title="Cuenta" icon={<Avatar src={user?.image ?? undefined}
        sx={{ width: "1.375rem", height: "1.375rem", fontSize: "0.625rem",
          background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}>{initials}</Avatar>}>

        <Box sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Avatar grande */}
          <Avatar
            src={user?.image ?? undefined}
            sx={{ width: "3.5rem", height: "3.5rem", fontSize: "1.125rem", flexShrink: 0,
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
          >
            {initials}
          </Avatar>

          {user ? (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={600} sx={{ fontSize: "1rem", color: "text.primary" }}>
                {user.name ?? "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              {provider && (
                <Chip label={`OAuth · ${provider}`} size="small"
                  sx={{ mt: "0.375rem", fontSize: "0.6875rem", height: "1.375rem" }} />
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No hay sesión activa.</Typography>
          )}

          {user && (
            <Tooltip title="Cerrar sesión">
              <Button
                variant="outlined" color="error" size="small" startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ textTransform: "none", borderRadius: "0.5rem", flexShrink: 0 }}
              >
                Salir
              </Button>
            </Tooltip>
          )}
        </Box>
      </SectionCard>

      {/* ── 2. SERVIDOR ────────────────────────────────────────────────────── */}
      <SectionCard title="Servidor" icon={<TierIcon sx={{ fontSize: "1.25rem", color: tierColor }} />}>

        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem",
            px: "0.875rem", py: "0.5rem", borderRadius: "0.625rem",
            bgcolor: `${tierColor}14`, border: "1px solid", borderColor: `${tierColor}30` }}>
            <TierIcon sx={{ fontSize: "1rem", color: tierColor }} />
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: tierColor }}>
              {caps.tier_label}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <CheckCircleIcon sx={{ fontSize: "0.875rem", color: "#10b981" }} />
            <Typography variant="body2" color="text.secondary">
              {modelsAvailable.length || 3} modelos activos
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {(modelsAvailable.length > 0
            ? modelsAvailable
            : ["moving_average", "holt_winters", "sarima"]
          ).map(m => (
            <Chip key={m} label={MODEL_LABELS[m] ?? m} size="small"
              sx={{
                fontSize: "0.75rem", height: "1.5rem",
                bgcolor: `${MODEL_COLORS[m] ?? "#6366f1"}14`,
                color: MODEL_COLORS[m] ?? "#6366f1",
                border: "1px solid", borderColor: `${MODEL_COLORS[m] ?? "#6366f1"}30`,
              }} />
          ))}
        </Box>

        <Typography variant="caption" color="text.disabled">
          El tier se detecta automáticamente desde{" "}
          <code style={{ fontSize: "0.6875rem" }}>GET /api/capabilities</code>.
          Para cambiar el tier, modificá{" "}
          <code style={{ fontSize: "0.6875rem" }}>SERVER_TIER</code> en el backend.
        </Typography>
      </SectionCard>

        </Box>{/* fin col izquierda */}

        {/* ── Columna derecha ── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── 3. CHAT IA ─────────────────────────────────────────────────────── */}
      <SectionCard title="Chat IA" icon={<ChatIcon sx={{ fontSize: "1.25rem" }} />}>

        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Typography variant="body2" fontWeight={500}>Modelo LLM por defecto</Typography>
          <Typography variant="caption" color="text.disabled">
            Podés cambiarlo por sesión desde el chat. Se guarda en este navegador.
          </Typography>
          <TextField select fullWidth size="small" value={preferredModel}
            onChange={(e) => setPreferredModel(e.target.value as LlmModelId)}
            label="Modelo por defecto">
            {FREE_MODELS.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        <Divider />

        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Typography variant="body2" fontWeight={500}>OpenRouter API Key (BYOK)</Typography>
          <Typography variant="caption" color="text.disabled">
            Opcional. Si la cargás, se usa en lugar de la key compartida del servidor.
            Nunca se envía a nuestros servidores.
          </Typography>
          <TextField fullWidth size="small" label="sk-or-..." value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type={showKey ? "text" : "password"} autoComplete="off"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowKey(v => !v)} edge="end">
                    {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }} />
          <Typography variant="caption" color="text.disabled">
            Obtené una key gratuita en{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
              style={{ color: "inherit" }}>openrouter.ai/keys</a>
          </Typography>
        </Box>

        {saved && (
          <Alert severity="success" sx={{ borderRadius: "0.5rem", fontSize: "0.8125rem" }}>
            Preferencias guardadas.
          </Alert>
        )}

        <Button variant="contained" onClick={handleSave}
          sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: "0.5rem", px: "1.5rem" }}>
          Guardar cambios
        </Button>
      </SectionCard>

      {/* ── 4. DATOS LOCALES ───────────────────────────────────────────────── */}
      <SectionCard title="Datos locales" icon={<StorageIcon sx={{ fontSize: "1.25rem" }} />}>

        {/* Dataset activo */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>Dataset activo</Typography>
            <Typography variant="caption" color="text.disabled">
              {activeDatasetId
                ? `ID: ${activeDatasetId.slice(0, 16)}… · ${activeJobId ? `job: ${activeJobId.slice(0, 8)}…` : "sin forecast"}`
                : "No hay dataset activo en esta sesión."}
            </Typography>
          </Box>
          <Button variant="outlined" color="warning" size="small"
            startIcon={<DeleteOutlineIcon />}
            disabled={!activeDatasetId}
            onClick={() => setConfirmDataset(true)}
            sx={{ textTransform: "none", borderRadius: "0.5rem", flexShrink: 0 }}>
            Limpiar
          </Button>
        </Box>

        <Divider />

        {/* Historial chat */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>Historial de conversaciones</Typography>
            <Typography variant="caption" color="text.disabled">
              Elimina el caché local de conversaciones del Chat IA.
            </Typography>
          </Box>
          <Button variant="outlined" color="warning" size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setConfirmChat(true)}
            sx={{ textTransform: "none", borderRadius: "0.5rem", flexShrink: 0 }}>
            Limpiar
          </Button>
        </Box>
      </SectionCard>

      {/* ── 5. ZONA DE PELIGRO ─────────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: "0.875rem", borderColor: "error.light" }}>
        <CardContent sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <WarningAmberIcon sx={{ color: "error.main", fontSize: "1.25rem" }} />
            <Typography variant="subtitle1" fontWeight={700} color="error.main">
              Zona de peligro
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <Box>
              <Typography variant="body2" fontWeight={500}>Limpiar sesión local completa</Typography>
              <Typography variant="caption" color="text.disabled">
                Elimina todo el estado local de ForecastIQ: dataset activo, forecasts, calidad,
                modelo detectado, conversaciones y preferencias. No afecta datos en el servidor.
              </Typography>
            </Box>
            <Button variant="outlined" color="error" size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setConfirmSession(true)}
              sx={{ textTransform: "none", borderRadius: "0.5rem", flexShrink: 0 }}>
              Limpiar todo
            </Button>
          </Box>
        </CardContent>
      </Card>

        </Box>{/* fin col derecha */}
      </Box>{/* fin grid */}

      {/* Feedback global */}
      {feedback && (
        <Alert severity={feedback.type} sx={{ borderRadius: "0.5rem", fontSize: "0.8125rem" }}>
          {feedback.msg}
        </Alert>
      )}

      {/* ── Confirm dialogs ─────────────────────────────────────────────────── */}
      <Dialog open={confirmDataset} onClose={() => setConfirmDataset(false)}>
        <DialogTitle>Limpiar dataset activo</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            Se borrará el dataset activo, el último forecast y el quality score del almacenamiento local.
            Los datos en el servidor no se modifican.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDataset(false)} sx={{ textTransform: "none" }}>Cancelar</Button>
          <Button onClick={handleClearDataset} color="warning" variant="contained"
            sx={{ textTransform: "none" }}>Limpiar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmChat} onClose={() => setConfirmChat(false)}>
        <DialogTitle>Limpiar historial de chat</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            Se eliminará el caché local de conversaciones. Las conversaciones guardadas en el servidor
            no se modifican.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmChat(false)} sx={{ textTransform: "none" }}>Cancelar</Button>
          <Button onClick={handleClearChat} color="warning" variant="contained"
            sx={{ textTransform: "none" }}>Limpiar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmSession} onClose={() => setConfirmSession(false)}>
        <DialogTitle>Limpiar sesión local completa</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            Esta acción borra <strong>todo</strong> el estado local de ForecastIQ.
            Tendrás que volver a configurar tus preferencias. Los datos en el servidor no se modifican.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSession(false)} sx={{ textTransform: "none" }}>Cancelar</Button>
          <Button onClick={handleClearAll} color="error" variant="contained"
            sx={{ textTransform: "none" }}>Limpiar todo</Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}

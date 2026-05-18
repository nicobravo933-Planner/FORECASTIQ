"use client"

/**
 * Settings page — OpenRouter model preference + BYOK API key.
 * Preferences are stored in localStorage (client-side only, never sent to backend).
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
import VisibilityIcon from "@mui/icons-material/Visibility"
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff"
import { useSession } from "@/lib/auth-client"
import { FREE_MODELS, type LlmModelId } from "@/lib/types"

const LS_MODEL_KEY = "forecastiq:preferred_model"
const LS_APIKEY_KEY = "forecastiq:openrouter_api_key"

export default function SettingsPage() {
  const { data: session } = useSession()
  const user = session?.user

  const [preferredModel, setPreferredModel] = useState<LlmModelId>("deepseek/deepseek-v4-flash:free")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const storedModel = localStorage.getItem(LS_MODEL_KEY) as LlmModelId | null
    const storedKey = localStorage.getItem(LS_APIKEY_KEY)
    if (storedModel) setPreferredModel(storedModel)
    if (storedKey) setApiKey(storedKey)
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "36rem" }}>
      <Typography variant="h5" fontWeight={700} color="text.primary">
        Ajustes
      </Typography>

      {/* Account info */}
      <Card variant="outlined" sx={{ borderRadius: "0.75rem" }}>
        <CardContent sx={{ p: "1.5rem" }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            CUENTA
          </Typography>
          {user ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.25rem", mt: "0.5rem" }}>
              <Typography variant="body2" fontWeight={500}>{user.name ?? "—"}</Typography>
              <Typography variant="body2" color="text.secondary">{user.email}</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay sesión activa.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Model preference */}
      <Card variant="outlined" sx={{ borderRadius: "0.75rem" }}>
        <CardContent sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              MODELO LLM PREFERIDO
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Modelo usado por defecto en el Chat IA. Podés cambiarlo por sesión desde el chat.
            </Typography>
          </Box>
          <TextField
            select
            fullWidth
            size="small"
            value={preferredModel}
            onChange={(e) => setPreferredModel(e.target.value as LlmModelId)}
            label="Modelo por defecto"
          >
            {FREE_MODELS.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
        </CardContent>
      </Card>

      {/* BYOK */}
      <Card variant="outlined" sx={{ borderRadius: "0.75rem" }}>
        <CardContent sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              OPENROUTER API KEY (BYOK)
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Opcional. Si la cargás, se usa en lugar de la key compartida del servidor.
              Se guarda solo en este navegador, nunca se envía a nuestros servidores.
            </Typography>
          </Box>
          <TextField
            fullWidth
            size="small"
            label="sk-or-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type={showKey ? "text" : "password"}
            autoComplete="off"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowKey((v) => !v)} edge="end">
                    {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" color="text.disabled">
            Obtené una key gratuita en{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
              style={{ color: "inherit" }}>
              openrouter.ai/keys
            </a>
          </Typography>
        </CardContent>
      </Card>

      <Divider />

      {saved && (
        <Alert severity="success" sx={{ borderRadius: "0.5rem" }}>
          Preferencias guardadas correctamente.
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleSave}
        sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: "0.5rem", px: "1.5rem" }}
      >
        Guardar cambios
      </Button>
    </Box>
  )
}

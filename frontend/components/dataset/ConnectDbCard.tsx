"use client"

/**
 * ConnectDbCard — formulario de conexión efímera a base de datos.
 *
 * Soporta: PostgreSQL, MySQL, SQLite (local si el backend es local), MS SQL Server.
 * La connection string NUNCA se guarda — el backend ejecuta el SELECT y descarta la conexión.
 *
 * Flujo:
 *   1. Usuario elige motor + completa host/puerto/usuario/contraseña/nombre DB
 *   2. O pega directamente la connection string completa
 *   3. Escribe la query SELECT
 *   4. El backend retorna el resultado como si fuera un CSV uploadado → dataset_id
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Chip from "@mui/material/Chip"
import Alert from "@mui/material/Alert"
import Collapse from "@mui/material/Collapse"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import CircularProgress from "@mui/material/CircularProgress"
import ShieldIcon from "@mui/icons-material/Shield"
import StorageRoundedIcon from "@mui/icons-material/StorageRounded"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import VisibilityIcon from "@mui/icons-material/Visibility"
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff"
import LinkIcon from "@mui/icons-material/Link"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"

type DbEngine = "postgresql" | "mysql" | "sqlite" | "mssql"

const ENGINES: { value: DbEngine; label: string; defaultPort: string }[] = [
  { value: "postgresql", label: "PostgreSQL",      defaultPort: "5432"  },
  { value: "mysql",      label: "MySQL / MariaDB", defaultPort: "3306"  },
  { value: "sqlite",     label: "SQLite (archivo local)", defaultPort: "" },
  { value: "mssql",      label: "SQL Server",      defaultPort: "1433"  },
]

const DEFAULT_QUERY = "SELECT * FROM tu_tabla LIMIT 10000"

interface DbConnectResponse {
  dataset_id: string
  rows: number
  columns: string[]
}

export function ConnectDbCard() {
  const [engine, setEngine]   = useState<DbEngine>("postgresql")
  const [mode, setMode]       = useState<"form" | "string">("form")
  const [showPwd, setShowPwd] = useState(false)

  // Form fields
  const [host, setHost]         = useState("localhost")
  const [port, setPort]         = useState("5432")
  const [user, setUser]         = useState("")
  const [password, setPassword] = useState("")
  const [dbName, setDbName]     = useState("")
  const [connStr, setConnStr]   = useState("")
  const [query, setQuery]       = useState(DEFAULT_QUERY)
  const [sqliteFile, setSqliteFile] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedEngine = ENGINES.find((e) => e.value === engine)!
  const isSqlite       = engine === "sqlite"

  const handleEngineChange = (v: DbEngine) => {
    setEngine(v)
    const eng = ENGINES.find((e) => e.value === v)!
    setPort(eng.defaultPort)
    setError(null)
    setSuccess(null)
  }

  const handleConnect = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    // Build connection string for the backend
    let connectionString = connStr
    if (mode === "form") {
      if (isSqlite) {
        connectionString = `sqlite:///${sqliteFile || ":memory:"}`
      } else {
        const safeUser = encodeURIComponent(user)
        const safePwd  = encodeURIComponent(password)
        const driver   = engine === "mssql" ? "mssql+pyodbc" : engine === "mysql" ? "mysql+pymysql" : "postgresql+psycopg2"
        connectionString = `${driver}://${safeUser}:${safePwd}@${host}:${port}/${dbName}`
      }
    }

    try {
      const result = await api.post<DbConnectResponse>("/api/datasets/connect-db", {
        connection_string: connectionString,
        query,
        engine,
      })
      // Guardar connection string en localStorage para el Data Explorer
      try {
        localStorage.setItem("fiq_db_connection", JSON.stringify({
          connection_string: connectionString,
          engine,
        }))
      } catch { /* storage full */ }
      appStore.setActiveDataset(result.dataset_id, "", "", "M")
      setSuccess(
        `✅ Conexión exitosa — ${result.rows.toLocaleString("es-AR")} filas · ${result.columns.length} columnas. Ahora podés ir a Forecast o explorar el esquema.`
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al conectar la base de datos.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <StorageRoundedIcon sx={{ color: "primary.main", fontSize: "1.375rem" }} />
        <Box>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Conectar base de datos
          </Typography>
          <Typography variant="caption" color="text.secondary">
            La conexión se usa para una única query SELECT y se descarta inmediatamente.
          </Typography>
        </Box>
      </Box>

      {/* Engine selector */}
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {ENGINES.map((eng) => (
          <Chip
            key={eng.value}
            label={eng.label}
            onClick={() => handleEngineChange(eng.value)}
            variant={engine === eng.value ? "filled" : "outlined"}
            sx={{
              cursor: "pointer",
              bgcolor: engine === eng.value ? "primary.main" : "transparent",
              color: engine === eng.value ? "#ffffff" : "text.secondary",
              borderColor: engine === eng.value ? "primary.main" : "divider",
              fontWeight: engine === eng.value ? 600 : 400,
              fontSize: "0.8125rem",
              "&:hover": { bgcolor: engine === eng.value ? "primary.dark" : "action.hover" },
              "& .MuiChip-label": { color: engine === eng.value ? "#ffffff" : undefined },
            }}
          />
        ))}
      </Box>

      {/* Mode toggle */}
      <Box sx={{ display: "flex", gap: "0.5rem" }}>
        {(["form", "string"] as const).map((m) => (
          <Button
            key={m}
            size="small"
            variant={mode === m ? "contained" : "outlined"}
            onClick={() => setMode(m)}
            startIcon={m === "string" ? <LinkIcon /> : undefined}
            sx={{ textTransform: "none", fontSize: "0.8125rem" }}
          >
            {m === "form" ? "Formulario" : "Connection string"}
          </Button>
        ))}
      </Box>

      {/* Form mode */}
      {mode === "form" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {isSqlite ? (
            <TextField
              label="Ruta al archivo .db / .sqlite"
              placeholder="/home/nico/ventas.db  o  C:\Users\nico\db.sqlite"
              value={sqliteFile}
              onChange={(e) => setSqliteFile(e.target.value)}
              size="small"
              fullWidth
            />
          ) : (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem" }}>
                <TextField
                  label="Host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Puerto"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  size="small"
                  sx={{ width: "6rem" }}
                />
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <TextField
                  label="Usuario"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  size="small"
                  autoComplete="username"
                />
                <TextField
                  label="Contraseña"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  size="small"
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <Tooltip title={showPwd ? "Ocultar" : "Mostrar"}>
                        <IconButton size="small" onClick={() => setShowPwd((v) => !v)}>
                          {showPwd
                            ? <VisibilityOffIcon sx={{ fontSize: "1rem" }} />
                            : <VisibilityIcon sx={{ fontSize: "1rem" }} />}
                        </IconButton>
                      </Tooltip>
                    ),
                  }}
                />
              </Box>
              <TextField
                label="Nombre de la base de datos"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                size="small"
                fullWidth
                placeholder="forecastiq_db"
              />
            </>
          )}
        </Box>
      )}

      {/* Connection string mode */}
      {mode === "string" && (
        <TextField
          label="Connection string"
          value={connStr}
          onChange={(e) => setConnStr(e.target.value)}
          size="small"
          fullWidth
          placeholder="postgresql://user:password@host:5432/dbname"
          helperText="Formatos: postgresql://, mysql+pymysql://, sqlite:///ruta, mssql+pyodbc://"
        />
      )}

      {/* SQL Query */}
      <TextField
        label="Query SQL (solo SELECT)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        multiline
        minRows={3}
        maxRows={8}
        fullWidth
        size="small"
        placeholder="SELECT fecha, sku_id, ventas FROM ventas_2024 WHERE canal = 'online' LIMIT 50000"
        helperText="Solo se aceptan queries de lectura — no DDL ni DML."
        sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "0.8125rem" } }}
      />

      {/* Security note */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          bgcolor: "background.default",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "0.5rem",
          px: "0.875rem",
          py: "0.625rem",
        }}
      >
        <ShieldIcon sx={{ fontSize: "0.875rem", color: "success.main", mt: "0.1rem", flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          <strong>Seguridad:</strong> la connection string nunca se guarda en Supabase, nunca
          aparece en logs de OTel ni en Sentry. Se crea en memoria, ejecuta el SELECT, y se
          descarta con <code>engine.dispose()</code>. Solo se procesan queries de lectura.
        </Typography>
      </Box>

      {/* Feedback */}
      <Collapse in={!!error}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Collapse>
      <Collapse in={!!success}>
        <Alert
          severity="success"
          onClose={() => setSuccess(null)}
          action={
            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <Button size="small" href="/dashboard/explorer?source=db" sx={{ textTransform: "none" }}>
                Explorar esquema
              </Button>
              <Button size="small" href="/dashboard/forecast" sx={{ textTransform: "none" }}>
                Ir a Forecast →
              </Button>
            </Box>
          }
        >
          {success}
        </Alert>
      </Collapse>

      {/* Connect button */}
      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
        onClick={handleConnect}
        disabled={loading}
        sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 600 }}
      >
        {loading ? "Conectando..." : "Ejecutar query"}
      </Button>
    </Box>
  )
}

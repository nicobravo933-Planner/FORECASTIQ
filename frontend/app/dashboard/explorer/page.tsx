"use client"

/**
 * /dashboard/explorer — Data Explorer profesional
 *
 * Panel izquierdo: filtros de fuente (demo/csv/db) + árbol de esquemas DB
 * Panel derecho:   tabla paginada + búsqueda de registros + diagrama de relaciones FK
 */

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Paper from "@mui/material/Paper"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import TablePagination from "@mui/material/TablePagination"
import Chip from "@mui/material/Chip"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import Skeleton from "@mui/material/Skeleton"
import Divider from "@mui/material/Divider"
import Tooltip from "@mui/material/Tooltip"
import IconButton from "@mui/material/IconButton"
import TextField from "@mui/material/TextField"
import InputAdornment from "@mui/material/InputAdornment"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import LinearProgress from "@mui/material/LinearProgress"
import Collapse from "@mui/material/Collapse"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import ListItemIcon from "@mui/material/ListItemIcon"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import TableChartIcon from "@mui/icons-material/TableChart"
import SchemaIcon from "@mui/icons-material/Schema"
import KeyIcon from "@mui/icons-material/Key"
import LinkIcon from "@mui/icons-material/Link"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import RefreshIcon from "@mui/icons-material/Refresh"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import StorageIcon from "@mui/icons-material/Storage"
import SearchIcon from "@mui/icons-material/Search"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import ClearIcon from "@mui/icons-material/Clear"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ColumnMeta {
  name: string; type: string; nullable: boolean
  is_pk: boolean; is_fk: boolean; fk_ref: string | null
}
interface TableMeta {
  schema_name: string; table_name: string
  row_count: number | null; columns: ColumnMeta[]
}
interface SchemaResponse { engine: string; schemas: string[]; tables: TableMeta[] }
interface PageResponse {
  total_rows: number; page: number; page_size: number; pages: number
  columns: string[]; rows: Record<string, string>[]
}

function getStoredConnection(): { connection_string: string; engine: string } | null {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem("fiq_db_connection")
    return v ? JSON.parse(v) : null
  } catch { return null }
}

function fmtRows(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toString()
}

const DTYPE_COLOR: Record<string, string> = {
  datetime: "#6366f1", timestamp: "#6366f1",
  numeric: "#22c55e", integer: "#22c55e", float: "#22c55e", int: "#22c55e", bigint: "#22c55e", serial: "#22c55e",
  varchar: "#f59e0b", text: "#f59e0b", char: "#f59e0b",
  boolean: "#06b6d4", uuid: "#ec4899", json: "#a78bfa",
}
function typeColor(t: string): string {
  const lower = t.toLowerCase()
  for (const [k, v] of Object.entries(DTYPE_COLOR)) if (lower.includes(k)) return v
  return "#9ca3af"
}

// ── Diagrama SVG ──────────────────────────────────────────────────────────────

function RelationDiagram({ tables, focusTable }: { tables: TableMeta[]; focusTable: TableMeta | null }) {
  if (!focusTable) return (
    <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:"0.75rem" }}>
      <AccountTreeIcon sx={{ fontSize:"3rem", color:"text.disabled" }} />
      <Typography variant="body2" color="text.secondary">Elegí una tabla para ver su diagrama de relaciones</Typography>
    </Box>
  )

  const relatedNames = new Set<string>()
  focusTable.columns.filter(c => c.is_fk && c.fk_ref).forEach(c => {
    const p = c.fk_ref!.split("."); if (p.length >= 2) relatedNames.add(p[p.length - 2])
  })
  tables.forEach(t => {
    if (t.table_name === focusTable.table_name) return
    t.columns.filter(c => c.is_fk && c.fk_ref).forEach(c => {
      const p = c.fk_ref!.split(".")
      if (p[p.length - 2] === focusTable.table_name) relatedNames.add(t.table_name)
    })
  })

  const related = tables.filter(t => relatedNames.has(t.table_name))
  const W=560, H=400, CX=W/2, CY=H/2, BW=160, BHB=24, RH=18, R=160
  const pos: Record<string, {x:number;y:number;h:number}> = {}
  const fh = BHB + focusTable.columns.length * RH
  pos[focusTable.table_name] = { x: CX-BW/2, y: CY-fh/2, h: fh }
  related.forEach((t, i) => {
    const angle = 2*Math.PI*i/related.length - Math.PI/2
    const th = BHB + Math.min(t.columns.length, 5)*RH
    pos[t.table_name] = { x: CX + R*Math.cos(angle) - BW/2, y: CY + R*Math.sin(angle) - th/2, h: th }
  })
  const lines: {x1:number;y1:number;x2:number;y2:number}[] = []
  focusTable.columns.filter(c => c.is_fk && c.fk_ref).forEach(c => {
    const ref = c.fk_ref!.split("."); const refT = ref[ref.length-2]; const p2 = pos[refT]; if (!p2) return
    const fp = pos[focusTable.table_name]
    lines.push({ x1: fp.x+BW, y1: fp.y+fp.h/2, x2: p2.x, y2: p2.y+p2.h/2 })
  })
  related.forEach(t => {
    t.columns.filter(c => c.is_fk && c.fk_ref).forEach(c => {
      const ref = c.fk_ref!.split("."); if (ref[ref.length-2] !== focusTable.table_name) return
      const p2 = pos[t.table_name]; const fp = pos[focusTable.table_name]
      lines.push({ x1: p2.x+BW, y1: p2.y+p2.h/2, x2: fp.x, y2: fp.y+fp.h/2 })
    })
  })

  return (
    <Box sx={{ overflow:"auto", flex:1 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6366f1"/></marker></defs>
        {lines.map((l,i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arr)" opacity={0.7}/>)}
        {[focusTable, ...related].map(t => {
          const p = pos[t.table_name]; if (!p) return null
          const isF = t.table_name === focusTable.table_name
          const cols = isF ? t.columns : t.columns.slice(0,5)
          return (
            <g key={t.table_name}>
              <rect x={p.x} y={p.y} width={BW} height={p.h} rx={6} fill={isF?"#1e3a6e":"#1a1f2e"} stroke={isF?"#6366f1":"#374151"} strokeWidth={isF?2:1}/>
              <rect x={p.x} y={p.y} width={BW} height={BHB} rx={6} fill={isF?"#6366f1":"#374151"}/>
              <rect x={p.x} y={p.y+6} width={BW} height={BHB-6} fill={isF?"#6366f1":"#374151"}/>
              <text x={p.x+BW/2} y={p.y+16} textAnchor="middle" fill="white" fontSize={11} fontWeight={700}>{t.table_name}</text>
              {cols.map((c,ci) => (
                <g key={c.name}>
                  <text x={p.x+8} y={p.y+BHB+ci*RH+13} fill={c.is_pk?"#fbbf24":c.is_fk?"#818cf8":"#9ca3af"} fontSize={10}>
                    {c.is_pk?"🔑 ":c.is_fk?"🔗 ":"   "}{c.name}
                  </text>
                  <text x={p.x+BW-6} y={p.y+BHB+ci*RH+13} textAnchor="end" fill={typeColor(c.type)} fontSize={9} opacity={0.8}>
                    {c.type.split("(")[0].toUpperCase()}
                  </text>
                </g>
              ))}
              {!isF && t.columns.length > 5 && <text x={p.x+BW/2} y={p.y+BHB+5*RH+13} textAnchor="middle" fill="#6b7280" fontSize={9}>+{t.columns.length-5} más…</text>}
            </g>
          )
        })}
      </svg>
      {relatedNames.size === 0 && <Typography variant="caption" color="text.disabled" sx={{display:"block",mt:"0.5rem",textAlign:"center"}}>Sin relaciones FK definidas.</Typography>}
    </Box>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

function ExplorerPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const source    = searchParams.get("source") ?? "demo"
  const datasetId = searchParams.get("dsId") ?? ""

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pageData, setPageData] = useState<PageResponse | null>(null)
  const [page, setPage]         = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [rightTab, setRightTab] = useState(0)

  const [searchText, setSearchText]     = useState("")
  const [searchColumn, setSearchColumn] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [demoCategoria, setDemoCategoria] = useState("Electrónica")
  const [demoSkuId, setDemoSkuId]         = useState("")

  const [schema, setSchema]               = useState<SchemaResponse | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableMeta | null>(null)
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [tableSearch, setTableSearch]     = useState("")
  const [colSearch, setColSearch]         = useState("")
  const conn = getStoredConnection()

  // Función de carga — recibe todos los parámetros explícitamente, sin closure
  async function doLoad(
    p: number, rpp: number,
    cat: string, skuFilter: string,
    sText: string, sCol: string,
    table: TableMeta | null,
  ) {
    setLoading(true); setError(null)
    try {
      let data: PageResponse
      if (source === "demo") {
        const params = new URLSearchParams({ categoria: cat, page: String(p + 1), page_size: String(rpp) })
        if (skuFilter) params.set("sku_id", skuFilter)
        data = await api.get<PageResponse>(`/api/datasets/explore/demo?${params}`)
      } else if (source === "csv" && datasetId) {
        data = await api.get<PageResponse>(`/api/datasets/${datasetId}/page?page=${p + 1}&page_size=${rpp}`)
      } else if (source === "db" && conn && table) {
        data = await api.post<PageResponse>("/api/datasets/explore/db/query", {
          connection_string: conn.connection_string,
          schema_name: table.schema_name, table_name: table.table_name,
          page: p + 1, page_size: rpp, search_text: sText, search_column: sCol,
        })
      } else { setLoading(false); return }
      setPageData(data)
      if (!sCol && data.columns.length > 0) setSearchColumn(data.columns[0])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar datos.")
    } finally { setLoading(false) }
  }

  // Wrappers convenientes
  const loadPage  = (p: number, rpp: number) =>
    doLoad(p, rpp, demoCategoria, demoSkuId, searchText, searchColumn, selectedTable)
  const loadFresh = (cat: string, sku: string) => {
    setPage(0); setSearchText("")
    doLoad(0, rowsPerPage, cat, sku, "", "", selectedTable)
  }
  const loadTable = (t: TableMeta) => {
    setSelectedTable(t); setPage(0); setSearchText("")
    const col = t.columns[0]?.name ?? ""
    setSearchColumn(col)
    doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", col, t)
  }

  // Carga inicial — CSV y demo se cargan solos; DB espera que el usuario elija tabla
  const didMount = useRef(false)
  useEffect(() => {
    if (didMount.current) return
    didMount.current = true
    if (source !== "db") {
      doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", "", null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar schema DB al entrar en ese modo
  useEffect(() => {
    if (source === "db" && !schema && conn) {
      setLoadingSchema(true)
      api.post<SchemaResponse>("/api/datasets/explore/db/schema", {
        connection_string: conn.connection_string, engine: conn.engine,
      }).then(d => {
        setSchema(d)
        if (d.schemas.length > 0) setExpandedSchemas(new Set([d.schemas[0]]))
      }).catch(e => setError(e instanceof ApiError ? e.message : "Error al introspeccionar DB."))
       .finally(() => setLoadingSchema(false))
    }
  }, [source]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = (val: string) => {
    setSearchText(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setPage(0)
      doLoad(0, rowsPerPage, demoCategoria, demoSkuId, val, searchColumn, selectedTable)
    }, 500)
  }

  const handleUseForecast = () => {
    if (source === "csv" && datasetId) { appStore.setActiveDataset(datasetId, "", "", "M"); router.push("/dashboard/forecast") }
    else if (source === "demo") router.push("/dashboard/dataset?tab=2")
  }

  const filteredTables = schema?.tables.filter(t => !tableSearch || t.table_name.toLowerCase().includes(tableSearch.toLowerCase())) ?? []

  // ── Panel izquierdo ──────────────────────────────────────────────────────

  const renderLeft = () => {
    if (source === "demo") return (
      <Box sx={{ display:"flex", flexDirection:"column", gap:"0.875rem" }}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Filtros</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Categoría</InputLabel>
          <Select value={demoCategoria} label="Categoría" onChange={(e) => {
            setDemoCategoria(e.target.value); loadFresh(e.target.value, demoSkuId)
          }}>
            {["Electrónica","Alimentos","Indumentaria","Hogar","Deportes"].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="SKU ID (opcional)" value={demoSkuId}
          onChange={(e) => setDemoSkuId(e.target.value)} placeholder="SKU-00001" fullWidth />
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />}
          onClick={() => loadFresh(demoCategoria, demoSkuId)} sx={{ textTransform:"none" }}>
          Aplicar filtros
        </Button>
        <Divider />
        <Typography variant="caption" color="text.disabled">
          Columnas: fecha · sku_id · categoria · ventas · precio · stock · cluster_abc · cluster_xyz
        </Typography>
      </Box>
    )

    if (source === "csv") return (
      <Box sx={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Dataset CSV</Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily:"monospace", wordBreak:"break-all", fontSize:"0.6875rem" }}>
          {datasetId}
        </Typography>
        <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={handleUseForecast} sx={{ textTransform:"none", fontWeight:600 }}>
          Usar en Forecast →
        </Button>
        {pageData && <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Columnas ({pageData.columns.length})</Typography>
          {pageData.columns.map(col => (
            <Box key={col} sx={{ px:"0.5rem", py:"0.125rem", bgcolor:"action.hover", borderRadius:"0.25rem" }}>
              <Typography variant="caption" color="text.primary">{col}</Typography>
            </Box>
          ))}
        </>}
      </Box>
    )

    if (source === "db") return (
      <Box sx={{ display:"flex", flexDirection:"column", gap:"0.5rem", height:"100%", overflow:"hidden" }}>
        <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
            {schema ? `${schema.engine} · ${schema.tables.length} tablas` : "Esquemas"}
          </Typography>
          <IconButton size="small" onClick={() => {
            setSchema(null)
            setLoadingSchema(true)
            api.post<SchemaResponse>("/api/datasets/explore/db/schema", { connection_string: conn!.connection_string, engine: conn!.engine })
              .then(d => { setSchema(d); if (d.schemas.length > 0) setExpandedSchemas(new Set([d.schemas[0]])) })
              .catch(e => setError(e instanceof ApiError ? e.message : "Error"))
              .finally(() => setLoadingSchema(false))
          }} disabled={loadingSchema || !conn}>
            <RefreshIcon sx={{ fontSize:"0.875rem" }} />
          </IconButton>
        </Box>
        {loadingSchema && <LinearProgress sx={{ borderRadius:"0.25rem", flexShrink:0 }} />}
        {!conn && <Alert severity="warning" sx={{ fontSize:"0.75rem", flexShrink:0 }}>
          Sin conexión. <Button variant="text" size="small" href="/dashboard/dataset?tab=1" sx={{ textTransform:"none", p:0, fontSize:"0.75rem" }}>Conectar →</Button>
        </Alert>}
        {schema && <TextField size="small" placeholder="Buscar tabla…" value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)} sx={{ flexShrink:0 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:"0.875rem" }}/></InputAdornment>,
            endAdornment: tableSearch ? <InputAdornment position="end"><IconButton size="small" onClick={() => setTableSearch("")}><ClearIcon sx={{ fontSize:"0.75rem" }}/></IconButton></InputAdornment> : undefined,
          }}/>}
        <Box sx={{ flex:1, overflow:"auto" }}>
          {schema && <List dense disablePadding>
            {schema.schemas.map(s => {
              const sTables = filteredTables.filter(t => t.schema_name === s)
              if (sTables.length === 0 && tableSearch) return null
              const expanded = expandedSchemas.has(s)
              return (
                <Box key={s}>
                  <ListItemButton dense onClick={() => setExpandedSchemas(prev => { const n = new Set(prev); expanded ? n.delete(s) : n.add(s); return n })} sx={{ borderRadius:"0.375rem", px:"0.375rem" }}>
                    <ListItemIcon sx={{ minWidth:"1.25rem" }}><SchemaIcon sx={{ fontSize:"0.8125rem", color:"primary.light" }}/></ListItemIcon>
                    <ListItemText primary={s} secondary={`${sTables.length} tablas`} primaryTypographyProps={{ fontSize:"0.8125rem", fontWeight:600 }} secondaryTypographyProps={{ fontSize:"0.625rem" }}/>
                    {expanded ? <ExpandLessIcon sx={{ fontSize:"0.875rem" }}/> : <ExpandMoreIcon sx={{ fontSize:"0.875rem" }}/>}
                  </ListItemButton>
                  <Collapse in={expanded || !!tableSearch}>
                    <List dense disablePadding sx={{ pl:"1rem" }}>
                      {sTables.map(t => (
                        <ListItemButton key={t.table_name} dense selected={selectedTable?.table_name === t.table_name && selectedTable?.schema_name === s}
                          onClick={() => loadTable(t)} sx={{ borderRadius:"0.375rem", px:"0.375rem" }}>
                          <ListItemIcon sx={{ minWidth:"1.25rem" }}><TableChartIcon sx={{ fontSize:"0.75rem", color:"text.disabled" }}/></ListItemIcon>
                          <ListItemText primary={t.table_name} secondary={t.row_count != null ? fmtRows(t.row_count) : undefined}
                            primaryTypographyProps={{ fontSize:"0.75rem" }} secondaryTypographyProps={{ fontSize:"0.625rem" }}/>
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              )
            })}
          </List>}
        </Box>
        {selectedTable && <>
          <Divider sx={{ flexShrink:0 }}/>
          <Box sx={{ flexShrink:0 }}>
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb:"0.375rem" }}>
              {selectedTable.schema_name}.{selectedTable.table_name}
              <Typography component="span" variant="caption" color="text.disabled" sx={{ ml:"0.375rem" }}>({selectedTable.columns.length} cols)</Typography>
            </Typography>
            <TextField size="small" placeholder="Buscar columna…" value={colSearch} onChange={(e) => setColSearch(e.target.value)} fullWidth sx={{ mb:"0.375rem" }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:"0.75rem" }}/></InputAdornment>,
                endAdornment: colSearch ? <InputAdornment position="end"><IconButton size="small" onClick={() => setColSearch("")}><ClearIcon sx={{ fontSize:"0.625rem" }}/></IconButton></InputAdornment> : undefined,
                sx: { fontSize:"0.75rem" },
              }}/>
          </Box>
          <Box sx={{ flex:"0 0 auto", maxHeight:"14rem", overflow:"auto" }}>
            {selectedTable.columns.filter(c => !colSearch || c.name.toLowerCase().includes(colSearch.toLowerCase())).map(col => (
              <Box key={col.name} onClick={() => setSearchColumn(col.name)}
                sx={{ display:"flex", alignItems:"center", gap:"0.25rem", py:"0.125rem", px:"0.25rem",
                  bgcolor: col.name === searchColumn ? "action.selected" : "transparent",
                  borderRadius:"0.25rem", cursor:"pointer", "&:hover": { bgcolor:"action.hover" } }}>
                {col.is_pk && <Tooltip title="Primary Key" placement="right"><KeyIcon sx={{ fontSize:"0.625rem", color:"#fbbf24", flexShrink:0 }}/></Tooltip>}
                {col.is_fk && <Tooltip title={`FK → ${col.fk_ref}`} placement="right"><LinkIcon sx={{ fontSize:"0.625rem", color:"#818cf8", flexShrink:0 }}/></Tooltip>}
                <Typography variant="caption" sx={{ flex:1, fontSize:"0.6875rem" }}>{col.name}</Typography>
                <Chip label={col.type.split("(")[0]} size="small"
                  sx={{ height:"0.875rem", fontSize:"0.5rem", px:"0.125rem", color:typeColor(col.type), bgcolor:typeColor(col.type)+"22", border:"none" }}/>
              </Box>
            ))}
          </Box>
        </>}
      </Box>
    )
    return null
  }

  const showDiagram = source === "db" && !!schema

  return (
    <Box sx={{ display:"flex", flexDirection:"column", gap:"1rem", height:"calc(100vh - 7rem)", overflow:"hidden" }}>

      {/* Header */}
      <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.75rem", flexShrink:0 }}>
        <Box sx={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
          {source === "demo" ? <AutoGraphIcon sx={{ color:"primary.main", fontSize:"1.5rem" }}/>
            : source === "db" ? <SchemaIcon sx={{ color:"primary.main", fontSize:"1.5rem" }}/>
            : <StorageIcon sx={{ color:"primary.main", fontSize:"1.5rem" }}/>}
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {source === "demo" ? "Dataset demo — Ventas retail 25k SKUs"
                : source === "db" ? "Explorador de base de datos"
                : "Explorador de dataset"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {source === "demo" ? "DuckDB sobre Parquet · solo lectura"
                : source === "db" ? `${conn?.engine ?? "PostgreSQL"} · conexión efímera · solo lectura`
                : `CSV · ${datasetId.slice(0,8)}…`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display:"flex", gap:"0.5rem" }}>
          {(source === "csv" || source === "demo") && (
            <Button variant="contained" size="small" startIcon={<PlayArrowIcon />} onClick={handleUseForecast} sx={{ textTransform:"none", fontWeight:600 }}>
              Usar en Forecast
            </Button>
          )}
          <Button variant="outlined" size="small" onClick={() => router.back()} sx={{ textTransform:"none" }}>← Volver</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ flexShrink:0 }}>{error}</Alert>}

      {/* Body */}
      <Box sx={{ display:"flex", gap:"1rem", flex:1, minHeight:0 }}>
        <Paper variant="outlined" sx={{ width:"17rem", flexShrink:0, p:"0.875rem", overflow:"hidden", display:"flex", flexDirection:"column", borderRadius:"0.75rem" }}>
          {renderLeft()}
        </Paper>

        <Box sx={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"0.5rem" }}>
          {showDiagram && (
            <Tabs value={rightTab} onChange={(_, v) => setRightTab(v)}
              sx={{ flexShrink:0, minHeight:"2.25rem", borderBottom:"1px solid", borderColor:"divider",
                "& .MuiTab-root": { textTransform:"none", minHeight:"2.25rem", fontSize:"0.8125rem" } }}>
              <Tab label="Tabla" />
              <Tab icon={<AccountTreeIcon sx={{ fontSize:"0.875rem" }}/>} iconPosition="start" label="Diagrama de relaciones" />
            </Tabs>
          )}

          {rightTab === 0 && <>
            {/* Búsqueda de registros (solo DB) */}
            {pageData && source === "db" && selectedTable && (
              <Box sx={{ display:"flex", gap:"0.5rem", alignItems:"center", flexShrink:0 }}>
                <FormControl size="small" sx={{ width:"12rem" }}>
                  <InputLabel>Columna</InputLabel>
                  <Select value={searchColumn} label="Columna" onChange={(e) => {
                    setSearchColumn(e.target.value)
                    if (searchText) { setPage(0); doLoad(0, rowsPerPage, demoCategoria, demoSkuId, searchText, e.target.value, selectedTable) }
                  }}>
                    {pageData.columns.map(c => <MenuItem key={c} value={c} sx={{ fontSize:"0.8125rem" }}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" placeholder="Buscar registros (ILIKE)…" value={searchText} onChange={(e) => handleSearchChange(e.target.value)} sx={{ flex:1 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:"0.875rem" }}/></InputAdornment>,
                    endAdornment: searchText ? <InputAdornment position="end"><IconButton size="small" onClick={() => { setSearchText(""); setPage(0); doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", searchColumn, selectedTable) }}><ClearIcon sx={{ fontSize:"0.75rem" }}/></IconButton></InputAdornment> : undefined,
                  }}/>
                {searchText && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace:"nowrap" }}>{pageData.total_rows.toLocaleString("es-AR")} resultados</Typography>}
              </Box>
            )}

            {/* Info bar */}
            {pageData && (
              <Box sx={{ display:"flex", alignItems:"center", gap:"0.75rem", flexShrink:0 }}>
                <Typography variant="caption" color="text.disabled">
                  {pageData.total_rows.toLocaleString("es-AR")} filas · {pageData.columns.length} columnas
                </Typography>
                <IconButton size="small" onClick={() => loadPage(page, rowsPerPage)} disabled={loading}>
                  <RefreshIcon sx={{ fontSize:"0.875rem" }}/>
                </IconButton>
                {loading && <LinearProgress sx={{ flex:1, height:"0.25rem", borderRadius:"0.125rem" }}/>}
              </Box>
            )}

            {loading && !pageData && (
              <Paper variant="outlined" sx={{ flex:1, p:"1rem", borderRadius:"0.75rem" }}>
                {[...Array(8)].map((_, i) => <Skeleton key={i} variant="text" width={`${55+(i*7)%35}%`} sx={{ mb:"0.5rem" }}/>)}
              </Paper>
            )}

            {source === "db" && !selectedTable && !loading && (
              <Paper variant="outlined" sx={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.75rem", borderRadius:"0.75rem", borderStyle:"dashed" }}>
                <TableChartIcon sx={{ fontSize:"3rem", color:"text.disabled" }}/>
                <Typography variant="body2" color="text.secondary">Elegí una tabla del panel izquierdo para explorarla</Typography>
              </Paper>
            )}

            {pageData && pageData.rows.length > 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ flex:1, overflow:"auto", borderRadius:"0.75rem" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {pageData.columns.map(col => {
                        const meta = selectedTable?.columns.find(c => c.name === col)
                        return (
                          <TableCell key={col} onClick={() => { setSearchColumn(col); if (searchText) doLoad(0, rowsPerPage, demoCategoria, demoSkuId, searchText, col, selectedTable) }}
                            sx={{ bgcolor:"background.default", whiteSpace:"nowrap", py:"0.625rem", fontSize:"0.75rem", fontWeight:600, color:"text.secondary", cursor:"pointer", "&:hover": { color:"primary.light" } }}>
                            <Box sx={{ display:"flex", alignItems:"center", gap:"0.25rem" }}>
                              {meta?.is_pk && <KeyIcon sx={{ fontSize:"0.625rem", color:"#fbbf24" }}/>}
                              {meta?.is_fk && <LinkIcon sx={{ fontSize:"0.625rem", color:"#818cf8" }}/>}
                              {col}
                              {meta && <Chip label={meta.type.split("(")[0]} size="small"
                                sx={{ height:"0.875rem", fontSize:"0.5rem", px:"0.125rem", color:typeColor(meta.type), bgcolor:typeColor(meta.type)+"22", border:"none", ml:"0.125rem" }}/>}
                            </Box>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageData.rows.map((row, i) => (
                      <TableRow key={i} hover>
                        {pageData.columns.map(col => (
                          <TableCell key={col} sx={{ fontSize:"0.8125rem", maxWidth:"16rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", py:"0.3125rem" }}>
                            <Tooltip title={String(row[col] ?? "")} placement="top">
                              <span>{row[col] !== "" && row[col] != null ? row[col] : <span style={{ color:"#6b7280", fontStyle:"italic", fontSize:"0.6875rem" }}>null</span>}</span>
                            </Tooltip>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {pageData && (
              <TablePagination component="div" count={pageData.total_rows} page={page} rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[25,50,100,200]}
                onPageChange={(_, p) => { setPage(p); loadPage(p, rowsPerPage) }}
                onRowsPerPageChange={(e) => { const rpp = +e.target.value; setRowsPerPage(rpp); setPage(0); loadPage(0, rpp) }}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count.toLocaleString("es-AR")}`}
                sx={{ flexShrink:0, borderTop:"1px solid", borderColor:"divider" }}/>
            )}
          </>}

          {rightTab === 1 && showDiagram && (
            <Paper variant="outlined" sx={{ flex:1, p:"1.25rem", overflow:"auto", borderRadius:"0.75rem", display:"flex", flexDirection:"column" }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb:"0.75rem", flexShrink:0 }}>
                {selectedTable ? `Relaciones de ${selectedTable.schema_name}.${selectedTable.table_name}` : "Elegí una tabla"}
              </Typography>
              <RelationDiagram tables={schema!.tables} focusTable={selectedTable}/>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<Box sx={{ display:"flex", justifyContent:"center", mt:"4rem" }}><CircularProgress /></Box>}>
      <ExplorerPageInner />
    </Suspense>
  )
}

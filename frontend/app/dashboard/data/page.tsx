"use client"

/**
 * /dashboard/data — Vista única de datos
 *
 * FIXES:
 *  1. Buscador universal (demo + csv + db) con selector de columna
 *  2. "Conectar nueva fuente" como Drawer lateral — sin navegar, sin perder datos
 *  3. Mis datasets con botón borrar (papelera al hover)
 *  4. Estado persistente — no recarga al abrir/cerrar el drawer
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
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
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
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
import AddIcon from "@mui/icons-material/Add"
import SearchIcon from "@mui/icons-material/Search"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import ClearIcon from "@mui/icons-material/Clear"
import FolderIcon from "@mui/icons-material/Folder"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import { getSessionIds, removeSessionId } from "@/lib/sessionDatasets"
import type { DatasetListItem, DatasetListResponse } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceType = "demo" | "csv" | "db"

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
  try { return JSON.parse(localStorage.getItem("fiq_db_connection") ?? "null") }
  catch { return null }
}

function fmtRows(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toString()
}

const DTYPE_COLOR: Record<string, string> = {
  datetime: "#6366f1", timestamp: "#6366f1",
  numeric: "#22c55e", integer: "#22c55e", float: "#22c55e", int: "#22c55e", bigint: "#22c55e",
  varchar: "#f59e0b", text: "#f59e0b",
  boolean: "#06b6d4", uuid: "#ec4899", json: "#a78bfa",
}
function typeColor(t: string): string {
  const lower = t.toLowerCase()
  for (const [k, v] of Object.entries(DTYPE_COLOR)) if (lower.includes(k)) return v
  return "#9ca3af"
}

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]

// ── Relation diagram ──────────────────────────────────────────────────────────

function RelationDiagram({ tables, focus }: { tables: TableMeta[]; focus: TableMeta | null }) {
  if (!focus) return (
    <Box sx={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:"0.75rem" }}>
      <AccountTreeIcon sx={{ fontSize:"3rem", color:"text.disabled" }} />
      <Typography variant="body2" color="text.secondary">Elegí una tabla para ver su diagrama</Typography>
    </Box>
  )
  const relNames = new Set<string>()
  focus.columns.filter(c => c.is_fk && c.fk_ref).forEach(c => {
    const p = c.fk_ref!.split("."); if (p.length >= 2) relNames.add(p[p.length-2])
  })
  tables.forEach(t => {
    if (t.table_name === focus.table_name) return
    t.columns.filter(c => c.is_fk && c.fk_ref).forEach(c => {
      const p = c.fk_ref!.split(".")
      if (p[p.length-2] === focus.table_name) relNames.add(t.table_name)
    })
  })
  const related = tables.filter(t => relNames.has(t.table_name))
  const W=560,H=400,CX=W/2,CY=H/2,BW=160,BHB=24,RH=18,R=160
  const pos: Record<string,{x:number;y:number;h:number}> = {}
  const fh = BHB + focus.columns.length*RH
  pos[focus.table_name] = {x:CX-BW/2,y:CY-fh/2,h:fh}
  related.forEach((t,i) => {
    const a = 2*Math.PI*i/related.length - Math.PI/2
    const th = BHB + Math.min(t.columns.length,5)*RH
    pos[t.table_name] = {x:CX+R*Math.cos(a)-BW/2,y:CY+R*Math.sin(a)-th/2,h:th}
  })
  const lines: {x1:number;y1:number;x2:number;y2:number}[] = []
  focus.columns.filter(c=>c.is_fk&&c.fk_ref).forEach(c => {
    const r=c.fk_ref!.split(".");const rt=r[r.length-2];const p2=pos[rt];if(!p2)return
    const fp=pos[focus.table_name];lines.push({x1:fp.x+BW,y1:fp.y+fp.h/2,x2:p2.x,y2:p2.y+p2.h/2})
  })
  related.forEach(t => t.columns.filter(c=>c.is_fk&&c.fk_ref).forEach(c => {
    const r=c.fk_ref!.split(".");if(r[r.length-2]!==focus.table_name)return
    const p2=pos[t.table_name];const fp=pos[focus.table_name]
    lines.push({x1:p2.x+BW,y1:p2.y+p2.h/2,x2:fp.x,y2:fp.y+fp.h/2})
  }))
  return (
    <Box sx={{overflow:"auto",flex:1}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6366f1"/></marker></defs>
        {lines.map((l,i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arr2)" opacity={0.7}/>)}
        {[focus,...related].map(t => {
          const p=pos[t.table_name];if(!p)return null
          const isF=t.table_name===focus.table_name
          const cols=isF?t.columns:t.columns.slice(0,5)
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
              {!isF && t.columns.length>5 && <text x={p.x+BW/2} y={p.y+BHB+5*RH+13} textAnchor="middle" fill="#6b7280" fontSize={9}>+{t.columns.length-5} más…</text>}
            </g>
          )
        })}
      </svg>
      {relNames.size===0 && <Typography variant="caption" color="text.disabled" sx={{display:"block",mt:"0.5rem",textAlign:"center"}}>Sin relaciones FK definidas.</Typography>}
    </Box>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function DataPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Fuente activa
  const [source, setSource]             = useState<SourceType>("demo")
  const [csvDatasetId, setCsvDatasetId] = useState(searchParams.get("dsId") ?? "")
  const [demoCategoria, setDemoCategoria] = useState("Electrónica")
  const [demoSkuId, setDemoSkuId]       = useState("")

  // Drawer "Conectar nueva fuente" — eliminado, ahora navega a /dashboard/dataset

  // Datasets del usuario
  const [myDatasets, setMyDatasets]     = useState<DatasetListItem[]>([])
  const [filesExpanded, setFilesExpanded] = useState(true)
  const [deletingId, setDeletingId]     = useState<string | null>(null)  // dataset a confirmar borrado
  const [deleting, setDeleting]         = useState(false)

  // DB schema
  const [schema, setSchema]               = useState<SchemaResponse | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableMeta | null>(null)
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [tableSearch, setTableSearch]     = useState("")
  const [colSearch, setColSearch]         = useState("")
  const conn = getStoredConnection()

  // Tabla / paginación
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pageData, setPageData] = useState<PageResponse | null>(null)
  const [page, setPage]         = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [rightTab, setRightTab] = useState(0)

  // Búsqueda universal (demo + csv + db)
  const [searchText, setSearchText]     = useState("")
  const [searchColumn, setSearchColumn] = useState("")
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref para evitar closure stale en el debounce timer
  const searchColumnRef = useRef(searchColumn)
  useEffect(() => { searchColumnRef.current = searchColumn }, [searchColumn])

  // ── Cargar lista de datasets ──────────────────────────────────────────
  const loadMyDatasets = useCallback(() => {
    const ids = getSessionIds()
    const url = ids ? `/api/datasets/?session_ids=${encodeURIComponent(ids)}` : "/api/datasets/"
    api.get<DatasetListResponse>(url)
      .then(r => setMyDatasets(r.datasets))
      .catch(() => {})
  }, [])

  useEffect(() => { loadMyDatasets() }, [loadMyDatasets])

  // Stats precalculadas del demo (instantáneas, sin DuckDB)
  const DEMO_STATS: Record<string, number> = {
    "Electrónica": 687_295, "Alimentos": 1_379_700, "Indumentaria": 918_705,
    "Hogar": 883_665, "Deportes": 693_135,
  }

  // ── Función de carga principal ────────────────────────────────────────
  async function doLoad(
    p: number, rpp: number,
    cat: string, sku: string,
    sText: string, sCol: string,
    table: TableMeta | null,
    src: SourceType, dsId: string,
  ) {
    setLoading(true); setError(null)
    try {
      let data: PageResponse
      if (src === "demo") {
        const params = new URLSearchParams({ categoria: cat, page: String(p+1), page_size: String(rpp) })
        if (sku) params.set("sku_id", sku)
        if (sText && sCol) { params.set("search_text", sText); params.set("search_column", sCol) }
        data = await api.get<PageResponse>(`/api/datasets/explore/demo?${params}`)
      } else if (src === "csv" && dsId) {
        const params = new URLSearchParams({ page: String(p+1), page_size: String(rpp) })
        if (sText && sCol) { params.set("search_text", sText); params.set("search_column", sCol) }
        data = await api.get<PageResponse>(`/api/datasets/${dsId}/page?${params}`)
      } else if (src === "db" && conn && table) {
        data = await api.post<PageResponse>("/api/datasets/explore/db/query", {
          connection_string: conn.connection_string,
          schema_name: table.schema_name, table_name: table.table_name,
          page: p+1, page_size: rpp, search_text: sText, search_column: sCol,
        })
      } else { setLoading(false); return }
      setPageData(data)
      if (!sCol && data.columns.length > 0) setSearchColumn(data.columns[0])
      // Cachear en sessionStorage para restaurar al volver de /dashboard/dataset
      try {
        sessionStorage.setItem("fiq_data_page_cache", JSON.stringify({
          data, source: src, cat, dsId
        }))
      } catch { /* quota exceeded */ }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar datos.")
    } finally { setLoading(false) }
  }

  // Carga inicial — restaura desde sessionStorage si existe (evita recarga al volver de /dataset)
  const didMount = useRef(false)
  useEffect(() => {
    if (didMount.current) return; didMount.current = true
    try {
      const cached = sessionStorage.getItem("fiq_data_page_cache")
      if (cached) {
        const { data, source: src, cat, dsId } = JSON.parse(cached)
        setPageData(data); setSource(src); setDemoCategoria(cat ?? "Electrónica")
        if (dsId) setCsvDatasetId(dsId)
        if (data.columns.length > 0) setSearchColumn(data.columns[0])
        return  // no recarga
      }
    } catch { /* sessionStorage no disponible */ }
    doLoad(0, 50, "Electrónica", "", "", "", null, "demo", "")
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cambio de fuente ──────────────────────────────────────────────────
  const selectDemo = (cat = demoCategoria, sku = "") => {
    setSource("demo"); setPage(0); setSearchText(""); setSearchColumn(""); setPageData(null)
    doLoad(0, rowsPerPage, cat, sku, "", "", null, "demo", "")
  }
  const selectCsv = (dsId: string) => {
    setSource("csv"); setCsvDatasetId(dsId); setPage(0); setSearchText(""); setSearchColumn(""); setPageData(null)
    doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", "", null, "csv", dsId)
  }
  const selectDbTable = (t: TableMeta) => {
    setSource("db"); setSelectedTable(t); setPage(0); setSearchText("")
    const col = t.columns[0]?.name ?? ""; setSearchColumn(col); setPageData(null)
    doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", col, t, "db", csvDatasetId)
  }

  // ── Schema DB ─────────────────────────────────────────────────────────
  const loadSchema = useCallback(() => {
    if (!conn) return
    setLoadingSchema(true)
    api.post<SchemaResponse>("/api/datasets/explore/db/schema", {
      connection_string: conn.connection_string, engine: conn.engine,
    }).then(d => { setSchema(d); if (d.schemas.length>0) setExpandedSchemas(new Set([d.schemas[0]])) })
     .catch(e => setError(e instanceof ApiError ? e.message : "Error DB."))
     .finally(() => setLoadingSchema(false))
  }, [conn])

  useEffect(() => { if (conn && !schema) loadSchema() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Búsqueda debounced (universal) ────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearchText(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      // Usa ref para obtener el searchColumn actual (evita closure stale)
      const currentCol = searchColumnRef.current
      setPage(0)
      doLoad(0, rowsPerPage, demoCategoria, demoSkuId, val, currentCol, selectedTable, source, csvDatasetId)
    }, 600)
  }

  const handleSearchColumnChange = (col: string) => {
    setSearchColumn(col)
    if (searchText) {
      setPage(0)
      doLoad(0, rowsPerPage, demoCategoria, demoSkuId, searchText, col, selectedTable, source, csvDatasetId)
    }
  }

  const clearSearch = () => {
    setSearchText(""); setPage(0)
    doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", searchColumn, selectedTable, source, csvDatasetId)
  }

  // ── Borrar dataset ────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      await api.delete(`/api/datasets/${deletingId}`)
      removeSessionId(deletingId)
      if (source === "csv" && csvDatasetId === deletingId) {
        setSource("demo"); setPageData(null)
        doLoad(0, rowsPerPage, demoCategoria, demoSkuId, "", "", null, "demo", "")
      }
      loadMyDatasets()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al borrar.")
    } finally { setDeleting(false); setDeletingId(null) }
  }

  const filteredTables = schema?.tables.filter(t =>
    !tableSearch || t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
  ) ?? []

  const showDiagram = source === "db" && !!schema
  const hasSearch   = pageData && pageData.columns.length > 0

  // ── Etiqueta del header ───────────────────────────────────────────────
  const headerLabel =
    source === "demo" ? `Demo · ${demoCategoria}` :
    source === "csv"  ? (myDatasets.find(d => d.dataset_id===csvDatasetId)?.filename ?? "CSV") :
    selectedTable     ? `${selectedTable.schema_name}.${selectedTable.table_name}` :
    "Base de datos"

  // ── Panel izquierdo ───────────────────────────────────────────────────
  const renderLeftPanel = () => (
    <Box sx={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <Box sx={{ px:"0.75rem", py:"0.625rem", flexShrink:0 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ mb:"0.375rem" }}>
          Fuentes de datos
        </Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} fullWidth
          href="/dashboard/dataset"
          sx={{ textTransform:"none", fontSize:"0.75rem" }}>
          Conectar nueva fuente
        </Button>
      </Box>

      <Divider />

      <Box sx={{ flex:1, overflow:"auto", px:"0.375rem", py:"0.375rem" }}>

        {/* Demo */}
        <ListItemButton dense selected={source==="demo"} onClick={() => selectDemo()}
          sx={{ borderRadius:"0.375rem", mb:"0.125rem" }}>
          <ListItemIcon sx={{ minWidth:"1.5rem" }}>
            <AutoGraphIcon sx={{ fontSize:"0.875rem", color: source==="demo" ? "primary.main" : "text.disabled" }}/>
          </ListItemIcon>
          <ListItemText primary="Dataset demo" secondary="25k SKUs · Parquet"
            primaryTypographyProps={{ fontSize:"0.8125rem", fontWeight: source==="demo" ? 600 : 400 }}
            secondaryTypographyProps={{ fontSize:"0.625rem" }}/>
        </ListItemButton>

        {source === "demo" && (
          <Box sx={{ pl:"1.75rem", pb:"0.5rem" }}>
            {CATEGORIAS.map(cat => (
              <ListItemButton key={cat} dense selected={demoCategoria===cat}
                onClick={() => { setDemoCategoria(cat); selectDemo(cat) }}
                sx={{ borderRadius:"0.25rem", py:"0.125rem" }}>
                <ListItemText primary={cat} primaryTypographyProps={{ fontSize:"0.75rem" }}/>
              </ListItemButton>
            ))}
          </Box>
        )}

        <Divider sx={{ my:"0.375rem" }}/>

        {/* Mis archivos */}
        <ListItemButton dense onClick={() => setFilesExpanded(v => !v)}
          sx={{ borderRadius:"0.375rem", mb:"0.125rem" }}>
          <ListItemIcon sx={{ minWidth:"1.5rem" }}>
            <FolderIcon sx={{ fontSize:"0.875rem", color:"text.disabled" }}/>
          </ListItemIcon>
          <ListItemText primary="Mis archivos" secondary={`${myDatasets.length} datasets`}
            primaryTypographyProps={{ fontSize:"0.8125rem", fontWeight:500 }}
            secondaryTypographyProps={{ fontSize:"0.625rem" }}/>
          {filesExpanded ? <ExpandLessIcon sx={{ fontSize:"0.875rem" }}/> : <ExpandMoreIcon sx={{ fontSize:"0.875rem" }}/>}
        </ListItemButton>

        <Collapse in={filesExpanded}>
          <List dense disablePadding sx={{ pl:"1rem" }}>
            {myDatasets.length === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ px:"0.5rem", py:"0.25rem", display:"block" }}>
                Sin archivos. Usá &quot;Conectar nueva fuente&quot;.
              </Typography>
            )}
            {myDatasets.map(ds => (
              <Box key={ds.dataset_id}
                sx={{ display:"flex", alignItems:"center",
                  "&:hover .del-btn": { opacity:1 },
                  borderRadius:"0.25rem",
                  bgcolor: source==="csv" && csvDatasetId===ds.dataset_id ? "action.selected" : "transparent",
                }}>
                <ListItemButton dense
                  onClick={() => selectCsv(ds.dataset_id)}
                  sx={{ borderRadius:"0.25rem", py:"0.125rem", flex:1 }}>
                  <ListItemIcon sx={{ minWidth:"1.25rem" }}>
                    <TableChartIcon sx={{ fontSize:"0.75rem", color:"text.disabled" }}/>
                  </ListItemIcon>
                  <ListItemText
                    primary={ds.filename}
                    secondary={ds.rows ? fmtRows(ds.rows) : undefined}
                    primaryTypographyProps={{ fontSize:"0.75rem", noWrap:true }}
                    secondaryTypographyProps={{ fontSize:"0.625rem" }}/>
                </ListItemButton>
                <Tooltip title="Borrar dataset">
                  <IconButton size="small"
                    className="del-btn"
                    onClick={() => setDeletingId(ds.dataset_id)}
                    sx={{ opacity:0, transition:"opacity 0.15s", color:"error.main",
                      mr:"0.25rem", p:"0.125rem" }}>
                    <DeleteOutlineIcon sx={{ fontSize:"0.875rem" }}/>
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </List>
        </Collapse>

        <Divider sx={{ my:"0.375rem" }}/>

        {/* Base de datos */}
        <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", px:"0.375rem", mb:"0.25rem" }}>
          <Box sx={{ display:"flex", alignItems:"center", gap:"0.375rem" }}>
            <StorageIcon sx={{ fontSize:"0.875rem", color: source==="db" ? "primary.main" : "text.disabled" }}/>
            <Typography variant="caption" fontWeight={500} color={source==="db" ? "primary.main" : "text.secondary"}>
              {schema ? `${schema.engine} · ${schema.tables.length} tablas` : conn ? "Base de datos" : "Sin conexión"}
            </Typography>
          </Box>
          <IconButton size="small" onClick={loadSchema} disabled={loadingSchema || !conn}>
            <RefreshIcon sx={{ fontSize:"0.75rem" }}/>
          </IconButton>
        </Box>
        {loadingSchema && <LinearProgress sx={{ borderRadius:"0.25rem", mb:"0.25rem" }}/>}
        {!conn && (
          <Button size="small" variant="text" href="/dashboard/dataset?tab=1"
            sx={{ textTransform:"none", fontSize:"0.75rem", pl:"1.75rem" }}>
            Conectar DB →
          </Button>
        )}
        {schema && <>
          <TextField size="small" placeholder="Buscar tabla…" value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)} fullWidth
            sx={{ mb:"0.25rem", "& .MuiInputBase-input": { fontSize:"0.75rem", py:"0.3rem" } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:"0.75rem" }}/></InputAdornment>,
              endAdornment: tableSearch ? <InputAdornment position="end">
                <IconButton size="small" onClick={() => setTableSearch("")}><ClearIcon sx={{ fontSize:"0.625rem" }}/></IconButton>
              </InputAdornment> : undefined,
            }}/>
          <List dense disablePadding>
            {schema.schemas.map(s => {
              const sTabs = filteredTables.filter(t => t.schema_name===s)
              if (sTabs.length===0 && tableSearch) return null
              const expanded = expandedSchemas.has(s)
              return (
                <Box key={s}>
                  <ListItemButton dense onClick={() => setExpandedSchemas(prev => {
                    const n = new Set(prev); expanded ? n.delete(s) : n.add(s); return n
                  })} sx={{ borderRadius:"0.25rem", py:"0.125rem", px:"0.375rem" }}>
                    <ListItemIcon sx={{ minWidth:"1.25rem" }}>
                      <SchemaIcon sx={{ fontSize:"0.75rem", color:"primary.light" }}/>
                    </ListItemIcon>
                    <ListItemText primary={s} secondary={`${sTabs.length} tablas`}
                      primaryTypographyProps={{ fontSize:"0.75rem", fontWeight:600 }}
                      secondaryTypographyProps={{ fontSize:"0.5625rem" }}/>
                    {expanded ? <ExpandLessIcon sx={{ fontSize:"0.75rem" }}/> : <ExpandMoreIcon sx={{ fontSize:"0.75rem" }}/>}
                  </ListItemButton>
                  <Collapse in={expanded || !!tableSearch}>
                    <List dense disablePadding sx={{ pl:"1.25rem" }}>
                      {sTabs.map(t => (
                        <ListItemButton key={t.table_name} dense
                          selected={selectedTable?.table_name===t.table_name && selectedTable?.schema_name===s}
                          onClick={() => selectDbTable(t)}
                          sx={{ borderRadius:"0.25rem", py:"0.0625rem", px:"0.375rem" }}>
                          <ListItemIcon sx={{ minWidth:"1.25rem" }}>
                            <TableChartIcon sx={{ fontSize:"0.6875rem", color:"text.disabled" }}/>
                          </ListItemIcon>
                          <ListItemText primary={t.table_name}
                            secondary={t.row_count != null ? fmtRows(t.row_count) : undefined}
                            primaryTypographyProps={{ fontSize:"0.75rem" }}
                            secondaryTypographyProps={{ fontSize:"0.5625rem" }}/>
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              )
            })}
          </List>
          {selectedTable && source==="db" && <>
            <Divider sx={{ my:"0.375rem" }}/>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ px:"0.375rem", display:"block", mb:"0.25rem" }}>
              {selectedTable.schema_name}.{selectedTable.table_name}
            </Typography>
            <TextField size="small" placeholder="Buscar columna…" value={colSearch}
              onChange={(e) => setColSearch(e.target.value)} fullWidth
              sx={{ mb:"0.25rem", "& .MuiInputBase-input": { fontSize:"0.6875rem", py:"0.25rem" } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:"0.6875rem" }}/></InputAdornment>,
                endAdornment: colSearch ? <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setColSearch("")}><ClearIcon sx={{ fontSize:"0.5625rem" }}/></IconButton>
                </InputAdornment> : undefined,
                sx: { fontSize:"0.6875rem" },
              }}/>
            <Box sx={{ maxHeight:"10rem", overflow:"auto" }}>
              {selectedTable.columns
                .filter(c => !colSearch || c.name.toLowerCase().includes(colSearch.toLowerCase()))
                .map(col => (
                  <Box key={col.name} onClick={() => handleSearchColumnChange(col.name)}
                    sx={{ display:"flex", alignItems:"center", gap:"0.25rem", py:"0.0625rem", px:"0.25rem",
                      bgcolor: col.name===searchColumn ? "action.selected" : "transparent",
                      borderRadius:"0.25rem", cursor:"pointer", "&:hover": { bgcolor:"action.hover" } }}>
                    {col.is_pk && <Tooltip title="PK"><KeyIcon sx={{ fontSize:"0.5625rem", color:"#fbbf24" }}/></Tooltip>}
                    {col.is_fk && <Tooltip title={`FK → ${col.fk_ref}`}><LinkIcon sx={{ fontSize:"0.5625rem", color:"#818cf8" }}/></Tooltip>}
                    <Typography variant="caption" sx={{ flex:1, fontSize:"0.6875rem" }}>{col.name}</Typography>
                    <Chip label={col.type.split("(")[0]} size="small"
                      sx={{ height:"0.75rem", fontSize:"0.4375rem", color:typeColor(col.type), bgcolor:typeColor(col.type)+"22", border:"none" }}/>
                  </Box>
                ))}
            </Box>
          </>}
        </>}
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display:"flex", flexDirection:"column", gap:"0.875rem", height:"calc(100vh - 7rem)", overflow:"hidden" }}>

      {/* Header */}
      <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem", flexShrink:0 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Datos</Typography>
          <Typography variant="caption" color="text.secondary">{headerLabel} · solo lectura</Typography>
        </Box>
        {(source==="csv" || source==="demo") && (
          <Button variant="contained" size="small" startIcon={<PlayArrowIcon />}
            onClick={() => {
              if (source==="csv") { appStore.setActiveDataset(csvDatasetId,"","","M"); router.push("/dashboard/forecast") }
              else router.push("/dashboard/dataset?tab=2")
            }}
            sx={{ textTransform:"none", fontWeight:600 }}>
            Usar en Forecast
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ flexShrink:0 }}>{error}</Alert>}

      {/* Body */}
      <Box sx={{ display:"flex", gap:"0.875rem", flex:1, minHeight:0 }}>

        {/* Panel izquierdo */}
        <Paper variant="outlined" sx={{
          width:"16rem", flexShrink:0, overflow:"hidden",
          display:"flex", flexDirection:"column", borderRadius:"0.75rem",
        }}>
          {renderLeftPanel()}
        </Paper>

        {/* Panel derecho */}
        <Box sx={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"0.5rem" }}>

          {/* Tabs FK (solo DB) */}
          {showDiagram && (
            <Tabs value={rightTab} onChange={(_, v) => setRightTab(v)}
              sx={{ flexShrink:0, minHeight:"2.25rem", borderBottom:"1px solid", borderColor:"divider",
                "& .MuiTab-root": { textTransform:"none", minHeight:"2.25rem", fontSize:"0.8125rem" } }}>
              <Tab label="Tabla" />
              <Tab icon={<AccountTreeIcon sx={{ fontSize:"0.875rem" }}/>} iconPosition="start" label="Diagrama FK" />
            </Tabs>
          )}

          {rightTab === 0 && <>

            {/* ── Buscador universal (demo + csv + db) ── */}
            {hasSearch && (
              <Box sx={{ display:"flex", gap:"0.5rem", alignItems:"center", flexShrink:0 }}>
                <FormControl size="small" sx={{ width:"10rem", flexShrink:0 }}>
                  <InputLabel>Columna</InputLabel>
                  <Select value={searchColumn} label="Columna"
                    onChange={(e) => handleSearchColumnChange(e.target.value)}>
                    {pageData!.columns.map(c => (
                      <MenuItem key={c} value={c} sx={{ fontSize:"0.8125rem" }}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" fullWidth
                  placeholder={`Buscar en ${searchColumn || "columna"}…`}
                  value={searchText}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:"0.875rem" }}/></InputAdornment>,
                    endAdornment: searchText ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}>
                          <ClearIcon sx={{ fontSize:"0.75rem" }}/>
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />
                {searchText && (
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace:"nowrap" }}>
                    {pageData!.total_rows.toLocaleString("es-AR")} resultados
                  </Typography>
                )}
              </Box>
            )}

            {/* Info bar */}
            {pageData && (
              <Box sx={{ display:"flex", alignItems:"center", gap:"0.75rem", flexShrink:0 }}>
                <Typography variant="caption" color="text.disabled">
                  {searchText
                    ? `${pageData.total_rows.toLocaleString("es-AR")} coincidencias`
                    : source === "demo" && !demoSkuId
                      ? `${(DEMO_STATS[demoCategoria] ?? pageData.total_rows).toLocaleString("es-AR")} filas totales · ${pageData.columns.length} columnas`
                      : `${pageData.total_rows.toLocaleString("es-AR")} filas · ${pageData.columns.length} columnas`
                  }
                </Typography>
                <IconButton size="small"
                  onClick={() => doLoad(page, rowsPerPage, demoCategoria, demoSkuId, searchText, searchColumn, selectedTable, source, csvDatasetId)}
                  disabled={loading}>
                  <RefreshIcon sx={{ fontSize:"0.875rem" }}/>
                </IconButton>
                {loading && <LinearProgress sx={{ flex:1, height:"0.25rem", borderRadius:"0.125rem" }}/>}
              </Box>
            )}

            {/* Spinner inicial */}
            {loading && !pageData && (
              <Paper variant="outlined" sx={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"1rem", borderRadius:"0.75rem", p:"1.5rem" }}>
                <LinearProgress sx={{ width:"60%", borderRadius:"0.25rem" }} />
                <Typography variant="body2" color="text.secondary">Cargando datos…</Typography>
              </Paper>
            )}

            {/* Placeholder DB sin tabla */}
            {source==="db" && !selectedTable && !loading && (
              <Paper variant="outlined" sx={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.75rem", borderRadius:"0.75rem", borderStyle:"dashed" }}>
                <TableChartIcon sx={{ fontSize:"3rem", color:"text.disabled" }}/>
                <Typography variant="body2" color="text.secondary">Elegí una tabla del panel izquierdo</Typography>
              </Paper>
            )}

            {/* Tabla de datos */}
            {pageData && pageData.rows.length > 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ flex:1, overflow:"auto", borderRadius:"0.75rem" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {pageData.columns.map(col => {
                        const meta = selectedTable?.columns.find(c => c.name===col)
                        return (
                          <TableCell key={col}
                            onClick={() => handleSearchColumnChange(col)}
                            sx={{ bgcolor:"background.default", whiteSpace:"nowrap", py:"0.625rem",
                              fontSize:"0.75rem", fontWeight:600, color: col===searchColumn ? "primary.main" : "text.secondary",
                              cursor:"pointer", "&:hover": { color:"primary.light" } }}>
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
                            <Tooltip title={String(row[col]??"")} placement="top">
                              <span>{row[col]!==""&&row[col]!=null ? row[col] : <span style={{ color:"#6b7280", fontStyle:"italic", fontSize:"0.6875rem" }}>null</span>}</span>
                            </Tooltip>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {pageData && pageData.rows.length === 0 && !loading && (
              <Paper variant="outlined" sx={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.5rem", borderRadius:"0.75rem" }}>
                <SearchIcon sx={{ fontSize:"2.5rem", color:"text.disabled" }}/>
                <Typography variant="body2" color="text.secondary">
                  {searchText ? <>Sin resultados para &quot;{searchText}&quot; en {searchColumn}</> : "Sin datos"}
                </Typography>
                {searchText && <Button size="small" variant="text" onClick={clearSearch}>Limpiar búsqueda</Button>}
              </Paper>
            )}

            {pageData && (
              <TablePagination component="div" count={pageData.total_rows} page={page} rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[25,50,100,200]}
                onPageChange={(_,p) => { setPage(p); doLoad(p, rowsPerPage, demoCategoria, demoSkuId, searchText, searchColumn, selectedTable, source, csvDatasetId) }}
                onRowsPerPageChange={(e) => { const r=+e.target.value; setRowsPerPage(r); setPage(0); doLoad(0, r, demoCategoria, demoSkuId, searchText, searchColumn, selectedTable, source, csvDatasetId) }}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count.toLocaleString("es-AR")}`}
                sx={{ flexShrink:0, borderTop:"1px solid", borderColor:"divider" }}/>
            )}
          </>}

          {/* Diagrama FK */}
          {rightTab===1 && showDiagram && (
            <Paper variant="outlined" sx={{ flex:1, p:"1.25rem", overflow:"auto", borderRadius:"0.75rem", display:"flex", flexDirection:"column" }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb:"0.75rem", flexShrink:0 }}>
                {selectedTable ? `Relaciones de ${selectedTable.schema_name}.${selectedTable.table_name}` : "Elegí una tabla"}
              </Typography>
              <RelationDiagram tables={schema!.tables} focus={selectedTable}/>
            </Paper>
          )}
        </Box>
      </Box>

      {/* ── Dialog: confirmar borrado ──────────────────────────────────── */}
      <Dialog open={Boolean(deletingId)} onClose={() => setDeletingId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>¿Borrar dataset?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Se borrará permanentemente el archivo{" "}
            <strong>{myDatasets.find(d => d.dataset_id===deletingId)?.filename}</strong>{" "}
            de Supabase Storage. Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingId(null)} sx={{ textTransform:"none" }}>Cancelar</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}
            sx={{ textTransform:"none" }}>
            {deleting ? "Borrando…" : "Borrar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function DataPage() {
  return (
    <Suspense fallback={<Box sx={{ display:"flex", justifyContent:"center", mt:"4rem" }}><CircularProgress /></Box>}>
      <DataPageInner />
    </Suspense>
  )
}

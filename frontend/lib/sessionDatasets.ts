/**
 * sessionDatasets — persiste los dataset_ids creados sin autenticación.
 * Cuando el usuario no está logueado, los uploads/demo/db-connect generan
 * dataset_ids con user_id=null en Supabase. Los guardamos en localStorage
 * para poder listarlos en "Mis Datasets" sin perderlos al navegar.
 *
 * Al loguearse, el backend asocia los nuevos uploads al user_id.
 * Los datasets anónimos previos siguen siendo accesibles via session_ids.
 */

const KEY = "fiq_session_datasets"
const MAX = 50 // máximo de IDs a guardar localmente

export interface SessionDataset {
  dataset_id: string
  filename:   string
  created_at: string
}

function load(): SessionDataset[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SessionDataset[]
  } catch {
    return []
  }
}

function save(items: SessionDataset[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch { /* storage full */ }
}

/** Registra un nuevo dataset_id en la sesión local. */
export function addSessionDataset(ds: SessionDataset): void {
  const existing = load()
  if (existing.some((d) => d.dataset_id === ds.dataset_id)) return
  save([ds, ...existing])
}

/** Retorna los dataset_ids locales como string CSV para el query param. */
export function getSessionIds(): string {
  return load().map((d) => d.dataset_id).join(",")
}

/** Elimina un dataset_id del localStorage (cuando se borra desde la UI). */
export function removeSessionId(datasetId: string): void {
  const existing = load()
  save(existing.filter((d) => d.dataset_id !== datasetId))
}

/** Limpia todos los IDs locales (al hacer logout). */
export function clearSessionDatasets(): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(KEY) } catch { /* ok */ }
}

-- ============================================================
-- forecastiq — Migration 003: datasets table + RLS por usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Phase 5 — Auth + Persistence
-- ============================================================
-- ORDEN DE EJECUCIÓN:
--   1. Crear tabla datasets
--   2. Reemplazar RLS permisiva de forecast_jobs
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TABLA datasets
--    Registra metadata de cada CSV subido a Supabase Storage.
--    El archivo físico vive en Storage (bucket "datasets"),
--    identificado por dataset_id (= path en el bucket).
-- ────────────────────────────────────────────────────────────

create table if not exists datasets (
  id          uuid primary key default gen_random_uuid(),
  dataset_id  text not null unique,               -- path en Storage (UUID generado por upload_csv)
  filename    text not null,                       -- nombre original del archivo
  rows        int,                                 -- cantidad de filas del CSV
  columns     jsonb,                               -- lista de columnas: ["fecha", "ventas", ...]
  user_id     uuid references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

-- Índices
create index if not exists idx_datasets_user_id    on datasets(user_id);
create index if not exists idx_datasets_dataset_id on datasets(dataset_id);

-- RLS
alter table datasets enable row level security;

-- Lectura: cada usuario ve solo sus datasets (anónimos no ven nada)
create policy "datasets_select_own" on datasets
  for select
  using (user_id = auth.uid());

-- Inserción: solo el usuario autenticado puede registrar sus datasets
create policy "datasets_insert_own" on datasets
  for insert
  with check (user_id = auth.uid());

-- Borrado: solo puede borrar los suyos
create policy "datasets_delete_own" on datasets
  for delete
  using (user_id = auth.uid());

comment on table datasets is
  'Metadata de CSVs subidos a Supabase Storage. El archivo físico vive en el bucket "datasets".';


-- ────────────────────────────────────────────────────────────
-- 2. FORECAST_JOBS — reemplazar policy pública (Phase 2) por RLS por usuario
--    La columna user_id ya existe desde migration 001.
-- ────────────────────────────────────────────────────────────

-- Eliminar la policy permisiva de desarrollo (Phase 2)
drop policy if exists "forecast_jobs_public_all" on forecast_jobs;

-- Lectura: cada usuario ve solo sus propios jobs
create policy "forecast_jobs_select_own" on forecast_jobs
  for select
  using (
    user_id = auth.uid()            -- usuario autenticado ve los suyos
    or user_id is null              -- jobs anónimos (sin auth, dev/demo) aún visibles
  );

-- Inserción: cualquier usuario (auth o anón) puede crear un job
-- En Phase 5 el backend siempre pasa el user_id del JWT; anónimos tienen user_id = null
create policy "forecast_jobs_insert" on forecast_jobs
  for insert
  with check (
    user_id = auth.uid()            -- usuario autenticado
    or user_id is null              -- modo demo sin login
  );

-- Actualización: solo el backend (service key) o el dueño del job
-- El worker de Celery usa service key → bypasa RLS → puede actualizar cualquier job
create policy "forecast_jobs_update_own" on forecast_jobs
  for update
  using (
    user_id = auth.uid()
    or user_id is null
  );

comment on table forecast_jobs is
  'Jobs de forecast. user_id NULL = modo demo/anónimo. Phase 5: RLS activo por usuario.';

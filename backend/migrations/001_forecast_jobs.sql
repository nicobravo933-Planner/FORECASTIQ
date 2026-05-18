-- ============================================================
-- forecastiq — Tabla forecast_jobs
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Phase 2 — Forecast Engine
-- ============================================================

create table if not exists forecast_jobs (
  job_id      text primary key,          -- Celery task ID (UUID)
  status      text not null default 'pending'
              check (status in ('pending', 'started', 'done', 'failed')),
  dataset_id  text,                       -- UUID del CSV en Storage
  model_used  text,                       -- moving_average | holt_winters | sarima | lightgbm
  freq        text,                       -- D | W | M | Q
  horizon     int,                        -- períodos proyectados
  metrics     jsonb,                      -- {wape, mae, bias, rmse, mape}
  historical  jsonb,                      -- [{date, value}, ...]
  predictions jsonb,                      -- [{date, predicted, lower, upper}, ...]
  error       text,                       -- mensaje si status=failed
  user_id     uuid references auth.users on delete cascade,
  created_at  timestamptz default now()
);

-- Índices
create index if not exists idx_forecast_jobs_status     on forecast_jobs(status);
create index if not exists idx_forecast_jobs_dataset_id on forecast_jobs(dataset_id);
create index if not exists idx_forecast_jobs_user_id    on forecast_jobs(user_id);

-- RLS
alter table forecast_jobs enable row level security;

-- Por ahora (Phase 2, sin auth): acceso público para desarrollo local
-- En Phase 5 (Auth) se reemplaza por políticas por usuario
create policy "forecast_jobs_public_all" on forecast_jobs
  for all using (true) with check (true);

comment on table forecast_jobs is
  'Jobs de forecast — estado + resultado completo. Phase 5 agrega user_id RLS.';

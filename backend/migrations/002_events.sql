-- migrations/002_events.sql
-- Tabla de eventos del calendario (feriados, promociones, estacionales, otros)
-- RLS: eventos globales (user_id IS NULL) visibles para todos;
--       eventos propios (user_id NOT NULL) solo para su dueño.

CREATE TABLE IF NOT EXISTS events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = evento global
    name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    type        TEXT NOT NULL CHECK (type IN ('holiday', 'promotion', 'seasonal', 'other')),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL CHECK (end_date >= start_date),
    impact_pct  NUMERIC(6, 2),  -- ej: +20.00 o -10.00; NULL = sin ajuste (solo visual)
    is_global   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS events_user_id_idx    ON events (user_id);
CREATE INDEX IF NOT EXISTS events_date_range_idx ON events (start_date, end_date);

-- Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Política de lectura: globales visibles para todos; propios solo para su dueño
CREATE POLICY "events_select" ON events
    FOR SELECT
    USING (user_id IS NULL OR user_id = auth.uid());

-- Política de inserción: solo el usuario autenticado puede crear sus propios eventos
CREATE POLICY "events_insert" ON events
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Política de borrado: solo puede borrar sus propios eventos (no los globales)
CREATE POLICY "events_delete" ON events
    FOR DELETE
    USING (user_id = auth.uid());

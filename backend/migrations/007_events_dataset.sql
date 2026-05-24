-- ============================================================
-- forecastiq — Migration 007: events — agregar dataset_id
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Permite asociar un evento a un dataset específico del usuario.
-- NULL = el evento aplica a todos los datasets del usuario
--        (comportamiento anterior, backward-compatible).
--
-- Ejemplos:
--   dataset_id IS NULL  → "Black Friday aplica a todos mis datasets"
--   dataset_id = <uuid> → "Esta promo sólo aplica al dataset de Tienda A"
-- ============================================================

-- 1. Agregar columna dataset_id (nullable para no romper eventos existentes)
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE;

-- 2. Índice para el query frecuente: eventos de un dataset específico + globales del usuario
CREATE INDEX IF NOT EXISTS events_dataset_id_idx ON events (dataset_id);

-- 3. Actualizar política de SELECT para incluir eventos por dataset
--    La política anterior sólo filtraba por user_id — la reemplazamos.
DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_select" ON events
    FOR SELECT
    USING (
        -- Eventos globales del sistema (feriados AR cargados por admin)
        (user_id IS NULL AND is_global = TRUE)
        -- Eventos propios del usuario (todos sus datasets o uno específico)
        OR user_id = auth.uid()
    );

-- 4. La política de INSERT no necesita cambio — el usuario sigue siendo dueño
--    El dataset_id es opcional en el INSERT.

-- Nota: los eventos existentes quedan con dataset_id = NULL → siguen funcionando
--       en todos los datasets del usuario, sin cambio de comportamiento.

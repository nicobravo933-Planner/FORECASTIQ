-- Migration 005: forecast_hpo_cache
-- Guarda los mejores hiperparámetros de LightGBM+Optuna por dataset.
-- Evita re-correr Optuna (60s) en cada forecast del mismo dataset.
-- La invalidación es manual (botón "Re-optimizar") o automática si hay drift.

CREATE TABLE IF NOT EXISTS forecast_hpo_cache (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id    TEXT NOT NULL,
    freq          TEXT NOT NULL,             -- "D" | "W" | "ME" | "QE"
    params        JSONB NOT NULL,            -- mejores hiperparámetros Optuna
    wape          FLOAT,                     -- WAPE del mejor trial
    n_trials      INT,                       -- cuántos trials corrió Optuna
    optimized_at  TIMESTAMPTZ DEFAULT now(),
    user_id       TEXT,

    -- Una entrada por dataset+freq (upsert en cada re-optimización)
    UNIQUE (dataset_id, freq)
);

-- RLS: cada usuario solo ve su propio cache
ALTER TABLE forecast_hpo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hpo_cache_owner" ON forecast_hpo_cache
    FOR ALL USING (
        user_id = auth.uid()::text
        OR user_id IS NULL  -- cache anónimo (modo demo)
    );

-- Índice para lookup rápido
CREATE INDEX IF NOT EXISTS idx_hpo_cache_dataset_freq
    ON forecast_hpo_cache (dataset_id, freq);

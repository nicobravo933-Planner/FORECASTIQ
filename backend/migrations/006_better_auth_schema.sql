-- ============================================================
-- forecastiq — Migration 006: Better Auth schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Crea las tablas que necesita Better Auth para manejar sesiones,
-- usuarios OAuth y el plugin anonymous (login sin cuenta).
-- ============================================================

-- ── Tabla user ───────────────────────────────────────────────
-- isAnonymous es requerido por el plugin anonymous de Better Auth
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    image TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "isAnonymous" BOOLEAN DEFAULT false
);

-- ── Tabla session ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    "expiresAt" TIMESTAMP NOT NULL,
    token TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- ── Tabla account ────────────────────────────────────────────
-- Vincula usuarios con proveedores OAuth (Google, GitHub)
CREATE TABLE IF NOT EXISTS "account" (
    id TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP,
    "refreshTokenExpiresAt" TIMESTAMP,
    scope TEXT,
    password TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Tabla verification ───────────────────────────────────────
-- Para magic links y verificación de email
CREATE TABLE IF NOT EXISTS "verification" (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"("userId");
CREATE INDEX IF NOT EXISTS idx_session_token   ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"("userId");
CREATE INDEX IF NOT EXISTS idx_account_provider ON "account"("providerId", "accountId");

-- ── Columna isAnonymous si la tabla user ya existía ──────────
-- (por si corriste una versión anterior sin este campo)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'isAnonymous'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "isAnonymous" BOOLEAN DEFAULT false;
    END IF;
END $$;

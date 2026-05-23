-- ============================================================
-- forecastiq — Migration 004: chat_conversations
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Feature: Chat history persistence
-- ============================================================
-- TABLA: chat_conversations
--   Guarda el historial completo de conversaciones de chat.
--   user_id nullable: NULL = conversación anónima (guardada solo en localStorage)
--   messages: JSONB array con el formato ChatMessage del frontend
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TABLA chat_conversations
-- ────────────────────────────────────────────────────────────

create table if not exists chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,  -- NULL = anónimo
  title       text not null default 'Nueva conversación',    -- primeras palabras del 1er mensaje
  messages    jsonb not null default '[]'::jsonb,            -- array de ChatMessage
  model_id    text,                                          -- modelo usado en la conversación
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Índices para búsqueda eficiente por usuario y fecha
create index if not exists idx_chat_conversations_user_id
  on chat_conversations(user_id);

create index if not exists idx_chat_conversations_updated_at
  on chat_conversations(updated_at desc);

-- Índice compuesto para listar conversaciones de un usuario ordenadas por fecha
create index if not exists idx_chat_conversations_user_updated
  on chat_conversations(user_id, updated_at desc);


-- ────────────────────────────────────────────────────────────
-- 2. FUNCIÓN: actualizar updated_at automáticamente
-- ────────────────────────────────────────────────────────────

create or replace function update_chat_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_chat_conversations_updated_at
  before update on chat_conversations
  for each row
  execute function update_chat_conversations_updated_at();


-- ────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

alter table chat_conversations enable row level security;

-- SELECT: cada usuario ve solo sus conversaciones
create policy "chat_conversations_select_own" on chat_conversations
  for select
  using (user_id = auth.uid());

-- INSERT: solo usuarios autenticados pueden crear conversaciones
--   El backend usa service key (bypasa RLS) → puede insertar con cualquier user_id
--   Esta policy aplica cuando se usa la anon key directamente
create policy "chat_conversations_insert_own" on chat_conversations
  for insert
  with check (user_id = auth.uid());

-- UPDATE: solo el dueño puede actualizar (el backend usa service key → bypasa)
create policy "chat_conversations_update_own" on chat_conversations
  for update
  using (user_id = auth.uid());

-- DELETE: solo el dueño puede borrar
create policy "chat_conversations_delete_own" on chat_conversations
  for delete
  using (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 4. COMENTARIOS
-- ────────────────────────────────────────────────────────────

comment on table chat_conversations is
  'Historial de conversaciones de chat IA. user_id NULL = anónimo (guardado en localStorage, no en DB).';

comment on column chat_conversations.title is
  'Título generado a partir de las primeras palabras del primer mensaje del usuario.';

comment on column chat_conversations.messages is
  'Array JSONB de ChatMessage: [{id, role, content, created_at}]. Máximo recomendado: 200 mensajes.';

comment on column chat_conversations.model_id is
  'ID del modelo LLM usado, ej: deepseek/deepseek-v4-flash:free';

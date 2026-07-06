-- LeveCRM v51 — corrige schema do projeto Supabase novo (hoxngbfukvbhvmzmptqn)
-- ----------------------------------------------------------------------------
-- O projeto trocou de banco Supabase recentemente e a tabela "leads" ficou sem
-- a coluna "data_fechamento" (erro no console: "Could not find the
-- 'data_fechamento' column of 'leads' in the schema cache"), e as tabelas
-- "crm_settings" / a coluna "agenda_eventos.lead_id" também não foram criadas
-- neste projeto novo.
--
-- Cole TODO este script no SQL Editor do Supabase (projeto hoxngbfukvbhvmzmptqn)
-- e clique em "Run". É idempotente: pode ser executado novamente sem causar
-- problemas.
-- ----------------------------------------------------------------------------

begin;

-- Garante a função de admin usada nas políticas (idempotente).
create or replace function public.is_levecrm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'sanchaikraemer3@gmail.com'
$$;

-- ============================================================================
-- 1) TABELA leads — garante que existe e tem todas as colunas que o app usa
-- ============================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid()
);

alter table public.leads
  add column if not exists access_user_id      uuid,
  add column if not exists nome                text,
  add column if not exists telefone            text,
  add column if not exists empreendimento      text,
  add column if not exists etapa               text,
  add column if not exists etapa_comercial     text,
  add column if not exists prioridade          text,
  add column if not exists origem              text,
  add column if not exists responsavel         text,
  add column if not exists visita              text,
  add column if not exists observacao          text,
  add column if not exists nivel_interesse     text,
  add column if not exists ultimo_falante      text,
  add column if not exists proxima_acao_de     text,
  add column if not exists proximo_contato     date,
  add column if not exists data_inicio         date,
  add column if not exists data_fechamento     date,
  add column if not exists motivo_perda        text,
  add column if not exists ordem               bigint,
  add column if not exists criado_em           timestamptz not null default now(),
  add column if not exists atualizado_em       timestamptz not null default now(),
  add column if not exists ultima_interacao_em timestamptz;

create index if not exists leads_access_user_id_idx on public.leads (access_user_id);

-- ============================================================================
-- 2) TABELA crm_settings (responsáveis, empreendimentos, origens, marcadores)
-- ============================================================================
create table if not exists public.crm_settings (
  id             uuid primary key default gen_random_uuid(),
  access_user_id uuid not null default auth.uid(),
  category       text not null,
  name           text not null,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- Necessário para o "on_conflict=access_user_id,category,name" usado pelo app.
create unique index if not exists crm_settings_user_cat_name_uidx
  on public.crm_settings (access_user_id, category, name);

create index if not exists crm_settings_user_idx
  on public.crm_settings (access_user_id);

alter table public.crm_settings enable row level security;

drop policy if exists "crm_settings_owner_all" on public.crm_settings;
create policy "crm_settings_owner_all"
on public.crm_settings
for all
using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
)
with check (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

-- ============================================================================
-- 3) COLUNA lead_id em agenda_eventos (vínculo opcional do evento com o lead)
-- ============================================================================
alter table public.agenda_eventos
  add column if not exists lead_id text;

create index if not exists agenda_eventos_lead_id_idx
  on public.agenda_eventos (lead_id);

commit;

-- Recarrega o cache de schema do PostgREST para refletir as mudanças na hora.
notify pgrst, 'reload schema';

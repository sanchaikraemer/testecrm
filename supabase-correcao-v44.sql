-- LeveCRM v44 — correção de schema no Supabase
-- ----------------------------------------------------------------------------
-- Resolve os dois erros do console:
--   1) PGRST205: "Could not find the table 'public.crm_settings'"
--   2) 42703:   "column agenda_eventos.lead_id does not exist"
--
-- Cole TODO este script no SQL Editor do Supabase e clique em "Run".
-- É idempotente: pode ser executado novamente sem causar problemas.
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
-- 1) TABELA crm_settings (responsáveis, empreendimentos, origens, marcadores)
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
-- 2) COLUNA lead_id em agenda_eventos (vínculo opcional do evento com o lead)
-- ============================================================================
alter table public.agenda_eventos
  add column if not exists lead_id text;

create index if not exists agenda_eventos_lead_id_idx
  on public.agenda_eventos (lead_id);

-- ============================================================================
-- 3) COLUNAS faltantes em leads (campos novos que o "Salvar" envia).
--    Sem elas o save quebra com PGRST204 "Could not find the ... column".
-- ============================================================================
alter table public.leads add column if not exists data_fechamento     timestamptz;
alter table public.leads add column if not exists ultima_interacao_em timestamptz;
alter table public.leads add column if not exists ultimo_falante       text;
alter table public.leads add column if not exists proxima_acao_de      text;
alter table public.leads add column if not exists etapa_comercial      text;
alter table public.leads add column if not exists nivel_interesse      text;

commit;

-- Recarrega o cache de schema do PostgREST para refletir as mudanças na hora.
notify pgrst, 'reload schema';

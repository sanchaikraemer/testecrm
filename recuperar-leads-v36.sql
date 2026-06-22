-- LeveCRM v36 — recuperação segura de leads antigos
-- Objetivo: religar registros legados ao usuário do Supabase Auth sem apagar nada.
-- Conta de destino: sanchaikraemer3@gmail.com
-- Pode ser executado novamente: registros já vinculados corretamente não são alterados.

begin;

do $$
declare
  target_email text := 'sanchaikraemer3@gmail.com';
  target_uid uuid;
  lead_udt text;
  agenda_udt text;
  legacy_ids text[] := array[]::text[];
  moved_leads bigint := 0;
  moved_agenda bigint := 0;
begin
  select u.id
    into target_uid
  from auth.users u
  where lower(u.email) = lower(target_email)
  order by u.created_at asc
  limit 1;

  if target_uid is null then
    raise exception 'Não encontrei a conta % em Authentication > Users.', target_email;
  end if;

  -- Procura o ID usado pelo sistema antigo, quando a tabela ainda existe.
  if to_regclass('public.crm_access_users') is not null then
    execute $q$
      select coalesce(array_agg(to_jsonb(c)->>'id'), array[]::text[])
      from public.crm_access_users c
      where lower(coalesce(
        to_jsonb(c)->>'email',
        to_jsonb(c)->>'usuario',
        to_jsonb(c)->>'username',
        ''
      )) = lower($1)
    $q$ into legacy_ids using target_email;
  end if;

  select c.udt_name
    into lead_udt
  from information_schema.columns c
  where c.table_schema='public'
    and c.table_name='leads'
    and c.column_name='access_user_id';

  if lead_udt is null then
    raise exception 'A coluna public.leads.access_user_id não foi encontrada.';
  end if;

  if lead_udt = 'uuid' then
    execute $q$
      update public.leads l
         set access_user_id = $1
       where l.access_user_id is null
          or l.access_user_id::text = any($2)
          or not exists (
               select 1 from auth.users u
               where u.id = l.access_user_id
             )
    $q$ using target_uid, legacy_ids;
  else
    execute $q$
      update public.leads l
         set access_user_id = $1
       where nullif(btrim(l.access_user_id::text),'') is null
          or l.access_user_id::text = any($2)
          or not exists (
               select 1 from auth.users u
               where u.id::text = l.access_user_id::text
             )
    $q$ using target_uid::text, legacy_ids;
  end if;
  get diagnostics moved_leads = row_count;

  -- Recupera também os compromissos antigos da agenda, se a tabela existir.
  if to_regclass('public.agenda_eventos') is not null then
    select c.udt_name
      into agenda_udt
    from information_schema.columns c
    where c.table_schema='public'
      and c.table_name='agenda_eventos'
      and c.column_name='access_user_id';

    if agenda_udt = 'uuid' then
      execute $q$
        update public.agenda_eventos a
           set access_user_id = $1
         where a.access_user_id is null
            or a.access_user_id::text = any($2)
            or not exists (
                 select 1 from auth.users u
                 where u.id = a.access_user_id
               )
      $q$ using target_uid, legacy_ids;
      get diagnostics moved_agenda = row_count;
    elsif agenda_udt is not null then
      execute $q$
        update public.agenda_eventos a
           set access_user_id = $1
         where nullif(btrim(a.access_user_id::text),'') is null
            or a.access_user_id::text = any($2)
            or not exists (
                 select 1 from auth.users u
                 where u.id::text = a.access_user_id::text
               )
      $q$ using target_uid::text, legacy_ids;
      get diagnostics moved_agenda = row_count;
    end if;
  end if;

  raise notice 'Conta de destino: % (%)', target_email, target_uid;
  raise notice 'Leads recuperados/revinculados: %', moved_leads;
  raise notice 'Eventos de agenda recuperados/revinculados: %', moved_agenda;
end $$;

-- Garante que as políticas reconheçam a conta recuperada.
create or replace function public.is_levecrm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'sanchaikraemer3@gmail.com'
$$;

alter table public.leads enable row level security;

drop policy if exists "leads_select_owner" on public.leads;
drop policy if exists "leads_insert_owner" on public.leads;
drop policy if exists "leads_update_owner" on public.leads;
drop policy if exists "leads_delete_owner" on public.leads;

create policy "leads_select_owner" on public.leads
for select using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

create policy "leads_insert_owner" on public.leads
for insert with check (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

create policy "leads_update_owner" on public.leads
for update using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
) with check (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

create policy "leads_delete_owner" on public.leads
for delete using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

commit;

-- Conferência final: deve mostrar a quantidade de leads vinculados à sua conta.
select
  count(*) as total_leads_recuperados,
  min(criado_em) as lead_mais_antigo,
  max(atualizado_em) as ultima_atualizacao
from public.leads
where access_user_id::text = (
  select id::text from auth.users
  where lower(email)='sanchaikraemer3@gmail.com'
  order by created_at asc
  limit 1
);

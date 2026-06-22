-- LeveCRM v34 — políticas de isolamento por usuário
-- Corrige bancos em que access_user_id, profiles.id ou lead_id estão como TEXT
-- enquanto auth.uid() retorna UUID. Todas as comparações são normalizadas para TEXT.
-- O script é idempotente: pode ser executado novamente com segurança.

begin;

create or replace function public.is_levecrm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'sanchaikraemer3@gmail.com'
$$;

-- LEADS
alter table public.leads enable row level security;

drop policy if exists "leads_select_owner" on public.leads;
drop policy if exists "leads_insert_owner" on public.leads;
drop policy if exists "leads_update_owner" on public.leads;
drop policy if exists "leads_delete_owner" on public.leads;

create policy "leads_select_owner"
on public.leads
for select
using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

create policy "leads_insert_owner"
on public.leads
for insert
with check (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

create policy "leads_update_owner"
on public.leads
for update
using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
)
with check (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

create policy "leads_delete_owner"
on public.leads
for delete
using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

-- AGENDA
alter table public.agenda_eventos enable row level security;

drop policy if exists "agenda_owner_all" on public.agenda_eventos;

create policy "agenda_owner_all"
on public.agenda_eventos
for all
using (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
)
with check (
  access_user_id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

-- METADADOS DOS ANEXOS
alter table public.lead_attachments enable row level security;

drop policy if exists "attachments_owner_select" on public.lead_attachments;
drop policy if exists "attachments_owner_insert" on public.lead_attachments;
drop policy if exists "attachments_owner_delete" on public.lead_attachments;

create policy "attachments_owner_select"
on public.lead_attachments
for select
using (
  exists (
    select 1
    from public.leads l
    where l.id::text = lead_id::text
      and (
        l.access_user_id::text = auth.uid()::text
        or public.is_levecrm_admin()
      )
  )
);

create policy "attachments_owner_insert"
on public.lead_attachments
for insert
with check (
  exists (
    select 1
    from public.leads l
    where l.id::text = lead_id::text
      and (
        l.access_user_id::text = auth.uid()::text
        or public.is_levecrm_admin()
      )
  )
);

create policy "attachments_owner_delete"
on public.lead_attachments
for delete
using (
  exists (
    select 1
    from public.leads l
    where l.id::text = lead_id::text
      and (
        l.access_user_id::text = auth.uid()::text
        or public.is_levecrm_admin()
      )
  )
);

-- STORAGE: bucket privado e arquivos restritos ao dono do lead
update storage.buckets
set public = false
where id = 'lead-attachments';

drop policy if exists "lead_files_select" on storage.objects;
drop policy if exists "lead_files_insert" on storage.objects;
drop policy if exists "lead_files_delete" on storage.objects;

create policy "lead_files_select"
on storage.objects
for select
using (
  bucket_id = 'lead-attachments'
  and exists (
    select 1
    from public.leads l
    where l.id::text = (storage.foldername(name))[1]::text
      and (
        l.access_user_id::text = auth.uid()::text
        or public.is_levecrm_admin()
      )
  )
);

create policy "lead_files_insert"
on storage.objects
for insert
with check (
  bucket_id = 'lead-attachments'
  and exists (
    select 1
    from public.leads l
    where l.id::text = (storage.foldername(name))[1]::text
      and (
        l.access_user_id::text = auth.uid()::text
        or public.is_levecrm_admin()
      )
  )
);

create policy "lead_files_delete"
on storage.objects
for delete
using (
  bucket_id = 'lead-attachments'
  and exists (
    select 1
    from public.leads l
    where l.id::text = (storage.foldername(name))[1]::text
      and (
        l.access_user_id::text = auth.uid()::text
        or public.is_levecrm_admin()
      )
  )
);

-- PERFIL DO USUÁRIO
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;

create policy "profiles_self_select"
on public.profiles
for select
using (
  id::text = auth.uid()::text
  or public.is_levecrm_admin()
);

commit;

-- Treinova beta: make branding logo uploads compatible with Supabase Storage API.
-- New clients upload with upsert=false, but already-installed PWAs may still use
-- upsert=true and the legacy branding/logos folder. Those requests can require
-- select/update policies even when the generated filename is new.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists "branding read public" on storage.objects;
create policy "branding read public"
  on storage.objects
  for select
  using (bucket_id = 'branding');

drop policy if exists "branding update legacy logos for approved coach" on storage.objects;
create policy "branding update legacy logos for approved coach"
  on storage.objects
  for update
  using (
    bucket_id = 'branding'
    and public.is_coach(auth.uid())
    and (storage.foldername(name))[1] = 'logos'
  )
  with check (
    bucket_id = 'branding'
    and public.is_coach(auth.uid())
    and (storage.foldername(name))[1] = 'logos'
  );

-- Treinova beta: allow each approved coach to manage their own white-label logo.
-- This keeps public logo URLs working while scoping writes by trainer folder.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists "branding upload staff" on storage.objects;
drop policy if exists "branding update staff" on storage.objects;
drop policy if exists "branding delete staff" on storage.objects;

drop policy if exists "branding upload own coach logo or admin" on storage.objects;
create policy "branding upload own coach logo or admin"
  on storage.objects
  for insert
  with check (
    bucket_id = 'branding'
    and (
      public.is_admin(auth.uid())
      or (
        public.is_coach(auth.uid())
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

drop policy if exists "branding update own coach logo or admin" on storage.objects;
create policy "branding update own coach logo or admin"
  on storage.objects
  for update
  using (
    bucket_id = 'branding'
    and (
      public.is_admin(auth.uid())
      or (
        public.is_coach(auth.uid())
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'branding'
    and (
      public.is_admin(auth.uid())
      or (
        public.is_coach(auth.uid())
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

drop policy if exists "branding delete own coach logo or admin" on storage.objects;
create policy "branding delete own coach logo or admin"
  on storage.objects
  for delete
  using (
    bucket_id = 'branding'
    and (
      public.is_admin(auth.uid())
      or (
        public.is_coach(auth.uid())
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

-- Make coach_branding writable only by its owner coach or by admin.
alter table public.coach_branding enable row level security;

do $$
begin
  delete from public.coach_branding a
  using public.coach_branding b
  where a.coach_id = b.coach_id
    and a.ctid < b.ctid;

  create unique index if not exists coach_branding_coach_id_uidx
    on public.coach_branding (coach_id);
end $$;

drop policy if exists "coach_branding read auth" on public.coach_branding;
drop policy if exists "coach_branding read authenticated" on public.coach_branding;
create policy "coach_branding read authenticated"
  on public.coach_branding
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "coach_branding self manage" on public.coach_branding;
drop policy if exists "coach_branding coach insert own" on public.coach_branding;
create policy "coach_branding coach insert own"
  on public.coach_branding
  for insert
  with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coach_branding coach update own" on public.coach_branding;
create policy "coach_branding coach update own"
  on public.coach_branding
  for update
  using (coach_id = auth.uid() and public.is_coach(auth.uid()))
  with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coach_branding coach delete own" on public.coach_branding;
create policy "coach_branding coach delete own"
  on public.coach_branding
  for delete
  using (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coach_branding admin manage" on public.coach_branding;
drop policy if exists "coach_branding admin all" on public.coach_branding;
create policy "coach_branding admin all"
  on public.coach_branding
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

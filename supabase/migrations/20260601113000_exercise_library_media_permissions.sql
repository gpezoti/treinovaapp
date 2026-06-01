-- Treinova beta: unblock trainer-managed exercise library and media uploads.
-- Scope: library rows only (is_library = true) and public media bucket "exercises".

alter table public.exercises
  add column if not exists image_url text,
  add column if not exists video_url text,
  add column if not exists is_library boolean default false,
  add column if not exists muscle_group text;

create index if not exists exercises_library_search_idx
  on public.exercises (is_library, muscle_group, name)
  where is_library = true;

alter table public.exercises enable row level security;

drop policy if exists "exercises library read auth" on public.exercises;
create policy "exercises library read auth"
  on public.exercises
  for select
  using (
    auth.role() = 'authenticated'
    and is_library = true
  );

drop policy if exists "exercises library manage staff" on public.exercises;
create policy "exercises library manage staff"
  on public.exercises
  for all
  using (
    is_library = true
    and (
      public.is_admin(auth.uid())
      or public.is_coach(auth.uid())
    )
  )
  with check (
    is_library = true
    and workout_id is null
    and (
      public.is_admin(auth.uid())
      or public.is_coach(auth.uid())
    )
  );

insert into storage.buckets (id, name, public)
values ('exercises', 'exercises', true)
on conflict (id) do update set public = true;

drop policy if exists "exercise media staff upload" on storage.objects;
create policy "exercise media staff upload"
  on storage.objects
  for insert
  with check (
    bucket_id = 'exercises'
    and (
      public.is_admin(auth.uid())
      or public.is_coach(auth.uid())
    )
  );

drop policy if exists "exercise media staff update" on storage.objects;
create policy "exercise media staff update"
  on storage.objects
  for update
  using (
    bucket_id = 'exercises'
    and (
      public.is_admin(auth.uid())
      or public.is_coach(auth.uid())
    )
  )
  with check (
    bucket_id = 'exercises'
    and (
      public.is_admin(auth.uid())
      or public.is_coach(auth.uid())
    )
  );

drop policy if exists "exercise media staff delete" on storage.objects;
create policy "exercise media staff delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'exercises'
    and (
      public.is_admin(auth.uid())
      or public.is_coach(auth.uid())
    )
  );

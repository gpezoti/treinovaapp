-- Fotos de progresso: leitura apenas do proprio aluno, do treinador responsavel e do admin.
-- Mantem upload/exclusao restritos ao dono (ou admin) para evitar alteracoes indevidas.

alter table if exists public.progress_photos enable row level security;

drop policy if exists "progress read self or coach" on public.progress_photos;
drop policy if exists "progress read self coach or admin" on public.progress_photos;
drop policy if exists "progress_photos read scoped" on public.progress_photos;
create policy "progress read self coach or admin" on public.progress_photos
  for select using (
    auth.uid() = student_id
    or public.is_admin(auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = student_id
        and p.coach_id = auth.uid()
    )
  );

drop policy if exists "progress insert self" on public.progress_photos;
create policy "progress insert self" on public.progress_photos
  for insert with check (
    auth.uid() = student_id
  );

drop policy if exists "progress delete self or staff" on public.progress_photos;
drop policy if exists "progress delete self or coach" on public.progress_photos;
drop policy if exists "progress delete self or admin" on public.progress_photos;
create policy "progress delete self or admin" on public.progress_photos
  for delete using (
    auth.uid() = student_id
    or public.is_admin(auth.uid())
  );

update storage.buckets
set public = false
where id = 'progress';

drop policy if exists "progress_photos read all" on storage.objects;
drop policy if exists "progress read all" on storage.objects;
drop policy if exists "progress read self or coach" on storage.objects;
drop policy if exists "progress read self coach or admin" on storage.objects;
drop policy if exists "progress_photos read scoped" on storage.objects;
create policy "progress read self coach or admin" on storage.objects
  for select using (
    bucket_id = 'progress'
    and auth.uid() is not null
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
      or exists (
        select 1
        from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos upload own" on storage.objects;
drop policy if exists "progress upload own folder" on storage.objects;
create policy "progress upload own folder" on storage.objects
  for insert with check (
    bucket_id = 'progress'
    and auth.uid() is not null
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "progress_photos delete own" on storage.objects;
drop policy if exists "progress delete self or coach" on storage.objects;
drop policy if exists "progress delete self or admin" on storage.objects;
create policy "progress delete self or admin" on storage.objects
  for delete using (
    bucket_id = 'progress'
    and auth.uid() is not null
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

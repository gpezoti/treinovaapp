-- =============================================================================
-- Treinova beta security audit hardening - 2026-05-05
-- Idempotente. Rodar no Supabase SQL Editor antes do beta.
-- Objetivo: reforcar isolamento entre ADM MASTER, PROFESSOR e ALUNO.
-- =============================================================================

-- 1) Profiles: usuario nao pode autopromover role/status via REST.
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );

-- 2) Trigger: qualquer signup publico nasce como aluno pendente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'student',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3) Profiles: professor so le/edita seus alunos; admin ve tudo por policy propria.
drop policy if exists "profiles coach reads all" on public.profiles;
drop policy if exists "profiles coach reads own students" on public.profiles;
create policy "profiles coach reads own students" on public.profiles
  for select using (
    public.is_coach(auth.uid())
    and (
      id = auth.uid()
      or role = 'admin'
      or coach_id = auth.uid()
    )
  );

drop policy if exists "profiles approved students read each other" on public.profiles;
drop policy if exists "profiles students read same coach" on public.profiles;
create policy "profiles students read same coach" on public.profiles
  for select using (
    public.is_approved_student(auth.uid())
    and (
      id = auth.uid()
      or role = 'admin'
      or (
        coach_id is not null
        and coach_id = (select me.coach_id from public.profiles me where me.id = auth.uid())
      )
    )
  );

drop policy if exists "profiles coach updates students" on public.profiles;
drop policy if exists "profiles coach updates own students" on public.profiles;
create policy "profiles coach updates own students" on public.profiles
  for update
  using (
    public.is_coach(auth.uid())
    and role = 'student'
    and (coach_id = auth.uid() or coach_id is null)
  )
  with check (
    public.is_coach(auth.uid())
    and role = 'student'
    and coach_id = auth.uid()
  );

drop policy if exists "profiles coach delete students" on public.profiles;
drop policy if exists "profiles coach delete own students" on public.profiles;
create policy "profiles coach delete own students" on public.profiles
  for delete using (
    public.is_coach(auth.uid())
    and role = 'student'
    and coach_id = auth.uid()
  );

-- 4) Feed: remover leitura global por qualquer autenticado.
drop policy if exists "feed all auth read" on public.feed_posts;
drop policy if exists "feed student read" on public.feed_posts;
create policy "feed student read" on public.feed_posts
  for select using (
    public.is_approved_student(auth.uid())
    and (
      student_id = auth.uid()
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = feed_posts.student_id
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = feed_posts.student_id
          and p.coach_id = (select me.coach_id from public.profiles me where me.id = auth.uid())
          and p.coach_id is not null
      )
    )
  );

drop policy if exists "feed coach read" on public.feed_posts;
create policy "feed coach read" on public.feed_posts
  for select using (
    public.is_coach(auth.uid())
    and (
      student_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = feed_posts.student_id and p.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "feed admin read" on public.feed_posts;
create policy "feed admin read" on public.feed_posts
  for select using (public.is_admin(auth.uid()));

-- 5) Chat: validar relacao real antes de inserir mensagem.
create or replace function public.can_message_user(sender uuid, recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select id, role, status, coach_id from public.profiles where id = sender
  ), r as (
    select id, role, status, coach_id from public.profiles where id = recipient
  )
  select exists (
    select 1 from s, r
    where s.status = 'approved'
      and r.id is not null
      and sender <> recipient
      and (
        s.role = 'admin'
        or r.role = 'admin'
        or (s.role = 'coach' and r.role = 'student' and r.coach_id = s.id)
        or (s.role = 'student' and r.id = s.coach_id)
      )
  );
$$;

drop policy if exists "msgs insert from self" on public.messages;
create policy "msgs insert from self" on public.messages
  for insert with check (
    auth.uid() = from_user
    and public.can_message_user(from_user, to_user)
  );

drop policy if exists "msgs read pair" on public.messages;
create policy "msgs read pair" on public.messages
  for select using (
    auth.uid() = from_user
    or auth.uid() = to_user
    or public.is_staff(auth.uid())
  );

drop policy if exists "msgs update read" on public.messages;
create policy "msgs update read" on public.messages
  for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);

-- 6) Storage privado para mensagens e fotos de progresso.
update storage.buckets set public = false where id in ('messages', 'progress');

drop policy if exists "messages read all" on storage.objects;
drop policy if exists "messages read pair" on storage.objects;
create policy "messages read pair" on storage.objects
  for select using (
    bucket_id = 'messages'
    and auth.uid() is not null
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_staff(auth.uid())
      or exists (
        select 1 from public.messages m
        where m.to_user = auth.uid()
          and position(name in coalesce(m.image_url, '')) > 0
      )
    )
  );

drop policy if exists "messages upload auth" on storage.objects;
create policy "messages upload auth" on storage.objects
  for insert with check (
    bucket_id = 'messages'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

alter table public.progress_photos add column if not exists storage_path text;

drop policy if exists "progress_photos read all" on storage.objects;
drop policy if exists "progress_photos read scoped" on storage.objects;
create policy "progress_photos read scoped" on storage.objects
  for select using (
    bucket_id = 'progress'
    and auth.uid() is not null
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_staff(auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos upload own" on storage.objects;
create policy "progress_photos upload own" on storage.objects
  for insert with check (
    bucket_id = 'progress'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "progress_photos delete own" on storage.objects;
create policy "progress_photos delete own" on storage.objects
  for delete using (
    bucket_id = 'progress'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_staff(auth.uid())
    )
  );

-- 7) Views sensiveis: rodar com permissoes/RLS do chamante sempre que suportado.
alter view if exists public.v_coach_student_summary set (security_invoker = true);
alter view if exists public.v_chat_threads set (security_invoker = true);
alter view if exists public.v_coach_payments set (security_invoker = true);
alter view if exists public.v_admin_payments set (security_invoker = true);
alter view if exists public.v_weekly_volume set (security_invoker = true);
alter view if exists public.v_weekly_ranking set (security_invoker = true);
alter view if exists public.v_load_history set (security_invoker = true);
alter view if exists public.v_last_load set (security_invoker = true);

revoke select on public.v_last_load from anon;
grant select on public.v_last_load to authenticated;

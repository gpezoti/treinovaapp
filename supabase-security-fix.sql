-- =============================================================================
-- supabase-security-fix.sql — Migration 9
-- Correções de segurança do QA Report (bugs C-01 a C-05, A-01)
-- Idempotente: todos os DROP POLICY IF EXISTS antes de CREATE POLICY
-- Pré-requisito: supabase-fix-rls.sql já aplicado em prod
-- =============================================================================

-- =============================================================================
-- PAY-M01: Guard — garante que workouts.student_id existe antes de criar a policy
-- A coluna é adicionada em supabase-admin-migration.sql; se rodar fora de ordem
-- em banco fresh, a policy "workouts auth read" falharia silenciosamente.
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'workouts'
      and column_name  = 'student_id'
  ) then
    alter table public.workouts
      add column student_id uuid references public.profiles(id) on delete cascade;
    create index if not exists workouts_student_idx on public.workouts(student_id);
  end if;
end $$;

-- =============================================================================
-- C-01: Bloqueia mudança de role/status/coach_id pelo próprio usuário
-- Bug: policy "profiles self update" sem WITH CHECK permitia PATCH de role/status via API
-- =============================================================================
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role     = (select role     from public.profiles where id = auth.uid())
    and status   = (select status   from public.profiles where id = auth.uid())
    and coach_id is not distinct from (select coach_id from public.profiles where id = auth.uid())
  );

-- =============================================================================
-- C-04: Trigger ignora role do metadata — todos entram como student pending
-- Bug: handle_new_user aceitava role='coach'/'admin' do metadata do signup
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'student',  -- SEMPRE student — promoção é feita por admin/coach via update
    'pending'   -- SEMPRE pending — aprovação é explícita
  );
  return new;
end;
$$;
-- ATENÇÃO: após aplicar, coaches existentes em prod NÃO são afetados (já têm profile).
-- Se o banco for resetado do zero, promover coaches manualmente:
--   update public.profiles set role='coach', status='approved' where email='<coach@email>';
-- O gpezoti já é admin pela migration supabase-admin-migration.sql.

-- =============================================================================
-- C-02: RLS real no Feed por role
-- Bug: "feed all auth read" permitia que qualquer autenticado lesse todos os posts via API
-- =============================================================================
drop policy if exists "feed all auth read" on public.feed_posts;
drop policy if exists "feed student read"  on public.feed_posts;
drop policy if exists "feed coach read"    on public.feed_posts;
drop policy if exists "feed admin read"    on public.feed_posts;

create policy "feed student read" on public.feed_posts
  for select using (
    public.is_approved_student(auth.uid())
    and (
      student_id = auth.uid()
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = student_id
      )
      or exists (
        select 1 from public.profiles me
        join public.profiles author on author.id = student_id
        where me.id = auth.uid() and author.coach_id = me.coach_id
          and me.coach_id is not null
      )
    )
  );

create policy "feed coach read" on public.feed_posts
  for select using (
    public.is_coach(auth.uid())
    and (
      student_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = student_id and p.coach_id = auth.uid()
      )
    )
  );

create policy "feed admin read" on public.feed_posts
  for select using (public.is_admin(auth.uid()));

-- =============================================================================
-- C-05: Bucket messages privado + leitura restrita ao par da conversa
-- Bug: bucket "messages" era público — imagens acessíveis sem autenticação
-- =============================================================================
update storage.buckets set public = false where id = 'messages';

drop policy if exists "messages read all"  on storage.objects;
drop policy if exists "messages read pair" on storage.objects;
create policy "messages read pair" on storage.objects
  for select using (
    bucket_id = 'messages'
    and auth.uid() is not null
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_staff(auth.uid())
    )
  );

-- =============================================================================
-- A-01: Workouts com isolamento por coach
-- Bug: "workouts auth read" permitia coaches lerem workouts de outros coaches
-- =============================================================================
drop policy if exists "workouts auth read" on public.workouts;
create policy "workouts auth read" on public.workouts
  for select using (
    is_global = true                      -- qualquer autenticado vê globals
    or coach_id = auth.uid()              -- coach vê seus próprios
    or student_id = auth.uid()            -- aluno vê o customizado dele
    or public.is_admin(auth.uid())        -- admin vê tudo
  );

-- Revogar grant desnecessário para anon na view v_last_load
revoke select on public.v_last_load from anon;
grant  select on public.v_last_load to authenticated;

-- =============================================================================
-- VERIFICAÇÃO — rode após aplicar
-- =============================================================================
-- select policyname, tablename, cmd from pg_policies
-- where schemaname = 'public'
--   and tablename in ('profiles','feed_posts','workouts')
-- order by tablename, policyname;
--
-- select id, public from storage.buckets where id = 'messages';
-- =============================================================================

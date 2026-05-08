-- =============================================================================
-- Treinova - fix profiles RLS recursion + admin trainer management
-- 2026-05-07
--
-- Corrige "infinite recursion detected in policy for relation profiles".
-- Motivo: policies de public.profiles consultavam public.profiles dentro da
-- propria policy. As funcoes SECURITY DEFINER abaixo centralizam essa leitura
-- sem passar pelo RLS do usuario logado.
-- =============================================================================

create or replace function public.app_profile_role(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = uid
$$;

create or replace function public.app_profile_status(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.status from public.profiles p where p.id = uid
$$;

create or replace function public.app_profile_coach_id(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.coach_id from public.profiles p where p.id = uid
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin' and p.status = 'approved'
  )
$$;

create or replace function public.is_coach(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'coach' and p.status = 'approved'
  )
$$;

create or replace function public.is_approved_student(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'student' and p.status = 'approved'
  )
$$;

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(uid) or public.is_coach(uid)
$$;

grant execute on function public.app_profile_role(uuid) to authenticated, service_role;
grant execute on function public.app_profile_status(uuid) to authenticated, service_role;
grant execute on function public.app_profile_coach_id(uuid) to authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
grant execute on function public.is_coach(uuid) to authenticated, service_role;
grant execute on function public.is_approved_student(uuid) to authenticated, service_role;
grant execute on function public.is_staff(uuid) to authenticated, service_role;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles admin read all" on public.profiles;
create policy "profiles admin read all"
  on public.profiles
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "profiles admin update all" on public.profiles;
create policy "profiles admin update all"
  on public.profiles
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "profiles admin delete all" on public.profiles;
create policy "profiles admin delete all"
  on public.profiles
  for delete
  using (public.is_admin(auth.uid()));

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = public.app_profile_role(auth.uid())
    and status = public.app_profile_status(auth.uid())
  );

drop policy if exists "profiles coach reads all" on public.profiles;
drop policy if exists "profiles coach reads own students" on public.profiles;
create policy "profiles coach reads own students"
  on public.profiles
  for select
  using (
    public.is_coach(auth.uid())
    and (
      id = auth.uid()
      or role = 'admin'
      or coach_id = auth.uid()
    )
  );

drop policy if exists "profiles approved students read each other" on public.profiles;
drop policy if exists "profiles students read same coach" on public.profiles;
create policy "profiles students read same coach"
  on public.profiles
  for select
  using (
    public.is_approved_student(auth.uid())
    and (
      id = auth.uid()
      or role = 'admin'
      or (
        coach_id is not null
        and coach_id = public.app_profile_coach_id(auth.uid())
      )
    )
  );

drop policy if exists "profiles coach updates students" on public.profiles;
drop policy if exists "profiles coach updates own students" on public.profiles;
create policy "profiles coach updates own students"
  on public.profiles
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
create policy "profiles coach delete own students"
  on public.profiles
  for delete
  using (
    public.is_coach(auth.uid())
    and role = 'student'
    and coach_id = auth.uid()
  );

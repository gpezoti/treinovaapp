-- Treinova beta: social feed + coach self-training
-- Objetivo:
-- 1) permitir busca social por qualquer perfil aprovado;
-- 2) fazer professor seguir automaticamente todos os seus alunos aprovados;
-- 3) permitir que professor use periodizacao/sessoes como aluno dele mesmo.

-- Perfis descobríveis no social: somente aprovados, sem expor dados sensíveis no frontend.
drop policy if exists "profiles approved social discovery" on public.profiles;
create policy "profiles approved social discovery"
  on public.profiles
  for select
  using (
    auth.uid() is not null
    and status = 'approved'
  );

-- Follows: o usuário gerencia quem ele segue. Leituras permitem contadores/listas.
alter table public.follows enable row level security;

drop policy if exists "follows read own graph" on public.follows;
create policy "follows read own graph"
  on public.follows
  for select
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "follows insert self" on public.follows;
create policy "follows insert self"
  on public.follows
  for insert
  with check (
    follower_id = auth.uid()
    and following_id <> auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = following_id
        and p.status = 'approved'
    )
  );

drop policy if exists "follows delete self" on public.follows;
create policy "follows delete self"
  on public.follows
  for delete
  using (
    follower_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- Professor segue aluno aprovado automaticamente.
create or replace function public.sync_coach_student_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' and new.status = 'approved' and new.coach_id is not null then
    insert into public.follows (follower_id, following_id)
    values (new.coach_id, new.id)
    on conflict (follower_id, following_id) do nothing;
  end if;

  if tg_op = 'UPDATE'
     and old.coach_id is distinct from new.coach_id
     and old.coach_id is not null then
    delete from public.follows
    where follower_id = old.coach_id
      and following_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_coach_student_follow on public.profiles;
create trigger trg_profiles_sync_coach_student_follow
after insert or update of coach_id, status, role on public.profiles
for each row
execute function public.sync_coach_student_follow();

insert into public.follows (follower_id, following_id)
select p.coach_id, p.id
from public.profiles p
where p.role = 'student'
  and p.status = 'approved'
  and p.coach_id is not null
on conflict (follower_id, following_id) do nothing;

-- Feed: leitura segue grafo social. Coach continua com fallback dos próprios alunos.
drop policy if exists "feed student read" on public.feed_posts;
drop policy if exists "feed coach read" on public.feed_posts;
drop policy if exists "feed admin read" on public.feed_posts;
drop policy if exists "feed social read" on public.feed_posts;
create policy "feed social read"
  on public.feed_posts
  for select
  using (
    public.is_admin(auth.uid())
    or student_id = auth.uid()
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = feed_posts.student_id
    )
    or (
      public.is_coach(auth.uid())
      and exists (
        select 1 from public.profiles s
        where s.id = feed_posts.student_id
          and s.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "feed insert own" on public.feed_posts;
create policy "feed insert own"
  on public.feed_posts
  for insert
  with check (student_id = auth.uid());

drop policy if exists "feed delete own or coach" on public.feed_posts;
create policy "feed delete own or coach"
  on public.feed_posts
  for delete
  using (
    student_id = auth.uid()
    or public.is_admin(auth.uid())
    or (
      public.is_coach(auth.uid())
      and exists (
        select 1 from public.profiles s
        where s.id = feed_posts.student_id
          and s.coach_id = auth.uid()
      )
    )
  );

-- Workouts: professor pode treinar com seus próprios treinos, além de gerenciar alunos.
drop policy if exists "workouts auth read" on public.workouts;
create policy "workouts auth read"
  on public.workouts
  for select
  using (
    (is_global = true and student_id is null)
    or public.is_admin(auth.uid())
    or student_id = auth.uid()
    or coach_id = auth.uid()
    or (
      public.is_coach(auth.uid())
      and exists (
        select 1 from public.profiles s
        where s.id = workouts.student_id and s.coach_id = auth.uid()
      )
    )
    or (
      exists (
        select 1 from public.profiles s
        where s.id = auth.uid()
          and s.coach_id = workouts.coach_id
          and workouts.student_id is null
      )
    )
  );

-- Periodizacao: professor pode gerenciar a própria periodização e a dos alunos.
drop policy if exists "periodization days self read" on public.periodization_days;
drop policy if exists "periodization days self manage" on public.periodization_days;
drop policy if exists "periodization days coach manage" on public.periodization_days;
create policy "periodization days self read"
  on public.periodization_days
  for select
  using (
    student_id = auth.uid()
    or public.is_admin(auth.uid())
    or (
      public.is_coach(auth.uid())
      and exists (
        select 1 from public.profiles s
        where s.id = periodization_days.student_id
          and (s.coach_id = auth.uid() or s.id = auth.uid())
      )
    )
  );
create policy "periodization days self manage"
  on public.periodization_days
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
create policy "periodization days coach manage"
  on public.periodization_days
  for all
  using (
    public.is_coach(auth.uid())
    and exists (
      select 1 from public.profiles s
      where s.id = periodization_days.student_id
        and (s.coach_id = auth.uid() or s.id = auth.uid())
    )
  )
  with check (
    public.is_coach(auth.uid())
    and exists (
      select 1 from public.profiles s
      where s.id = periodization_days.student_id
        and (s.coach_id = auth.uid() or s.id = auth.uid())
    )
  );

drop policy if exists "periodization blocks scoped read" on public.periodization_blocks;
drop policy if exists "periodization blocks scoped manage" on public.periodization_blocks;
create policy "periodization blocks scoped read"
  on public.periodization_blocks
  for select
  using (
    exists (
      select 1 from public.periodization_days d
      where d.id = periodization_blocks.day_id
        and (
          d.student_id = auth.uid()
          or public.is_admin(auth.uid())
          or (
            public.is_coach(auth.uid())
            and exists (
              select 1 from public.profiles s
              where s.id = d.student_id
                and (s.coach_id = auth.uid() or s.id = auth.uid())
            )
          )
        )
    )
  );
create policy "periodization blocks scoped manage"
  on public.periodization_blocks
  for all
  using (
    exists (
      select 1 from public.periodization_days d
      where d.id = periodization_blocks.day_id
        and (
          d.student_id = auth.uid()
          or public.is_admin(auth.uid())
          or (
            public.is_coach(auth.uid())
            and exists (
              select 1 from public.profiles s
              where s.id = d.student_id
                and (s.coach_id = auth.uid() or s.id = auth.uid())
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.periodization_days d
      where d.id = periodization_blocks.day_id
        and (
          d.student_id = auth.uid()
          or public.is_admin(auth.uid())
          or (
            public.is_coach(auth.uid())
            and exists (
              select 1 from public.profiles s
              where s.id = d.student_id
                and (s.coach_id = auth.uid() or s.id = auth.uid())
            )
          )
        )
    )
  );

-- Sessoes e cargas: professor registra o próprio treino como student_id = auth.uid().
drop policy if exists "sessions self manage" on public.sessions;
create policy "sessions self manage"
  on public.sessions
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "setlogs self manage" on public.set_logs;
create policy "setlogs self manage"
  on public.set_logs
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

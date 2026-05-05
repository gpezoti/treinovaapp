-- beta_rls_hardening.sql
-- Correcoes de isolamento para beta: professores so acessam dados dos proprios alunos.
-- Idempotente. Rodar no Supabase SQL Editor antes do deploy do frontend.

-- Perfis: restringe leitura ampla de professores e impede update em alunos de outro professor.
drop policy if exists "profiles coach reads all" on public.profiles;
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
create policy "profiles students read same coach" on public.profiles
  for select using (
    status = 'approved'
    and public.is_approved_student(auth.uid())
    and (
      id = auth.uid()
      or (
        coach_id is not null
        and coach_id = (select me.coach_id from public.profiles me where me.id = auth.uid())
      )
    )
  );

drop policy if exists "profiles coach updates students" on public.profiles;
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

-- Workouts: professor ve/gerencia globais proprios e personalizados dos proprios alunos.
drop policy if exists "workouts auth read" on public.workouts;
create policy "workouts auth read" on public.workouts
  for select using (
    (is_global = true and student_id is null)
    or public.is_admin(auth.uid())
    or student_id = auth.uid()
    or (
      public.is_coach(auth.uid())
      and (
        coach_id = auth.uid()
        or exists (
          select 1 from public.profiles s
          where s.id = workouts.student_id and s.coach_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "workouts coach insert" on public.workouts;
create policy "workouts coach insert" on public.workouts
  for insert with check (
    public.is_coach(auth.uid())
    and (
      (student_id is null and (coach_id = auth.uid() or is_global = true))
      or exists (
        select 1 from public.profiles s
        where s.id = student_id and s.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "workouts coach update" on public.workouts;
create policy "workouts coach update" on public.workouts
  for update
  using (
    public.is_coach(auth.uid())
    and (
      coach_id = auth.uid()
      or exists (
        select 1 from public.profiles s
        where s.id = workouts.student_id and s.coach_id = auth.uid()
      )
    )
  )
  with check (
    public.is_coach(auth.uid())
    and (
      coach_id = auth.uid()
      or exists (
        select 1 from public.profiles s
        where s.id = workouts.student_id and s.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "workouts coach delete" on public.workouts;
create policy "workouts coach delete" on public.workouts
  for delete using (
    public.is_coach(auth.uid())
    and (
      coach_id = auth.uid()
      or exists (
        select 1 from public.profiles s
        where s.id = workouts.student_id and s.coach_id = auth.uid()
      )
    )
  );

-- Exercises: leitura e gestao seguem o escopo do workout vinculado ou biblioteca.
drop policy if exists "exercises auth read" on public.exercises;
create policy "exercises scoped read" on public.exercises
  for select using (
    is_library = true
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.workouts w
      where w.id = exercises.workout_id
        and (
          (w.is_global = true and w.student_id is null)
          or w.student_id = auth.uid()
          or (
            public.is_coach(auth.uid())
            and (
              w.coach_id = auth.uid()
              or exists (
                select 1 from public.profiles s
                where s.id = w.student_id and s.coach_id = auth.uid()
              )
            )
          )
        )
    )
  );

drop policy if exists "exercises coach manage" on public.exercises;
create policy "exercises coach manage own workouts" on public.exercises
  for all
  using (
    public.is_coach(auth.uid())
    and (
      is_library = true
      or exists (
        select 1 from public.workouts w
        where w.id = exercises.workout_id
          and (
            w.coach_id = auth.uid()
            or exists (
              select 1 from public.profiles s
              where s.id = w.student_id and s.coach_id = auth.uid()
            )
          )
      )
    )
  )
  with check (
    public.is_coach(auth.uid())
    and (
      is_library = true
      or exists (
        select 1 from public.workouts w
        where w.id = exercises.workout_id
          and (
            w.coach_id = auth.uid()
            or exists (
              select 1 from public.profiles s
              where s.id = w.student_id and s.coach_id = auth.uid()
            )
          )
      )
    )
  );

-- Historico de treino: professor le apenas sessoes e series dos seus alunos.
drop policy if exists "sessions coach read" on public.sessions;
create policy "sessions coach read own students" on public.sessions
  for select using (
    public.is_coach(auth.uid())
    and exists (
      select 1 from public.profiles s
      where s.id = sessions.student_id and s.coach_id = auth.uid()
    )
  );

drop policy if exists "setlogs coach read" on public.set_logs;
create policy "setlogs coach read own students" on public.set_logs
  for select using (
    public.is_coach(auth.uid())
    and exists (
      select 1 from public.profiles s
      where s.id = set_logs.student_id and s.coach_id = auth.uid()
    )
  );

-- RPC de clone: novo workout personalizado deve ficar vinculado ao professor do aluno.
create or replace function public.clone_workout_for_student(p_workout uuid, p_student uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  student_coach uuid;
begin
  select coach_id into student_coach from public.profiles where id = p_student and role = 'student';

  if not (public.is_admin(auth.uid()) or student_coach = auth.uid()) then
    raise exception 'forbidden';
  end if;

  insert into public.workouts (coach_id, code, name, focus, color, is_global, student_id)
    select coalesce(student_coach, auth.uid()), code, name, focus, color, false, p_student
    from public.workouts w
    where w.id = p_workout
      and (
        public.is_admin(auth.uid())
        or w.is_global = true
        or w.coach_id = auth.uid()
        or exists (
          select 1 from public.profiles s
          where s.id = w.student_id and s.coach_id = auth.uid()
        )
      )
    returning id into new_id;

  if new_id is null then
    raise exception 'workout not found or forbidden';
  end if;

  insert into public.exercises (workout_id, position, name, cat, sets_count, reps, pause, cadence, method, observations, image_url, video_url, muscle_group, is_library)
    select new_id, position, name, cat, sets_count, reps, pause, cadence, method, observations, image_url, video_url, muscle_group, false
    from public.exercises where workout_id = p_workout;

  return new_id;
end;
$$;

grant execute on function public.clone_workout_for_student(uuid, uuid) to authenticated;

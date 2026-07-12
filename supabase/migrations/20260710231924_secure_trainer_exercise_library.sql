-- Isola exercícios personalizados por treinador e remove policies amplas antigas.
-- Linhas existentes continuam globais (owner_coach_id = null) e permanecem
-- disponíveis para todos os treinadores, sem alterar treinos já montados.

alter table public.exercises
  add column if not exists owner_coach_id uuid
  references public.profiles(id) on delete set null;

create index if not exists exercises_library_owner_name_idx
  on public.exercises (owner_coach_id, name)
  where is_library = true;

create index if not exists exercises_workout_id_idx
  on public.exercises (workout_id)
  where workout_id is not null;

alter table public.exercises enable row level security;

drop policy if exists "exercises admin manage" on public.exercises;
drop policy if exists "exercises auth read" on public.exercises;
drop policy if exists "exercises scoped read" on public.exercises;
drop policy if exists "exercises coach manage" on public.exercises;
drop policy if exists "exercises coach manage own workouts" on public.exercises;
drop policy if exists "exercises library manage staff" on public.exercises;
drop policy if exists "exercises library read auth" on public.exercises;
drop policy if exists "exercises select scoped" on public.exercises;
drop policy if exists "exercises coach manage workout rows" on public.exercises;
drop policy if exists "exercises coach insert own library" on public.exercises;
drop policy if exists "exercises coach update own library" on public.exercises;
drop policy if exists "exercises coach delete own library" on public.exercises;

create policy "exercises select scoped"
  on public.exercises
  for select
  to authenticated
  using (
    (select public.is_admin((select auth.uid())))
    or (
      is_library = true
      and (
        owner_coach_id is null
        or owner_coach_id = (select auth.uid())
      )
    )
    or (
      coalesce(is_library, false) = false
      and exists (
        select 1
        from public.workouts w
        where w.id = exercises.workout_id
          and (
            w.student_id = (select auth.uid())
            or (
              (select public.is_coach((select auth.uid())))
              and (
                w.coach_id = (select auth.uid())
                or exists (
                  select 1
                  from public.profiles student
                  where student.id = w.student_id
                    and student.coach_id = (select auth.uid())
                )
              )
            )
            or exists (
              select 1
              from public.profiles viewer
              where viewer.id = (select auth.uid())
                and viewer.role = 'student'
                and viewer.coach_id = w.coach_id
                and w.student_id is null
            )
          )
      )
    )
  );

create policy "exercises admin manage"
  on public.exercises
  for all
  to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "exercises coach manage workout rows"
  on public.exercises
  for all
  to authenticated
  using (
    coalesce(is_library, false) = false
    and (select public.is_coach((select auth.uid())))
    and exists (
      select 1
      from public.workouts w
      where w.id = exercises.workout_id
        and (
          w.coach_id = (select auth.uid())
          or exists (
            select 1
            from public.profiles student
            where student.id = w.student_id
              and student.coach_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    coalesce(is_library, false) = false
    and owner_coach_id is null
    and (select public.is_coach((select auth.uid())))
    and exists (
      select 1
      from public.workouts w
      where w.id = exercises.workout_id
        and (
          w.coach_id = (select auth.uid())
          or exists (
            select 1
            from public.profiles student
            where student.id = w.student_id
              and student.coach_id = (select auth.uid())
          )
        )
    )
  );

create policy "exercises coach insert own library"
  on public.exercises
  for insert
  to authenticated
  with check (
    is_library = true
    and workout_id is null
    and student_id is null
    and owner_coach_id = (select auth.uid())
    and (select public.is_coach((select auth.uid())))
  );

create policy "exercises coach update own library"
  on public.exercises
  for update
  to authenticated
  using (
    is_library = true
    and owner_coach_id = (select auth.uid())
    and (select public.is_coach((select auth.uid())))
  )
  with check (
    is_library = true
    and workout_id is null
    and student_id is null
    and owner_coach_id = (select auth.uid())
    and (select public.is_coach((select auth.uid())))
  );

create policy "exercises coach delete own library"
  on public.exercises
  for delete
  to authenticated
  using (
    is_library = true
    and owner_coach_id = (select auth.uid())
    and (select public.is_coach((select auth.uid())))
  );

-- Novos uploads ficam em /<auth.uid()>/<exercise_id>/arquivo.
drop policy if exists "exercise media staff upload" on storage.objects;
drop policy if exists "exercise media staff update" on storage.objects;
drop policy if exists "exercise media staff delete" on storage.objects;
drop policy if exists "exercises upload staff" on storage.objects;
drop policy if exists "exercises update staff" on storage.objects;
drop policy if exists "exercises delete staff" on storage.objects;
drop policy if exists "exercise media coach upload own" on storage.objects;
drop policy if exists "exercise media coach update own" on storage.objects;
drop policy if exists "exercise media coach delete own" on storage.objects;
drop policy if exists "exercise media admin manage" on storage.objects;

create policy "exercise media coach upload own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'exercises'
    and (select public.is_coach((select auth.uid())))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "exercise media coach update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'exercises'
    and (select public.is_coach((select auth.uid())))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'exercises'
    and (select public.is_coach((select auth.uid())))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "exercise media coach delete own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'exercises'
    and (select public.is_coach((select auth.uid())))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "exercise media admin manage"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'exercises'
    and (select public.is_admin((select auth.uid())))
  )
  with check (
    bucket_id = 'exercises'
    and (select public.is_admin((select auth.uid())))
  );

-- Uma policy por operação evita avaliações permissivas redundantes sem alterar
-- as regras aplicadas pela migration anterior.

create index if not exists exercises_student_id_idx
  on public.exercises (student_id)
  where student_id is not null;

drop policy if exists "exercises admin manage" on public.exercises;
drop policy if exists "exercises coach manage workout rows" on public.exercises;
drop policy if exists "exercises coach insert own library" on public.exercises;
drop policy if exists "exercises coach update own library" on public.exercises;
drop policy if exists "exercises coach delete own library" on public.exercises;
drop policy if exists "exercises insert scoped" on public.exercises;
drop policy if exists "exercises update scoped" on public.exercises;
drop policy if exists "exercises delete scoped" on public.exercises;

create policy "exercises insert scoped"
  on public.exercises
  for insert
  to authenticated
  with check (
    (select public.is_admin((select auth.uid())))
    or (
      (select public.is_coach((select auth.uid())))
      and (
        (
          is_library = true
          and workout_id is null
          and student_id is null
          and owner_coach_id = (select auth.uid())
        )
        or (
          coalesce(is_library, false) = false
          and owner_coach_id is null
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
      )
    )
  );

create policy "exercises update scoped"
  on public.exercises
  for update
  to authenticated
  using (
    (select public.is_admin((select auth.uid())))
    or (
      (select public.is_coach((select auth.uid())))
      and (
        (is_library = true and owner_coach_id = (select auth.uid()))
        or (
          coalesce(is_library, false) = false
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
      )
    )
  )
  with check (
    (select public.is_admin((select auth.uid())))
    or (
      (select public.is_coach((select auth.uid())))
      and (
        (
          is_library = true
          and workout_id is null
          and student_id is null
          and owner_coach_id = (select auth.uid())
        )
        or (
          coalesce(is_library, false) = false
          and owner_coach_id is null
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
      )
    )
  );

create policy "exercises delete scoped"
  on public.exercises
  for delete
  to authenticated
  using (
    (select public.is_admin((select auth.uid())))
    or (
      (select public.is_coach((select auth.uid())))
      and (
        (is_library = true and owner_coach_id = (select auth.uid()))
        or (
          coalesce(is_library, false) = false
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
      )
    )
  );

drop policy if exists "exercise media coach upload own" on storage.objects;
drop policy if exists "exercise media coach update own" on storage.objects;
drop policy if exists "exercise media coach delete own" on storage.objects;
drop policy if exists "exercise media admin manage" on storage.objects;
drop policy if exists "exercise media insert scoped" on storage.objects;
drop policy if exists "exercise media update scoped" on storage.objects;
drop policy if exists "exercise media delete scoped" on storage.objects;

create policy "exercise media insert scoped"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'exercises'
    and (
      (select public.is_admin((select auth.uid())))
      or (
        (select public.is_coach((select auth.uid())))
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  );

create policy "exercise media update scoped"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'exercises'
    and (
      (select public.is_admin((select auth.uid())))
      or (
        (select public.is_coach((select auth.uid())))
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  )
  with check (
    bucket_id = 'exercises'
    and (
      (select public.is_admin((select auth.uid())))
      or (
        (select public.is_coach((select auth.uid())))
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  );

create policy "exercise media delete scoped"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'exercises'
    and (
      (select public.is_admin((select auth.uid())))
      or (
        (select public.is_coach((select auth.uid())))
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  );

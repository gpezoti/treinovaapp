-- Treinova beta: professor-created workout types
-- Allows a coach to create reusable workout types that are visible only to
-- the coach and that coach's own students.

alter table public.workouts
  add column if not exists coach_id uuid references public.profiles(id),
  add column if not exists is_global boolean default false,
  add column if not exists student_id uuid references public.profiles(id);

create index if not exists workouts_coach_idx on public.workouts(coach_id);
create index if not exists workouts_student_idx on public.workouts(student_id);

drop policy if exists "workouts auth read" on public.workouts;
create policy "workouts auth read" on public.workouts
  for select using (
    public.is_admin(auth.uid())
    or student_id = auth.uid()
    or (is_global = true and student_id is null and coach_id is null)
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
    or (
      exists (
        select 1 from public.profiles s
        where s.id = auth.uid()
          and s.role = 'student'
          and s.coach_id = workouts.coach_id
          and workouts.student_id is null
      )
    )
  );

drop policy if exists "workouts coach insert" on public.workouts;
create policy "workouts coach insert" on public.workouts
  for insert with check (
    public.is_coach(auth.uid())
    and (
      (student_id is null and coach_id = auth.uid() and coalesce(is_global, false) = false)
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

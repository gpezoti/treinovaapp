-- Cache request-invariant identity and role checks once per statement. These
-- policies preserve the existing ownership, coach-student, payment and admin
-- rules while avoiding repeated auth helper evaluation for every scanned row.

alter policy "profiles admin delete all" on public.profiles
  using ((select is_admin((select auth.uid()))));

alter policy "profiles admin read all" on public.profiles
  using ((select is_admin((select auth.uid()))));

alter policy "profiles admin update all" on public.profiles
  using ((select is_admin((select auth.uid()))))
  with check ((select is_admin((select auth.uid()))));

alter policy "profiles coach delete own students" on public.profiles
  using (
    (select is_coach((select auth.uid())))
    and role = 'student'
    and coach_id = (select auth.uid())
  );

alter policy "profiles coach reads own students" on public.profiles
  using (
    (select is_coach((select auth.uid())))
    and (
      id = (select auth.uid())
      or role = 'admin'
      or coach_id = (select auth.uid())
    )
  );

alter policy "profiles coach updates own students" on public.profiles
  using (
    (select is_coach((select auth.uid())))
    and role = 'student'
    and (coach_id = (select auth.uid()) or coach_id is null)
  )
  with check (
    (select is_coach((select auth.uid())))
    and role = 'student'
    and coach_id = (select auth.uid())
  );

alter policy "profiles self read" on public.profiles
  using ((select auth.uid()) = id);

alter policy "profiles self update" on public.profiles
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role = (select app_profile_role((select auth.uid())))
    and status = (select app_profile_status((select auth.uid())))
  );

alter policy "profiles social scoped read" on public.profiles
  using (can_social_discover((select auth.uid()), id, true));

alter policy "sessions self manage" on public.sessions
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

alter policy "setlogs self manage" on public.set_logs
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

alter policy "workouts auth read" on public.workouts
  using (
    ((is_global = true) and (student_id is null))
    or (select is_admin((select auth.uid())))
    or student_id = (select auth.uid())
    or coach_id = (select auth.uid())
    or (
      (select is_coach((select auth.uid())))
      and exists (
        select 1
        from public.profiles s
        where s.id = workouts.student_id
          and s.coach_id = (select auth.uid())
      )
    )
    or exists (
      select 1
      from public.profiles s
      where s.id = (select auth.uid())
        and s.coach_id = workouts.coach_id
        and workouts.student_id is null
    )
  );

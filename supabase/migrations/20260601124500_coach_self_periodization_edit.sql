-- Treinova beta: allow PROFESSOR to edit his own periodization after creation.
-- Also hardens week RPCs so an authenticated user cannot mutate another profile's
-- periodization by passing an arbitrary student id.

create or replace function public.can_manage_periodization_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin(auth.uid())
      or (
        p_student_id = auth.uid()
        and public.is_coach(auth.uid())
      )
      or (
        public.is_coach(auth.uid())
        and exists (
          select 1
          from public.profiles s
          where s.id = p_student_id
            and s.role = 'student'
            and s.coach_id = auth.uid()
        )
      )
    );
$$;

grant execute on function public.can_manage_periodization_student(uuid) to authenticated;

create or replace function public.ensure_coach_owns_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.can_manage_periodization_student(p_student_id) then
    raise exception 'Você não tem permissão para editar esta periodização.';
  end if;
end;
$$;

grant execute on function public.ensure_coach_owns_student(uuid) to authenticated;

create or replace function public.add_periodization_week(p_student_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  last_date date;
  i int;
  new_day_id uuid;
  inserted int := 0;
begin
  perform public.ensure_coach_owns_student(p_student_id);

  select max(date) into last_date
  from public.periodization_days
  where student_id = p_student_id;

  if last_date is null then
    last_date := current_date - 1;
  end if;

  for i in 1..7 loop
    new_day_id := null;

    insert into public.periodization_days (student_id, date, workout_code, intensity, aero)
    values (p_student_id, last_date + i, 'OFF', 'off', false)
    on conflict (student_id, date) do nothing
    returning id into new_day_id;

    if new_day_id is not null then
      inserted := inserted + 1;
      insert into public.periodization_blocks (day_id, position, preset_code, workout_code)
      values (new_day_id, 0, 'off', null);
    end if;
  end loop;

  return inserted;
end;
$$;

grant execute on function public.add_periodization_week(uuid) to authenticated;

create or replace function public.remove_periodization_week(p_student_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  perform public.ensure_coach_owns_student(p_student_id);

  delete from public.periodization_days
  where id in (
    select id
    from public.periodization_days
    where student_id = p_student_id
    order by date desc
    limit 7
  );

  get diagnostics removed = row_count;
  return removed;
end;
$$;

grant execute on function public.remove_periodization_week(uuid) to authenticated;

drop policy if exists "periodization days coach self edit" on public.periodization_days;
create policy "periodization days coach self edit"
  on public.periodization_days
  for all
  using (public.can_manage_periodization_student(student_id))
  with check (public.can_manage_periodization_student(student_id));

drop policy if exists "periodization blocks coach self edit" on public.periodization_blocks;
create policy "periodization blocks coach self edit"
  on public.periodization_blocks
  for all
  using (
    exists (
      select 1
      from public.periodization_days d
      where d.id = periodization_blocks.day_id
        and public.can_manage_periodization_student(d.student_id)
    )
  )
  with check (
    exists (
      select 1
      from public.periodization_days d
      where d.id = periodization_blocks.day_id
        and public.can_manage_periodization_student(d.student_id)
    )
  );

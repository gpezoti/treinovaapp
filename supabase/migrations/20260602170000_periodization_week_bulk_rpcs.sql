-- Treinova beta: atomic week duplication and reordering for periodization.
-- Keeps the current permission guard from 20260601124500 so coaches can manage
-- their own periodization and only their linked students.

create or replace function public.duplicate_periodization_week(
  p_student_id uuid,
  p_week_index integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_idx integer := p_week_index * 7;
  v_end_idx integer := (p_week_index * 7) + 6;
  v_total integer;
  v_temp_base date := date '2500-01-01';
  v_new_day_id uuid;
  d record;
begin
  perform public.ensure_coach_owns_student(p_student_id);

  if p_week_index is null or p_week_index < 0 then
    raise exception 'Semana inválida.';
  end if;

  select count(*) into v_total
  from public.periodization_days
  where student_id = p_student_id;

  if v_total = 0 or v_start_idx >= v_total then
    raise exception 'Semana não encontrada.';
  end if;

  create temporary table if not exists tmp_period_days_duplicate (
    idx integer,
    id uuid,
    original_date date,
    workout_code text,
    intensity text,
    aero boolean
  ) on commit drop;
  truncate tmp_period_days_duplicate;

  insert into tmp_period_days_duplicate (idx, id, original_date, workout_code, intensity, aero)
  select row_number() over (order by date)::integer - 1,
         id, date, workout_code, intensity, aero
  from public.periodization_days
  where student_id = p_student_id
  order by date;

  if (select count(*) from tmp_period_days_duplicate where idx between v_start_idx and v_end_idx) <> 7 then
    raise exception 'Semana incompleta. Complete 7 dias antes de duplicar.';
  end if;

  update public.periodization_days p
  set date = v_temp_base + o.idx
  from tmp_period_days_duplicate o
  where p.id = o.id
    and o.idx > v_end_idx;

  for d in
    select *
    from tmp_period_days_duplicate
    where idx between v_start_idx and v_end_idx
    order by idx
  loop
    insert into public.periodization_days (student_id, date, workout_code, intensity, aero)
    values (
      p_student_id,
      d.original_date + 7,
      coalesce(nullif(d.workout_code, ''), 'OFF'),
      coalesce(d.intensity, 'off'),
      coalesce(d.aero, false)
    )
    returning id into v_new_day_id;

    insert into public.periodization_blocks (day_id, position, preset_code, workout_code, workout_id, notes)
    select v_new_day_id, position, preset_code, workout_code, workout_id, notes
    from public.periodization_blocks
    where day_id = d.id
    order by position;
  end loop;

  update public.periodization_days p
  set date = o.original_date + 7
  from tmp_period_days_duplicate o
  where p.id = o.id
    and o.idx > v_end_idx;
end;
$$;

revoke all on function public.duplicate_periodization_week(uuid, integer) from public, anon;
grant execute on function public.duplicate_periodization_week(uuid, integer) to authenticated;

create or replace function public.move_periodization_week(
  p_student_id uuid,
  p_week_index integer,
  p_dir integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_index integer := p_week_index + p_dir;
  v_total integer;
  v_week_count integer;
  v_temp_base date := date '2600-01-01';
begin
  perform public.ensure_coach_owns_student(p_student_id);

  if p_week_index is null or p_week_index < 0 or p_dir not in (-1, 1) then
    raise exception 'Movimento inválido.';
  end if;

  select count(*) into v_total
  from public.periodization_days
  where student_id = p_student_id;

  v_week_count := v_total / 7;

  if v_target_index < 0 or v_target_index >= v_week_count then
    raise exception 'Semana fora do limite.';
  end if;

  create temporary table if not exists tmp_period_days_move (
    idx integer,
    id uuid,
    original_date date,
    week_index integer,
    day_offset integer
  ) on commit drop;
  truncate tmp_period_days_move;

  insert into tmp_period_days_move (idx, id, original_date, week_index, day_offset)
  select idx,
         id,
         date,
         floor(idx / 7)::integer,
         (idx % 7)::integer
  from (
    select row_number() over (order by date)::integer - 1 as idx,
           id,
           date
    from public.periodization_days
    where student_id = p_student_id
  ) ordered_days
  order by idx;

  if (select count(*) from tmp_period_days_move where week_index in (p_week_index, v_target_index)) <> 14 then
    raise exception 'Semana incompleta. Complete 7 dias antes de reordenar.';
  end if;

  update public.periodization_days p
  set date = v_temp_base + o.idx
  from tmp_period_days_move o
  where p.id = o.id
    and o.week_index in (p_week_index, v_target_index);

  update public.periodization_days p
  set date = target.original_date
  from tmp_period_days_move source
  join tmp_period_days_move target
    on target.week_index = v_target_index
   and target.day_offset = source.day_offset
  where p.id = source.id
    and source.week_index = p_week_index;

  update public.periodization_days p
  set date = source.original_date
  from tmp_period_days_move target
  join tmp_period_days_move source
    on source.week_index = p_week_index
   and source.day_offset = target.day_offset
  where p.id = target.id
    and target.week_index = v_target_index;
end;
$$;

revoke all on function public.move_periodization_week(uuid, integer, integer) from public, anon;
grant execute on function public.move_periodization_week(uuid, integer, integer) to authenticated;

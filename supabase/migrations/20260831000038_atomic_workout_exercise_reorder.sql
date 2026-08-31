-- Mantém a ordem dos exercícios atômica mesmo com conexão instável ou duas
-- telas tentando editar o mesmo treino. O índice UNIQUE(workout_id, position)
-- exige uma faixa temporária, mas as duas etapas agora vivem na mesma transação.

create or replace function public.reorder_workout_exercises(
  p_workout_id uuid,
  p_exercise_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_requested_count integer := cardinality(p_exercise_ids);
  v_current_count integer;
  v_updated_count integer;
begin
  if p_workout_id is null or coalesce(v_requested_count, 0) = 0 then
    raise exception 'workout and exercises are required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_exercise_ids) as requested(id)
    group by requested.id
    having count(*) > 1
  ) then
    raise exception 'exercise ids must be unique' using errcode = '22023';
  end if;

  -- A leitura respeita RLS. Assim, quem não enxerga o treino não consegue
  -- descobrir sua existência nem alterar a sua ordem pela RPC.
  perform 1
  from public.workouts
  where id = p_workout_id
  for update;
  if not found then
    raise exception 'workout not found or forbidden' using errcode = '42501';
  end if;

  perform 1
  from public.exercises
  where workout_id = p_workout_id
  for update;

  select count(*)
  into v_current_count
  from public.exercises
  where workout_id = p_workout_id;

  if v_current_count <> v_requested_count
     or exists (
       select 1
       from public.exercises e
       where e.workout_id = p_workout_id
         and not (e.id = any (p_exercise_ids))
     ) then
    raise exception 'workout exercises changed; reload and try again' using errcode = '40001';
  end if;

  with requested as (
    select id, (ordinality - 1)::integer as position
    from unnest(p_exercise_ids) with ordinality as item(id, ordinality)
  )
  update public.exercises e
  set position = 1000000000 + requested.position
  from requested
  where e.workout_id = p_workout_id
    and e.id = requested.id;
  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_requested_count then
    raise exception 'workout exercises changed; reload and try again' using errcode = '40001';
  end if;

  with requested as (
    select id, (ordinality - 1)::integer as position
    from unnest(p_exercise_ids) with ordinality as item(id, ordinality)
  )
  update public.exercises e
  set position = requested.position
  from requested
  where e.workout_id = p_workout_id
    and e.id = requested.id;
end;
$$;

revoke all on function public.reorder_workout_exercises(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_workout_exercises(uuid, uuid[]) to authenticated, service_role;

-- Corrige de forma determinística registros deixados pela versão anterior
-- (posição temporária >= 1.000.000), preservando a ordem visível no editor.
do $$
declare
  v_workout_id uuid;
begin
  for v_workout_id in
    select distinct workout_id
    from public.exercises
    where workout_id is not null
      and position >= 1000000
  loop
    with ordered as (
      select id, (row_number() over (order by position, id) - 1)::integer as position
      from public.exercises
      where workout_id = v_workout_id
    )
    update public.exercises e
    set position = 1000000000 + ordered.position
    from ordered
    where e.id = ordered.id;

    with ordered as (
      select id, (row_number() over (order by position, id) - 1)::integer as position
      from public.exercises
      where workout_id = v_workout_id
    )
    update public.exercises e
    set position = ordered.position
    from ordered
    where e.id = ordered.id;
  end loop;
end;
$$;

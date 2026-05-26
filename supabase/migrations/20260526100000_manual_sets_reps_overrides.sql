alter table public.exercises
  add column if not exists sets_override integer,
  add column if not exists reps_override text;

alter table public.sessions
  add column if not exists exercise_overrides jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercises_sets_override_range'
  ) then
    alter table public.exercises
      add constraint exercises_sets_override_range
      check (sets_override is null or (sets_override >= 1 and sets_override <= 30));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exercises_reps_override_len'
  ) then
    alter table public.exercises
      add constraint exercises_reps_override_len
      check (reps_override is null or char_length(reps_override) <= 40);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sessions_exercise_overrides_object'
  ) then
    alter table public.sessions
      add constraint sessions_exercise_overrides_object
      check (jsonb_typeof(exercise_overrides) = 'object');
  end if;
end $$;

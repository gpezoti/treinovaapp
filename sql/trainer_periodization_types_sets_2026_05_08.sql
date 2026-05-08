-- Adds periodization-owned training parameters.
-- Exercises remain the exercise catalog; sets/reps/rest are configured per periodization type.

alter table public.intensity_presets
  add column if not exists sets_count integer,
  add column if not exists duration_minutes integer,
  add column if not exists active boolean not null default true;

update public.intensity_presets
set sets_count = case code
  when 'yellow' then 3
  when 'hipertrofia' then 3
  when 'white' then 4
  when 'deload' then 4
  when 'red' then 4
  when 'forca' then 4
  when 'flex' then 1
  when 'off' then 0
  else 3
end
where is_workout = true
  and sets_count is null;

update public.intensity_presets
set duration_minutes = coalesce(duration_minutes, 30)
where is_workout = false
  and duration_minutes is null;

update public.intensity_presets
set active = true
where active is null;

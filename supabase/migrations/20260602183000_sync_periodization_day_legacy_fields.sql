-- Treinova beta: keep legacy periodization_days fields aligned with block-based periodization.
-- The UI still reads periodization_days.workout_code/intensity in a few fast paths.
-- When a day has multiple blocks, the first non-cardio block is the primary workout;
-- cardio/aerobic blocks remain complementary through the aero flag.

with ranked_blocks as (
  select
    b.day_id,
    b.preset_code,
    b.workout_code,
    row_number() over (
      partition by b.day_id
      order by
        case when lower(coalesce(b.preset_code, '')) in ('aero', 'cardio') then 1 else 0 end,
        b.position nulls last,
        b.id
    ) as rn
  from public.periodization_blocks b
),
primary_blocks as (
  select
    day_id,
    lower(coalesce(preset_code, '')) as preset_code,
    nullif(workout_code, '') as workout_code
  from ranked_blocks
  where rn = 1
),
days_with_aero as (
  select
    day_id,
    bool_or(lower(coalesce(preset_code, '')) in ('aero', 'cardio')) as has_aero
  from public.periodization_blocks
  group by day_id
),
mapped_days as (
  select
    d.id,
    coalesce(
      p.workout_code,
      case
        when p.preset_code = 'off' then 'OFF'
        when p.preset_code in ('flex', 'mobility', 'mobilidade') then 'FLEX'
        else d.workout_code
      end,
      'OFF'
    ) as next_workout_code,
    case
      when p.preset_code = 'hipertrofia' then 'yellow'
      when p.preset_code in ('forca', 'força') then 'red'
      when p.preset_code = 'deload' then 'white'
      when p.preset_code in ('flex', 'mobility', 'mobilidade', 'aero', 'cardio') then 'flex'
      when p.preset_code = 'off' then 'off'
      else coalesce(nullif(d.intensity, ''), 'yellow')
    end as next_intensity,
    coalesce(a.has_aero, false) as next_aero
  from public.periodization_days d
  join primary_blocks p on p.day_id = d.id
  left join days_with_aero a on a.day_id = d.id
)
update public.periodization_days d
set
  workout_code = m.next_workout_code,
  intensity = m.next_intensity,
  aero = m.next_aero
from mapped_days m
where d.id = m.id
  and (
    d.workout_code is distinct from m.next_workout_code
    or d.intensity is distinct from m.next_intensity
    or d.aero is distinct from m.next_aero
  );

-- Preserve the exact workout selected for each periodization block.
alter table public.periodization_blocks
  add column if not exists workout_id uuid references public.workouts(id) on delete set null;

create index if not exists periodization_blocks_workout_idx
  on public.periodization_blocks(workout_id);

-- Prefer the trainer-owned model when legacy rows only stored the A/B/C/D code.
with ranked_matches as (
  select
    b.id as block_id,
    w.id as workout_id,
    row_number() over (
      partition by b.id
      order by
        case
          when w.coach_id = student.coach_id and w.student_id is null then 1
          when w.student_id = student.id then 2
          when w.is_global then 3
          else 4
        end,
        w.created_at desc nulls last,
        w.id
    ) as rank
  from public.periodization_blocks b
  join public.periodization_days d on d.id = b.day_id
  join public.profiles student on student.id = d.student_id
  join public.workouts w on w.code = b.workout_code
  where b.workout_id is null
    and b.workout_code is not null
    and b.workout_code not in ('OFF', 'FLEX')
    and (
      (student.coach_id is not null and w.coach_id = student.coach_id and w.student_id is null)
      or w.student_id = student.id
      or w.is_global
    )
)
update public.periodization_blocks b
set workout_id = m.workout_id
from ranked_matches m
where b.id = m.block_id
  and m.rank = 1;

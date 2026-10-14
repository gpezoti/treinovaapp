-- Avoid needless index maintenance on write-heavy paths while retaining the
-- primary/constraint-backed indexes that enforce data integrity.
create index if not exists idx_coach_hidden_workouts_workout_id
  on public.coach_hidden_workouts (workout_id);

drop index if exists public.coach_branding_coach_id_uidx;
drop index if exists public.follows_following_idx;
drop index if exists public.rest_timer_push_jobs_user_timer_unique;

-- The worker claims a due notification before delivering it so concurrent
-- cron ticks cannot send the same rest alert more than once.
-- The idempotency migration added the claim column/index but omitted this
-- transient state from the original table constraint.

alter table public.rest_timer_push_jobs
  drop constraint if exists rest_timer_push_jobs_status_check;

alter table public.rest_timer_push_jobs
  add constraint rest_timer_push_jobs_status_check
  check (status = any (array['scheduled', 'processing', 'sent', 'cancelled', 'failed']));

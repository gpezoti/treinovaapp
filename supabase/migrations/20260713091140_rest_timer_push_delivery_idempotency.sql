-- Torna o envio de push de descanso idempotente entre envio direto e quatro
-- execucoes do cron. Tambem vincula cada timer ao dispositivo que o iniciou.

alter table public.rest_timer_push_jobs
  add column if not exists schedule_token text,
  add column if not exists target_endpoint text,
  add column if not exists claimed_at timestamptz;

create index if not exists idx_rest_timer_push_jobs_processing_claimed
  on public.rest_timer_push_jobs (claimed_at)
  where status = 'processing';

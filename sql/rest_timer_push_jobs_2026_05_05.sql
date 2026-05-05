-- Treinova: jobs de Web Push para timer de descanso
-- Necessário porque iOS/PWA pode suspender timers locais quando a tela bloqueia.
-- Aplicar antes de publicar a Edge Function rest-timer-push.

create table if not exists public.rest_timer_push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  timer_id text not null,
  exercise_name text not null default 'Próxima série',
  fire_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, timer_id)
);

create index if not exists idx_rest_timer_push_jobs_due
  on public.rest_timer_push_jobs (fire_at)
  where status = 'scheduled';

create index if not exists idx_rest_timer_push_jobs_user_status
  on public.rest_timer_push_jobs (user_id, status, fire_at);

alter table public.rest_timer_push_jobs enable row level security;

drop policy if exists "rest timer jobs owner read" on public.rest_timer_push_jobs;
create policy "rest timer jobs owner read"
  on public.rest_timer_push_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "rest timer jobs owner insert" on public.rest_timer_push_jobs;
create policy "rest timer jobs owner insert"
  on public.rest_timer_push_jobs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "rest timer jobs owner update" on public.rest_timer_push_jobs;
create policy "rest timer jobs owner update"
  on public.rest_timer_push_jobs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cron recomendado no Supabase:
-- 1) Defina o secret da Edge Function:
--    supabase secrets set REST_TIMER_CRON_SECRET="valor-forte-aqui"
--
-- 2) Agende uma chamada por minuto para processar jobs vencidos.
--    Pode ser Supabase Scheduled Functions, pg_cron + pg_net ou cron externo.
--
-- Exemplo com pg_cron + pg_net, se habilitados no projeto:
--
-- create extension if not exists pg_cron with schema extensions;
-- create extension if not exists pg_net with schema extensions;
--
-- select cron.schedule(
--   'treinova-rest-timer-push-every-minute',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := 'https://SEU-PROJETO.supabase.co/functions/v1/rest-timer-push',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', 'MESMO_VALOR_DE_REST_TIMER_CRON_SECRET'
--     ),
--     body := '{"action":"process"}'::jsonb
--   );
--   $$
-- );

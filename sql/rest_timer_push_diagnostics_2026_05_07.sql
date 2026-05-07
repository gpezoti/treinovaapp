-- Treinova: diagnostico do push do cronometro de descanso.
-- Rode no Supabase SQL Editor depois de testar um descanso.

-- 1) Cron ativo que processa jobs vencidos.
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'treinova-rest-timer-push-every-minute';

-- 2) Ultimos jobs do timer.
select
  id,
  user_id,
  timer_id,
  exercise_name,
  fire_at,
  status,
  attempts,
  last_error,
  sent_at,
  cancelled_at,
  created_at,
  updated_at
from public.rest_timer_push_jobs
order by created_at desc
limit 20;

-- 3) Push subscriptions salvas por usuario.
select
  user_id,
  count(*) as subscriptions,
  max(last_seen_at) as last_seen_at
from public.push_subscriptions
group by user_id
order by last_seen_at desc
limit 20;

-- 4) Respostas recentes do pg_net, quando disponivel.
select
  id,
  status_code,
  error_msg,
  created
from net._http_response
order by created desc
limit 20;

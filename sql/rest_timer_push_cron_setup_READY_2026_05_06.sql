-- Treinova: cron pronto para processar notificações de fim de descanso fora do app.
--
-- Rode no Supabase Dashboard > SQL Editor depois de publicar a Edge Function
-- rest-timer-push e configurar o secret REST_TIMER_CRON_SECRET abaixo.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('treinova-rest-timer-push-every-minute')
where exists (
  select 1 from cron.job where jobname = 'treinova-rest-timer-push-every-minute'
);

select cron.schedule(
  'treinova-rest-timer-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://mjftgknutxxgxhwlmsln.supabase.co/functions/v1/rest-timer-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_vkR2Gtm-axw0038KWy8LWA_vBFSIk_r',
      'apikey', 'sb_publishable_vkR2Gtm-axw0038KWy8LWA_vBFSIk_r',
      'x-cron-secret', 'treinova-rest-timer-2026-05-06'
    ),
    body := '{"action":"process"}'::jsonb
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'treinova-rest-timer-push-every-minute';

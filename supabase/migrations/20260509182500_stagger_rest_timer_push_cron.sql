-- Treinova: reduz latencia do cron de push do descanso.
--
-- pg_cron tem granularidade de 1 minuto. Para evitar atraso de ate 60s quando
-- o envio direto da Edge Function nao sobrevive ao background, criamos 4 jobs
-- por minuto com pg_sleep em offsets de 0/15/30/45s.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('treinova-rest-timer-push-every-minute')
where exists (
  select 1 from cron.job where jobname = 'treinova-rest-timer-push-every-minute'
);

select cron.unschedule('treinova-rest-timer-push-every-15s-00')
where exists (
  select 1 from cron.job where jobname = 'treinova-rest-timer-push-every-15s-00'
);

select cron.unschedule('treinova-rest-timer-push-every-15s-15')
where exists (
  select 1 from cron.job where jobname = 'treinova-rest-timer-push-every-15s-15'
);

select cron.unschedule('treinova-rest-timer-push-every-15s-30')
where exists (
  select 1 from cron.job where jobname = 'treinova-rest-timer-push-every-15s-30'
);

select cron.unschedule('treinova-rest-timer-push-every-15s-45')
where exists (
  select 1 from cron.job where jobname = 'treinova-rest-timer-push-every-15s-45'
);

select cron.schedule(
  'treinova-rest-timer-push-every-15s-00',
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

select cron.schedule(
  'treinova-rest-timer-push-every-15s-15',
  '* * * * *',
  $$
  select pg_sleep(15);
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

select cron.schedule(
  'treinova-rest-timer-push-every-15s-30',
  '* * * * *',
  $$
  select pg_sleep(30);
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

select cron.schedule(
  'treinova-rest-timer-push-every-15s-45',
  '* * * * *',
  $$
  select pg_sleep(45);
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

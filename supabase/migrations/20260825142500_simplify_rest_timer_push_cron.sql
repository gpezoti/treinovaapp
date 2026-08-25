-- Keep the background timer worker inexpensive. The staggered jobs held three
-- database transactions in pg_sleep for 15/30/45 seconds on every minute.
-- One short worker run is more reliable under load; the client still provides
-- the immediate foreground notification while this worker covers backgrounded PWAs.

do $$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid
    from cron.job
    where jobname in (
      'treinova-rest-timer-push-every-minute',
      'treinova-rest-timer-push-every-15s-00',
      'treinova-rest-timer-push-every-15s-15',
      'treinova-rest-timer-push-every-15s-30',
      'treinova-rest-timer-push-every-15s-45'
    )
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;
end;
$$;

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

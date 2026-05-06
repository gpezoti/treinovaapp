-- Treinova: template para processar notificações de fim de descanso fora do app
--
-- Por que precisa disso:
-- O celular pode suspender completamente o PWA quando o usuário bloqueia a tela
-- ou troca de app. Nessa situação, quem precisa disparar a notificação é o
-- Supabase, chamando a Edge Function rest-timer-push periodicamente.
--
-- Antes de aplicar:
-- 1. Publique a Edge Function outputs/edge-functions/rest-timer-push.
-- 2. Configure os secrets da função:
--    VAPID_PUBLIC_KEY
--    VAPID_PRIVATE_KEY
--    VAPID_SUBJECT
--    SUPABASE_URL
--    SUPABASE_SERVICE_ROLE_KEY
--    SUPABASE_ANON_KEY
--    REST_TIMER_CRON_SECRET
-- 3. Troque os placeholders abaixo.

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
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/rest-timer-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'MESMO_VALOR_DE_REST_TIMER_CRON_SECRET'
    ),
    body := '{"action":"process"}'::jsonb
  );
  $$
);

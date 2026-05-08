-- Treinova - Flexibilidade deve funcionar como tipo de treino parametrizado.
-- Também mantém a estrutura de push pronta; a assinatura Web Push só pode ser criada quando
-- o usuário abre o app no dispositivo e concede permissão no navegador/PWA.

update public.intensity_presets
set
  label = coalesce(nullif(label, ''), 'Flexibilidade'),
  is_workout = true,
  sets_count = 3,
  rep_min = 12,
  rep_max = 15,
  pause_seconds = 60,
  duration_minutes = null,
  active = true
where code = 'flex'
  and active is not false;

alter table public.push_subscriptions
  add column if not exists last_seen_at timestamp with time zone default now();

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);

create index if not exists idx_push_subscriptions_last_seen
  on public.push_subscriptions(last_seen_at desc);

-- Treinova: corrige tabela de Web Push criada antes da coluna last_seen_at.
-- Necessario para salvar/renovar subscriptions e diagnosticar notificacoes fora do app.

alter table public.push_subscriptions
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.push_subscriptions
  add column if not exists user_agent text;

create index if not exists idx_push_subscriptions_last_seen
  on public.push_subscriptions(last_seen_at desc);

update public.push_subscriptions
set last_seen_at = coalesce(last_seen_at, updated_at, created_at, now());

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'push_subscriptions'
  and column_name in ('last_seen_at', 'user_agent')
order by column_name;

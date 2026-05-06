-- Treinova: Web Push subscriptions
-- Necessário para notificações reais fora do app, incluindo fim de descanso.
-- A Edge Function rest-timer-push lê esta tabela com service role.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);

create index if not exists idx_push_subscriptions_last_seen
  on public.push_subscriptions(last_seen_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions owner read" on public.push_subscriptions;
create policy "push subscriptions owner read"
  on public.push_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push subscriptions owner insert" on public.push_subscriptions;
create policy "push subscriptions owner insert"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push subscriptions owner update" on public.push_subscriptions;
create policy "push subscriptions owner update"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push subscriptions owner delete" on public.push_subscriptions;
create policy "push subscriptions owner delete"
  on public.push_subscriptions
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();

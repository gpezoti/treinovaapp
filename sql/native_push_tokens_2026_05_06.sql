-- Treinova iOS native push tokens.
-- Rode no Supabase SQL Editor antes de testar push remoto nativo.

create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios',
  device_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_native_push_tokens_user_id
  on public.native_push_tokens(user_id);

create index if not exists idx_native_push_tokens_last_seen
  on public.native_push_tokens(last_seen_at desc);

alter table public.native_push_tokens enable row level security;

drop policy if exists "native push tokens owner read" on public.native_push_tokens;
create policy "native push tokens owner read"
  on public.native_push_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "native push tokens owner insert" on public.native_push_tokens;
create policy "native push tokens owner insert"
  on public.native_push_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "native push tokens owner update" on public.native_push_tokens;
create policy "native push tokens owner update"
  on public.native_push_tokens
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "native push tokens owner delete" on public.native_push_tokens;
create policy "native push tokens owner delete"
  on public.native_push_tokens
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

drop trigger if exists native_push_tokens_updated_at on public.native_push_tokens;
create trigger native_push_tokens_updated_at
  before update on public.native_push_tokens
  for each row execute function public.touch_updated_at();

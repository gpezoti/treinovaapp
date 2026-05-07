-- Treinova: garante schema completo da fila de push do cronometro.
-- Rode no Supabase SQL Editor se o diagnostico mostra "Ultimo job: nenhum"
-- mesmo depois de tocar em "Teste bloqueado 15s".

create table if not exists public.rest_timer_push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  timer_id text not null,
  exercise_name text not null default 'Proxima serie',
  fire_at timestamptz not null,
  status text not null default 'scheduled',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rest_timer_push_jobs
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

alter table public.rest_timer_push_jobs
  add column if not exists timer_id text;

alter table public.rest_timer_push_jobs
  add column if not exists exercise_name text not null default 'Proxima serie';

alter table public.rest_timer_push_jobs
  add column if not exists fire_at timestamptz;

alter table public.rest_timer_push_jobs
  add column if not exists status text not null default 'scheduled';

alter table public.rest_timer_push_jobs
  add column if not exists attempts integer not null default 0;

alter table public.rest_timer_push_jobs
  add column if not exists last_error text;

alter table public.rest_timer_push_jobs
  add column if not exists sent_at timestamptz;

alter table public.rest_timer_push_jobs
  add column if not exists cancelled_at timestamptz;

alter table public.rest_timer_push_jobs
  add column if not exists created_at timestamptz not null default now();

alter table public.rest_timer_push_jobs
  add column if not exists updated_at timestamptz not null default now();

update public.rest_timer_push_jobs
set
  exercise_name = coalesce(nullif(exercise_name, ''), 'Proxima serie'),
  status = coalesce(nullif(status, ''), 'scheduled'),
  attempts = coalesce(attempts, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

create unique index if not exists rest_timer_push_jobs_user_timer_unique
  on public.rest_timer_push_jobs(user_id, timer_id);

create index if not exists idx_rest_timer_push_jobs_due
  on public.rest_timer_push_jobs(fire_at)
  where status = 'scheduled';

create index if not exists idx_rest_timer_push_jobs_user_status
  on public.rest_timer_push_jobs(user_id, status, fire_at);

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

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'rest_timer_push_jobs'
order by ordinal_position;

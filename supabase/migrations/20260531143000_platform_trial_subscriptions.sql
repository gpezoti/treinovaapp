-- Treinova: trial publico de treinadores + assinatura mensal da plataforma.
-- Mantem treinadores existentes como "legacy" para nao bloquear a base atual.

alter table public.profiles
  add column if not exists cpf_cnpj text,
  add column if not exists phone text,
  add column if not exists onboarded boolean default false,
  add column if not exists must_reset_password boolean not null default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text,
  add column if not exists subscription_plan text,
  add column if not exists subscription_price numeric(10,2),
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_checkout_id text,
  add column if not exists asaas_checkout_url text,
  add column if not exists asaas_subscription_id text,
  add column if not exists subscription_current_period_ends_at timestamptz,
  add column if not exists subscription_locked_at timestamptz,
  add column if not exists subscription_updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_subscription_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_subscription_status_check
      check (
        subscription_status is null
        or subscription_status in (
          'legacy',
          'trialing',
          'checkout_pending',
          'active',
          'past_due',
          'expired',
          'canceled',
          'blocked'
        )
      );
  end if;
end $$;

update public.profiles
set
  subscription_status = coalesce(subscription_status, 'legacy'),
  subscription_plan = coalesce(subscription_plan, 'legacy'),
  subscription_updated_at = now()
where role in ('coach', 'admin')
  and subscription_status is null;

create table if not exists public.coach_subscriptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('legacy','trialing','checkout_pending','active','past_due','expired','canceled','blocked')),
  plan_code text not null default 'coach_monthly',
  amount numeric(10,2) not null default 59.90,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  asaas_customer_id text,
  asaas_checkout_id text,
  asaas_checkout_url text,
  asaas_subscription_id text,
  asaas_external_reference text,
  last_webhook_event text,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coach_subscriptions_coach_id_uniq
  on public.coach_subscriptions(coach_id);

create index if not exists coach_subscriptions_status_idx
  on public.coach_subscriptions(status);

create index if not exists coach_subscriptions_asaas_checkout_idx
  on public.coach_subscriptions(asaas_checkout_id)
  where asaas_checkout_id is not null;

create index if not exists coach_subscriptions_asaas_subscription_idx
  on public.coach_subscriptions(asaas_subscription_id)
  where asaas_subscription_id is not null;

create index if not exists profiles_subscription_status_idx
  on public.profiles(subscription_status)
  where role = 'coach';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_subscriptions_touch_updated_at on public.coach_subscriptions;
create trigger coach_subscriptions_touch_updated_at
  before update on public.coach_subscriptions
  for each row execute function public.touch_updated_at();

create or replace function public.find_profile_duplicate_signup(
  p_email text,
  p_cpf text,
  p_phone text
)
returns table(id uuid, field text, value text)
language sql
stable
security definer
set search_path = public
as $$
  with matches as (
    select p.id, 'email'::text as field, p.email::text as value, 1 as priority
      from public.profiles p
     where lower(trim(p.email)) = lower(trim(coalesce(p_email, '')))
    union all
    select p.id, 'cpf'::text as field, p.cpf_cnpj::text as value, 2 as priority
      from public.profiles p
     where regexp_replace(coalesce(p.cpf_cnpj, ''), '\D', '', 'g') = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
       and regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') <> ''
    union all
    select p.id, 'phone'::text as field, p.phone::text as value, 3 as priority
      from public.profiles p
     where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
       and regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') <> ''
  )
  select m.id, m.field, m.value
    from matches m
   order by m.priority
   limit 1;
$$;

revoke execute on function public.find_profile_duplicate_signup(text, text, text) from public, anon, authenticated;
grant execute on function public.find_profile_duplicate_signup(text, text, text) to service_role;

alter table public.coach_subscriptions enable row level security;

drop policy if exists "coach subscriptions owner read" on public.coach_subscriptions;
create policy "coach subscriptions owner read"
  on public.coach_subscriptions
  for select
  using (auth.uid() = coach_id);

drop policy if exists "coach subscriptions admin read all" on public.coach_subscriptions;
create policy "coach subscriptions admin read all"
  on public.coach_subscriptions
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ));

-- Unicidade defensiva para novos cadastros. Se houver duplicatas legadas,
-- a funcao publica de signup ainda bloqueia novas duplicatas e a migration
-- nao quebra producao.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_email_lower_unique_if_clean') then
    if not exists (
      select lower(trim(email))
      from public.profiles
      where email is not null and trim(email) <> ''
      group by lower(trim(email))
      having count(*) > 1
    ) then
      create unique index profiles_email_lower_unique_if_clean
        on public.profiles(lower(trim(email)))
        where email is not null and trim(email) <> '';
    else
      raise notice 'profiles_email_lower_unique_if_clean nao criado: ha emails duplicados legados.';
    end if;
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_cpf_digits_unique_if_clean') then
    if not exists (
      select regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g')
      from public.profiles
      where regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') <> ''
      group by regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g')
      having count(*) > 1
    ) then
      create unique index profiles_cpf_digits_unique_if_clean
        on public.profiles(regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g'))
        where regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') <> '';
    else
      raise notice 'profiles_cpf_digits_unique_if_clean nao criado: ha CPFs/CNPJs duplicados legados.';
    end if;
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_phone_digits_unique_if_clean') then
    if not exists (
      select regexp_replace(coalesce(phone, ''), '\D', '', 'g')
      from public.profiles
      where regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> ''
      group by regexp_replace(coalesce(phone, ''), '\D', '', 'g')
      having count(*) > 1
    ) then
      create unique index profiles_phone_digits_unique_if_clean
        on public.profiles(regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
        where regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> '';
    else
      raise notice 'profiles_phone_digits_unique_if_clean nao criado: ha telefones duplicados legados.';
    end if;
  end if;
end $$;

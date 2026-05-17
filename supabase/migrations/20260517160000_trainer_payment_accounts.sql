-- =============================================================================
-- Treinova - contas de recebimento por treinador
-- 2026-05-17
--
-- Camada opcional para suportar mais de um provedor sem alterar o fluxo atual
-- do Asaas. Treinadores sem linha nesta tabela continuam usando o fallback Asaas.
-- =============================================================================

create table if not exists public.trainer_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('asaas', 'manual_pix', 'mercado_pago')),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'pending', 'disabled')),
  display_name text,
  pix_key_type text check (pix_key_type in ('cpf_cnpj', 'email', 'phone', 'random')),
  pix_key text,
  external_account_id text,
  wallet_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_id, provider)
);

alter table public.payments
  add column if not exists payment_provider text,
  add column if not exists provider_public_payload jsonb not null default '{}'::jsonb;

create unique index if not exists trainer_payment_accounts_one_default_idx
  on public.trainer_payment_accounts (trainer_id)
  where is_default;

create index if not exists trainer_payment_accounts_trainer_idx
  on public.trainer_payment_accounts (trainer_id);

create index if not exists payments_payment_provider_idx
  on public.payments (payment_provider)
  where payment_provider is not null;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trainer_payment_accounts_updated_at on public.trainer_payment_accounts;
create trigger trainer_payment_accounts_updated_at
  before update on public.trainer_payment_accounts
  for each row execute function public.set_updated_at();

alter table public.trainer_payment_accounts enable row level security;

drop policy if exists "trainer payment accounts owner read" on public.trainer_payment_accounts;
create policy "trainer payment accounts owner read" on public.trainer_payment_accounts
  for select using (
    trainer_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "trainer payment accounts owner insert" on public.trainer_payment_accounts;
create policy "trainer payment accounts owner insert" on public.trainer_payment_accounts
  for insert with check (
    public.is_coach(auth.uid())
    and trainer_id = auth.uid()
  );

drop policy if exists "trainer payment accounts owner update" on public.trainer_payment_accounts;
create policy "trainer payment accounts owner update" on public.trainer_payment_accounts
  for update using (
    trainer_id = auth.uid()
    and public.is_coach(auth.uid())
  )
  with check (
    trainer_id = auth.uid()
    and public.is_coach(auth.uid())
  );

drop policy if exists "trainer payment accounts owner delete" on public.trainer_payment_accounts;
create policy "trainer payment accounts owner delete" on public.trainer_payment_accounts
  for delete using (
    trainer_id = auth.uid()
    and public.is_coach(auth.uid())
  );

drop policy if exists "trainer payment accounts admin all" on public.trainer_payment_accounts;
create policy "trainer payment accounts admin all" on public.trainer_payment_accounts
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

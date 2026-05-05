-- =============================================================================
-- payments_complete.sql — Migration definitiva do módulo financeiro
-- Resolve: PAY-C01, PAY-C02, PAY-C03, PAY-C04, PAY-A01, PAY-A02
-- Idempotente — seguro para rodar N vezes em banco existente.
-- =============================================================================

-- =============================================================================
-- 0. Normalizar coluna: renomear payer_id → user_id se necessário
--    (a tabela foi criada manualmente com payer_id em algumas instâncias)
-- =============================================================================
do $$
begin
  -- Se existir payer_id mas não user_id, renomeia
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'payer_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'user_id'
  ) then
    alter table public.payments rename column payer_id to user_id;
  end if;
end $$;

-- =============================================================================
-- 1. TABELA payments (cria se não existir, preserva dados existentes)
-- =============================================================================
create table if not exists public.payments (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references public.profiles(id) on delete cascade,
  receiver_id        uuid        references public.profiles(id) on delete set null,
  created_by         uuid        references public.profiles(id) on delete set null,
  amount             numeric     not null check (amount > 0),
  due_date           date        not null,
  status             text        not null default 'pending'
                                 check (status in ('pending','paid','overdue','cancelled')),
  method             text        default 'pix'
                                 check (method in ('pix','boleto','credit','debit','transfer','cash','other','asaas')),
  reference          text,
  notes              text,
  paid_at            timestamptz,
  -- Integração Asaas
  asaas_id           text,
  pix_qr             text,
  pix_copy_paste     text,
  boleto_url         text,
  invoice_url        text,
  external_reference text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Adicionar colunas que podem não existir em banco antigo
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='receiver_id') then
    alter table public.payments add column receiver_id uuid references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='created_by') then
    alter table public.payments add column created_by uuid references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='asaas_id') then
    alter table public.payments add column asaas_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='pix_qr') then
    alter table public.payments add column pix_qr text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='pix_copy_paste') then
    alter table public.payments add column pix_copy_paste text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='boleto_url') then
    alter table public.payments add column boleto_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='invoice_url') then
    alter table public.payments add column invoice_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='external_reference') then
    alter table public.payments add column external_reference text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='updated_at') then
    alter table public.payments add column updated_at timestamptz not null default now();
  end if;
end $$;

-- Indexes
create index if not exists payments_user_id_idx     on public.payments(user_id);
create index if not exists payments_receiver_id_idx on public.payments(receiver_id);
create index if not exists payments_due_date_idx    on public.payments(due_date);
create index if not exists payments_status_idx      on public.payments(status);
create index if not exists payments_asaas_id_idx    on public.payments(asaas_id);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2. RLS
-- =============================================================================
alter table public.payments enable row level security;

-- Aluno: lê apenas seus próprios pagamentos
drop policy if exists "payments student read own" on public.payments;
create policy "payments student read own" on public.payments
  for select using (auth.uid() = user_id);

-- Coach: lê pagamentos dos seus alunos
drop policy if exists "payments coach read own students" on public.payments;
create policy "payments coach read own students" on public.payments
  for select using (
    public.is_coach(auth.uid())
    and (
      receiver_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = user_id and p.coach_id = auth.uid()
      )
    )
  );

-- Coach: insere pagamentos para seus alunos
drop policy if exists "payments coach insert" on public.payments;
create policy "payments coach insert" on public.payments
  for insert with check (
    public.is_coach(auth.uid())
    and created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.coach_id = auth.uid()
    )
  );

-- Coach: atualiza pagamentos dos seus alunos
drop policy if exists "payments coach update" on public.payments;
create policy "payments coach update" on public.payments
  for update using (
    public.is_coach(auth.uid())
    and (
      receiver_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = user_id and p.coach_id = auth.uid()
      )
    )
  );

-- Coach: deleta pagamentos dos seus alunos
drop policy if exists "payments coach delete" on public.payments;
create policy "payments coach delete" on public.payments
  for delete using (
    public.is_coach(auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.coach_id = auth.uid()
    )
  );

-- Admin: acesso total
drop policy if exists "payments admin all" on public.payments;
create policy "payments admin all" on public.payments
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- =============================================================================
-- 3. VIEW: v_coach_payments
--    1 linha por aluno — campos agregados que o front já espera:
--    student_id, full_name, email, avatar_emoji, avatar_url,
--    is_overdue, overdue_count, open_count, paid_count,
--    open_amount, last_paid_at, next_due
-- =============================================================================
drop view if exists public.v_coach_payments;
create view public.v_coach_payments as
select
  p.id                                                                             as student_id,
  p.full_name,
  p.email,
  p.avatar_emoji,
  p.avatar_url,
  p.phone,
  p.coach_id,
  -- Status agregado
  bool_or(
    pay.status = 'overdue'
    or (pay.status = 'pending' and pay.due_date < current_date)
  )                                                                                as is_overdue,
  count(pay.id) filter (
    where pay.status = 'overdue'
    or (pay.status = 'pending' and pay.due_date < current_date)
  )                                                                                as overdue_count,
  count(pay.id) filter (
    where pay.status in ('pending','overdue')
  )                                                                                as open_count,
  count(pay.id) filter (where pay.status = 'paid')                                as paid_count,
  coalesce(sum(pay.amount) filter (where pay.status in ('pending','overdue')), 0) as open_amount,
  max(pay.paid_at)   filter (where pay.status = 'paid')                           as last_paid_at,
  min(pay.due_date)  filter (where pay.status in ('pending','overdue'))            as next_due
from public.profiles p
left join public.payments pay on pay.user_id = p.id
where
  p.role = 'student'
  and p.coach_id = auth.uid()
  and public.is_coach(auth.uid())
group by p.id, p.full_name, p.email, p.avatar_emoji, p.avatar_url, p.phone, p.coach_id
order by p.full_name;

grant select on public.v_coach_payments to authenticated;

-- =============================================================================
-- 4. VIEW: v_admin_payments
--    1 linha por coach — mesmos campos agregados mas sobre os alunos do coach:
--    coach_id, full_name, email, avatar_emoji, avatar_url,
--    is_overdue, overdue_count, open_count, paid_count,
--    open_amount, last_paid_at, next_due
-- =============================================================================
drop view if exists public.v_admin_payments;
create view public.v_admin_payments as
select
  c.id                                                                             as coach_id,
  c.full_name,
  c.email,
  c.avatar_emoji,
  c.avatar_url,
  -- Status agregado de todos os alunos deste coach
  bool_or(
    pay.status = 'overdue'
    or (pay.status = 'pending' and pay.due_date < current_date)
  )                                                                                as is_overdue,
  count(pay.id) filter (
    where pay.status = 'overdue'
    or (pay.status = 'pending' and pay.due_date < current_date)
  )                                                                                as overdue_count,
  count(pay.id) filter (
    where pay.status in ('pending','overdue')
  )                                                                                as open_count,
  count(pay.id) filter (where pay.status = 'paid')                                as paid_count,
  coalesce(sum(pay.amount) filter (where pay.status in ('pending','overdue')), 0) as open_amount,
  max(pay.paid_at)   filter (where pay.status = 'paid')                           as last_paid_at,
  min(pay.due_date)  filter (where pay.status in ('pending','overdue'))            as next_due,
  count(distinct s.id)                                                             as student_count
from public.profiles c
join public.profiles s   on s.coach_id = c.id and s.role = 'student'
left join public.payments pay on pay.user_id = s.id
where
  c.role = 'coach'
  and public.is_admin(auth.uid())
group by c.id, c.full_name, c.email, c.avatar_emoji, c.avatar_url
order by c.full_name;

grant select on public.v_admin_payments to authenticated;

-- =============================================================================
-- 5. RPC: refresh_payment_status
--    Chamada em generateOverduePaymentNotifications() no front
-- =============================================================================
create or replace function public.refresh_payment_status()
returns void
language sql
security definer
set search_path = public
as $$
  update public.payments
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;
$$;

grant execute on function public.refresh_payment_status() to authenticated;

-- =============================================================================
-- 6. Realtime: adicionar payments à publicação
-- =============================================================================
do $$
begin
  -- Só adiciona se ainda não estiver na publicação
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;

-- =============================================================================
-- 7. is_payment_ok — recriar usando user_id (coluna correta pós-migration)
-- =============================================================================
create or replace function public.is_payment_ok(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.payments
    where user_id = uid
      and status in ('pending', 'overdue')
      and due_date < current_date
  );
$$;

-- =============================================================================
-- VERIFICAÇÃO — rode após aplicar:
-- =============================================================================
-- 1. RLS habilitado:
--    select relname, relrowsecurity from pg_class where relname = 'payments';
--
-- 2. Policies:
--    select policyname, cmd from pg_policies where tablename = 'payments' order by cmd;
--
-- 3. Views existem:
--    select viewname from pg_views where schemaname = 'public'
--    and viewname in ('v_admin_payments','v_coach_payments');
--
-- 4. Realtime:
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'payments';
--
-- 5. RPC:
--    select proname from pg_proc where proname = 'refresh_payment_status';
--
-- 6. Teste de insert como coach (deve funcionar):
--    insert into public.payments (user_id, amount, due_date, created_by)
--    values ('<student_uuid>', 150, current_date + 30, auth.uid());
-- =============================================================================

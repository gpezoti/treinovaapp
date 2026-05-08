-- =============================================================================
-- Treinova - beta stability: treino, push e financeiro
-- 2026-05-08
-- =============================================================================

-- 1) Treino concluido: reabrir, reiniciar ou apagar no mesmo dia.
create or replace function public.manage_my_workout_session(
  p_session_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if v_action not in ('reopen', 'restart', 'delete') then
    raise exception 'Acao invalida.';
  end if;

  select *
    into v_session
  from public.sessions
  where id = p_session_id
    and student_id = auth.uid()
    and date = current_date
    and status = 'completed'
  for update;

  if not found then
    raise exception 'Treino concluido de hoje nao encontrado.';
  end if;

  if v_action = 'delete' then
    delete from public.set_logs where session_id = p_session_id and student_id = auth.uid();
    delete from public.sessions where id = p_session_id and student_id = auth.uid();
    return;
  end if;

  if v_action = 'restart' then
    delete from public.set_logs where session_id = p_session_id and student_id = auth.uid();
  end if;

  update public.sessions
  set
    status = 'in_progress',
    completed_at = null,
    duration_seconds = null,
    total_volume_kg = null
  where id = p_session_id
    and student_id = auth.uid();
end;
$$;

grant execute on function public.manage_my_workout_session(uuid, text) to authenticated, service_role;

-- 2) Push subscriptions: garantir colunas e RLS de dono para todo usuario cadastrado.
alter table public.push_subscriptions
  add column if not exists last_seen_at timestamptz;

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz default now();

update public.push_subscriptions
set last_seen_at = coalesce(last_seen_at, created_at, now())
where last_seen_at is null;

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);

create index if not exists idx_push_subscriptions_last_seen
  on public.push_subscriptions(last_seen_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions owner read" on public.push_subscriptions;
create policy "push subscriptions owner read"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "push subscriptions owner insert" on public.push_subscriptions;
create policy "push subscriptions owner insert"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "push subscriptions owner update" on public.push_subscriptions;
create policy "push subscriptions owner update"
  on public.push_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push subscriptions owner delete" on public.push_subscriptions;
create policy "push subscriptions owner delete"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);

-- 3) Financeiro: views devem mostrar pessoas mesmo sem cobrancas ainda.
drop view if exists public.v_coach_payments;
create view public.v_coach_payments as
select
  p.id as student_id,
  p.full_name,
  p.email,
  p.avatar_emoji,
  p.avatar_url,
  p.phone,
  p.coach_id,
  coalesce(bool_or(pay.status = 'overdue' or (pay.status = 'pending' and pay.due_date < current_date)), false) as is_overdue,
  count(pay.id) filter (where pay.status = 'overdue' or (pay.status = 'pending' and pay.due_date < current_date)) as overdue_count,
  count(pay.id) filter (where pay.status in ('pending','overdue')) as open_count,
  count(pay.id) filter (where pay.status = 'paid') as paid_count,
  coalesce(sum(pay.amount) filter (where pay.status in ('pending','overdue')), 0) as open_amount,
  max(pay.paid_at) filter (where pay.status = 'paid') as last_paid_at,
  min(pay.due_date) filter (where pay.status in ('pending','overdue')) as next_due
from public.profiles p
left join public.payments pay on pay.user_id = p.id
where
  p.role = 'student'
  and p.coach_id = auth.uid()
  and public.is_coach(auth.uid())
group by p.id, p.full_name, p.email, p.avatar_emoji, p.avatar_url, p.phone, p.coach_id
order by p.full_name;

grant select on public.v_coach_payments to authenticated;

drop view if exists public.v_admin_payments;
create view public.v_admin_payments as
select
  c.id as coach_id,
  c.full_name,
  c.email,
  c.avatar_emoji,
  c.avatar_url,
  c.phone,
  coalesce(bool_or(pay.status = 'overdue' or (pay.status = 'pending' and pay.due_date < current_date)), false) as is_overdue,
  count(pay.id) filter (where pay.status = 'overdue' or (pay.status = 'pending' and pay.due_date < current_date)) as overdue_count,
  count(pay.id) filter (where pay.status in ('pending','overdue')) as open_count,
  count(pay.id) filter (where pay.status = 'paid') as paid_count,
  coalesce(sum(pay.amount) filter (where pay.status in ('pending','overdue')), 0) as open_amount,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid' and pay.paid_at >= date_trunc('month', now())), 0) as paid_amount_month,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as paid_amount_total,
  max(pay.paid_at) filter (where pay.status = 'paid') as last_paid_at,
  min(pay.due_date) filter (where pay.status in ('pending','overdue')) as next_due
from public.profiles c
left join public.payments pay on pay.user_id = c.id
where
  c.role = 'coach'
  and public.is_admin(auth.uid())
group by c.id, c.full_name, c.email, c.avatar_emoji, c.avatar_url, c.phone
order by c.full_name;

grant select on public.v_admin_payments to authenticated;

-- Treinova beta: ADM MASTER financial overview by professor.
-- Shows pending, overdue and paid payments where the professor is the payer.
-- Professors and students remain protected by payments RLS policies.

drop view if exists public.v_admin_payments;
create view public.v_admin_payments as
select
  c.id                                                                             as coach_id,
  c.full_name,
  c.email,
  c.avatar_emoji,
  c.avatar_url,
  c.phone,
  bool_or(
    pay.status = 'overdue'
    or (pay.status = 'pending' and pay.due_date < current_date)
  )                                                                                as is_overdue,
  count(pay.id) filter (
    where pay.status = 'overdue'
    or (pay.status = 'pending' and pay.due_date < current_date)
  )                                                                                as overdue_count,
  count(pay.id) filter (where pay.status in ('pending','overdue'))                as open_count,
  count(pay.id) filter (where pay.status = 'paid')                                as paid_count,
  coalesce(sum(pay.amount) filter (where pay.status in ('pending','overdue')), 0) as open_amount,
  coalesce(sum(pay.amount) filter (
    where pay.status = 'paid'
      and pay.paid_at >= date_trunc('month', now())
  ), 0)                                                                            as paid_amount_month,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0)                 as paid_amount_total,
  max(pay.paid_at)   filter (where pay.status = 'paid')                           as last_paid_at,
  min(pay.due_date)  filter (where pay.status in ('pending','overdue'))            as next_due
from public.profiles c
left join public.payments pay on pay.user_id = c.id
where
  c.role = 'coach'
  and public.is_admin(auth.uid())
group by c.id, c.full_name, c.email, c.avatar_emoji, c.avatar_url, c.phone
order by c.full_name;

grant select on public.v_admin_payments to authenticated;

-- Treinova: corrige v_admin_payments para listar TODOS os professores,
-- inclusive recém-criados sem alunos e sem cobranças. Os pagamentos
-- agregados são do próprio professor (mensalidade da plataforma).
--
-- Bug: a definição anterior fazia INNER JOIN profiles s ON s.coach_id=c.id,
-- então professor sem aluno cadastrado nunca aparecia no Financeiro do ADM.
-- Aplicada em 2026-05-07 via MCP.

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

alter view public.v_admin_payments set (security_invoker = true);

grant select on public.v_admin_payments to authenticated;

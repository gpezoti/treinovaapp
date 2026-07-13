-- Inclui o status de periodização na mesma consulta que já abastece a lista do treinador.
-- O índice torna o EXISTS barato mesmo para treinadores com muitos alunos.

create index if not exists idx_periodization_days_student_id
  on public.periodization_days (student_id);

create or replace view public.v_coach_student_summary as
with session_agg as (
  select
    s.student_id,
    count(*) filter (where s.status = 'completed') as sessions_done,
    max(s.completed_at) filter (where s.status = 'completed') as last_session_at,
    count(*) filter (
      where s.status = 'completed'
        and s.completed_at >= now() - interval '7 days'
    ) as sessions_last_7d
  from public.sessions s
  group by s.student_id
),
payment_agg as (
  select
    pay.user_id as student_id,
    bool_or(pay.status = 'overdue') as has_overdue,
    bool_or(pay.status = 'pending' and pay.due_date < current_date) as has_pending_overdue,
    bool_or(pay.status = 'pending') as has_pending,
    bool_or(pay.status = 'paid') as has_paid
  from public.payments pay
  group by pay.user_id
)
select
  p.id as student_id,
  p.full_name,
  p.email,
  p.avatar_emoji,
  p.avatar_url,
  p.phone,
  p.status,
  p.coach_id,
  p.created_at as joined_at,
  coalesce(sa.sessions_done, 0) as sessions_done,
  sa.last_session_at,
  coalesce(sa.sessions_last_7d, 0) as sessions_last_7d,
  exists (
    select 1
    from public.periodization_days pd
    where pd.student_id = p.id
  ) as has_periodization,
  case
    when coalesce(pa.has_overdue, false) then 'overdue'
    when coalesce(pa.has_pending_overdue, false) then 'pending_overdue'
    when coalesce(pa.has_pending, false) then 'pending'
    when coalesce(pa.has_paid, false) then 'paid'
    else null
  end as payment_status
from public.profiles p
left join session_agg sa on sa.student_id = p.id
left join payment_agg pa on pa.student_id = p.id
where p.role = 'student'
  and (
    p.coach_id = auth.uid()
    or public.is_admin(auth.uid())
  );

alter view public.v_coach_student_summary set (security_invoker = true);
grant select on public.v_coach_student_summary to authenticated;

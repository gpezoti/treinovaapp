-- Treinova: corrige durações absurdas de treino causadas por sessão deixada aberta.
-- Regra: sessões acima de 4h são recalculadas pela janela entre primeira e última série,
-- com 10min extras de tolerância. Se não houver séries suficientes, limita em 4h.

with set_windows as (
  select
    session_id,
    min(done_at) filter (where done = true and done_at is not null) as first_done_at,
    max(done_at) filter (where done = true and done_at is not null) as last_done_at,
    count(*) filter (where done = true and done_at is not null) as done_count
  from public.set_logs
  group by session_id
),
recalc as (
  select
    s.id,
    case
      when sw.done_count >= 2 then
        greatest(
          300,
          least(
            14400,
            extract(epoch from (sw.last_done_at - sw.first_done_at))::int + 600
          )
        )
      else 14400
    end as fixed_duration
  from public.sessions s
  left join set_windows sw on sw.session_id = s.id
  where s.status = 'completed'
    and coalesce(s.duration_seconds, 0) > 14400
)
update public.sessions s
set duration_seconds = r.fixed_duration
from recalc r
where s.id = r.id;

select id, student_id, date, duration_seconds
from public.sessions
where duration_seconds > 14400
order by completed_at desc
limit 20;

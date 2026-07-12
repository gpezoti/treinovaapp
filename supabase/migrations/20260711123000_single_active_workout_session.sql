-- Mantem uma unica sessao de treino ativa por aluno.
-- A limpeza preserva a sessao mais recente e apenas abandona concorrentes antigas.

with ranked_active as (
  select
    id,
    row_number() over (
      partition by student_id
      order by started_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.sessions
  where status = 'in_progress'
)
update public.sessions s
set status = 'abandoned'
from ranked_active r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists sessions_one_in_progress_per_student_uidx
  on public.sessions (student_id)
  where status = 'in_progress';

-- Funcoes administrativas continuam validando is_admin(auth.uid()) internamente,
-- mas usuarios anonimos nao precisam sequer enxergar uma superficie executavel.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_update_trainer', 'admin_remove_trainer')
  loop
    execute format('revoke execute on function %s from anon', fn);
  end loop;
end
$$;

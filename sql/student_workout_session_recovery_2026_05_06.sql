-- Treinova: aluno pode corrigir treino concluído por engano no mesmo dia.
-- Ações suportadas:
-- - reopen: mantém séries e reabre para continuar/editá-las
-- - restart: apaga séries e reabre do zero
-- - delete: apaga a sessão e séries do treino de hoje

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
    raise exception 'Usuário não autenticado.';
  end if;

  if v_action not in ('reopen', 'restart', 'delete') then
    raise exception 'Ação inválida.';
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
    raise exception 'Treino concluído de hoje não encontrado.';
  end if;

  if v_action = 'delete' then
    delete from public.set_logs where session_id = p_session_id;
    delete from public.sessions where id = p_session_id and student_id = auth.uid();
    return;
  end if;

  if v_action = 'restart' then
    delete from public.set_logs where session_id = p_session_id;
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

grant execute on function public.manage_my_workout_session(uuid, text) to authenticated;

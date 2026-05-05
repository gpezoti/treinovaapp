-- Treinova beta: allow real conversation deletion for both participants.
-- Without this policy, Supabase can return success with zero deleted rows under RLS,
-- leaving the conversation visible after the success toast.

alter table public.messages enable row level security;

drop policy if exists "msgs delete pair" on public.messages;
create policy "msgs delete pair" on public.messages
  for delete using (
    auth.uid() = from_user
    or auth.uid() = to_user
    or public.is_admin(auth.uid())
  );

alter view if exists public.v_chat_threads set (security_invoker = true);

create or replace function public.delete_conversation_with_user(p_other_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_other_user_id is null or p_other_user_id = auth.uid() then
    raise exception 'Conversa inválida.';
  end if;

  delete from public.messages
  where (from_user = auth.uid() and to_user = p_other_user_id)
     or (from_user = p_other_user_id and to_user = auth.uid());

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.delete_conversation_with_user(uuid) to authenticated;

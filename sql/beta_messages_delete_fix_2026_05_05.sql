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

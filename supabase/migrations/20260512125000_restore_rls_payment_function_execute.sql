-- Corrige regressao critica: iniciar treino depende de policies que chamam
-- public.is_payment_ok(auth.uid()). Essa funcao precisa ser executavel por
-- authenticated, mas sem permitir consultar status financeiro de outro usuario.

create or replace function public.is_payment_ok(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and uid = auth.uid()
    and not exists (
      select 1
      from public.payments
      where user_id = uid
        and status in ('pending', 'overdue')
        and due_date < current_date
    );
$$;

revoke execute on function public.is_payment_ok(uuid) from public, anon;
grant execute on function public.is_payment_ok(uuid) to authenticated, service_role;


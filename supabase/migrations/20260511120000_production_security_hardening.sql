-- Treinova production hardening.
-- Objetivo: remover riscos apontados pelo Supabase Advisor sem alterar o fluxo webapp.

-- Views de financeiro devem respeitar as permissões/RLS do usuário que consulta.
do $$
begin
  if to_regclass('public.v_admin_payments') is not null then
    execute 'alter view public.v_admin_payments set (security_invoker = true)';
  end if;
  if to_regclass('public.v_coach_payments') is not null then
    execute 'alter view public.v_coach_payments set (security_invoker = true)';
  end if;
end $$;

-- RPCs SECURITY DEFINER nunca devem ficar executáveis por usuário anônimo.
-- O app usa JWT para chamadas autenticadas; cadastro/login continuam via Auth/Edge.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %I.%I(%s) from anon', fn.schema_name, fn.function_name, fn.args);
  end loop;
end $$;

-- Buckets públicos não precisam de policy SELECT ampla para servir public URLs.
-- Remover SELECT amplo impede listagem de todos os objetos por clientes.
drop policy if exists "app read all" on storage.objects;
drop policy if exists "avatars read all" on storage.objects;
drop policy if exists "branding read all" on storage.objects;
drop policy if exists "exercises read all" on storage.objects;

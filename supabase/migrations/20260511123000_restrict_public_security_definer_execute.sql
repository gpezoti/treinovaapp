do $$
declare
  fn record;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon',
      fn.nspname,
      fn.proname,
      fn.args
    );

    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      fn.nspname,
      fn.proname,
      fn.args
    );
  end loop;
end $$;


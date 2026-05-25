-- Treinova beta: safe coach-owned white-label save.
-- The client sends only editable branding fields; the function always writes
-- to auth.uid(), preventing cross-trainer writes and avoiding fragile client
-- upserts when RLS/schema cache is stale.

create or replace function public.save_my_coach_branding(p_payload jsonb default '{}'::jsonb)
returns public.coach_branding
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result public.coach_branding;
  v_allowed text[] := array[
    'app_name',
    'app_tagline',
    'logo_emoji',
    'logo_text',
    'logo_url',
    'primary_color',
    'accent_color',
    'default_theme',
    'instagram_handle'
  ];
  v_col text;
  v_insert_cols text[] := array['coach_id', 'updated_at'];
  v_insert_values text[] := array['$1', 'now()'];
  v_update_sets text[] := array['updated_at = now()'];
begin
  if v_uid is null or not public.is_coach(v_uid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  foreach v_col in array v_allowed loop
    if p_payload ? v_col and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'coach_branding'
        and column_name = v_col
    ) then
      v_insert_cols := array_append(v_insert_cols, quote_ident(v_col));
      v_insert_values := array_append(v_insert_values, format('nullif($2->>%L, '''')', v_col));
      v_update_sets := array_append(v_update_sets, format('%1$I = excluded.%1$I', v_col));
    end if;
  end loop;

  execute format(
    'insert into public.coach_branding (%s) values (%s)
     on conflict (coach_id) do update set %s
     returning *',
    array_to_string(v_insert_cols, ', '),
    array_to_string(v_insert_values, ', '),
    array_to_string(v_update_sets, ', ')
  )
  using v_uid, coalesce(p_payload, '{}'::jsonb)
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.save_my_coach_branding(jsonb) from public, anon;
grant execute on function public.save_my_coach_branding(jsonb) to authenticated;

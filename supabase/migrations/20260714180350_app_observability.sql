-- Treinova: eventos tecnicos minimos para operar fluxos criticos.
-- O cliente nunca grava diretamente. A Edge Function autenticada aceita apenas
-- eventos em uma allowlist e descarta detalhes que possam conter dados pessoais.

create table if not exists public.app_event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text null check (role in ('admin', 'coach', 'student')),
  event_name text not null check (event_name in (
    'app_boot_failed',
    'critical_load_failed',
    'workout_session_started',
    'workout_start_failed',
    'workout_completed',
    'workout_complete_failed',
    'rest_push_scheduled',
    'rest_push_schedule_failed',
    'signup_completed',
    'signup_failed',
    'checkout_started',
    'checkout_failed',
    'student_create_completed',
    'student_create_failed',
    'trainer_create_completed',
    'trainer_create_failed'
  )),
  outcome text not null check (outcome in ('success', 'failure')),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists app_event_log_created_at_idx
  on public.app_event_log (created_at desc);

create index if not exists app_event_log_user_created_at_idx
  on public.app_event_log (user_id, created_at desc);

create index if not exists app_event_log_failure_created_at_idx
  on public.app_event_log (created_at desc, event_name)
  where outcome = 'failure';

alter table public.app_event_log enable row level security;

revoke all on table public.app_event_log from anon, authenticated;
grant select, insert on table public.app_event_log to service_role;

create or replace function public.get_admin_operational_health(p_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours integer := greatest(1, least(coalesce(p_hours, 24), 168));
  v_since timestamptz;
  v_result jsonb;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_since := now() - make_interval(hours => v_hours);

  select jsonb_build_object(
    'hours', v_hours,
    'total_events', count(*),
    'failures_total', count(*) filter (where outcome = 'failure'),
    'workouts_started', count(*) filter (where event_name = 'workout_session_started' and outcome = 'success'),
    'workouts_completed', count(*) filter (where event_name = 'workout_completed' and outcome = 'success'),
    'checkout_failures', count(*) filter (where event_name = 'checkout_failed' and outcome = 'failure'),
    'push_failures', count(*) filter (where event_name = 'rest_push_schedule_failed' and outcome = 'failure')
  )
  into v_result
  from public.app_event_log
  where created_at >= v_since;

  return v_result || jsonb_build_object(
    'recent_failures', coalesce((
      select jsonb_agg(item order by item->>'created_at' desc)
      from (
        select jsonb_build_object(
          'event_name', event_name,
          'error_kind', coalesce(context->>'error_kind', 'unknown'),
          'source', coalesce(context->>'source', ''),
          'created_at', created_at
        ) as item
        from public.app_event_log
        where created_at >= v_since
          and outcome = 'failure'
        order by created_at desc
        limit 5
      ) failures
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_admin_operational_health(integer) from public, anon;
grant execute on function public.get_admin_operational_health(integer) to authenticated, service_role;

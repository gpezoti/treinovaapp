-- Treinova: gate unico de acesso da plataforma.
-- Bloqueia treinador com trial/assinatura vencida e tambem seus alunos.

create or replace function public.get_my_platform_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me_id uuid;
  v_me_role text;
  v_me_status text;
  v_me_coach_id uuid;

  v_target_id uuid;
  v_target_name text;
  v_target_status text;
  v_target_trial_ends_at timestamptz;
  v_target_period_ends_at timestamptz;

  v_sub_status text;
  v_sub_trial_ends_at timestamptz;
  v_sub_period_ends_at timestamptz;

  v_scope text := 'self';
  v_status text := 'not_applicable';
  v_ends_at timestamptz;
  v_locked boolean := false;
  v_reason text := 'ok';
  v_days_left integer := null;
begin
  select p.id, p.role, p.status, p.coach_id
    into v_me_id, v_me_role, v_me_status, v_me_coach_id
    from public.profiles p
   where p.id = auth.uid();

  if v_me_id is null then
    return jsonb_build_object(
      'locked', true,
      'status', 'profile_not_found',
      'reason', 'profile_not_found',
      'scope', 'self',
      'profile_role', null
    );
  end if;

  if coalesce(v_me_status, 'active') = 'blocked' then
    return jsonb_build_object(
      'locked', true,
      'status', 'blocked',
      'reason', 'profile_blocked',
      'scope', 'self',
      'profile_role', v_me_role,
      'blocked_profile_role', v_me_role
    );
  end if;

  if v_me_role = 'coach' then
    select p.id, p.full_name, p.subscription_status, p.trial_ends_at, p.subscription_current_period_ends_at
      into v_target_id, v_target_name, v_target_status, v_target_trial_ends_at, v_target_period_ends_at
      from public.profiles p
     where p.id = v_me_id;
    v_scope := 'self';
  elsif v_me_role = 'student' and v_me_coach_id is not null then
    select p.id, p.full_name, p.subscription_status, p.trial_ends_at, p.subscription_current_period_ends_at
      into v_target_id, v_target_name, v_target_status, v_target_trial_ends_at, v_target_period_ends_at
      from public.profiles p
     where p.id = v_me_coach_id
       and p.role = 'coach';
    v_scope := 'coach';
  else
    return jsonb_build_object(
      'locked', false,
      'status', 'not_applicable',
      'reason', 'not_applicable',
      'scope', 'self',
      'profile_role', v_me_role
    );
  end if;

  if v_target_id is null then
    return jsonb_build_object(
      'locked', false,
      'status', 'coach_not_found',
      'reason', 'coach_not_found',
      'scope', v_scope,
      'profile_role', v_me_role
    );
  end if;

  select cs.status, cs.trial_ends_at, cs.current_period_ends_at
    into v_sub_status, v_sub_trial_ends_at, v_sub_period_ends_at
    from public.coach_subscriptions cs
   where cs.coach_id = v_target_id
   limit 1;

  v_status := coalesce(v_sub_status, v_target_status, 'legacy');
  v_ends_at := coalesce(v_sub_trial_ends_at, v_target_trial_ends_at, v_sub_period_ends_at, v_target_period_ends_at);

  if v_ends_at is not null then
    v_days_left := ceil(extract(epoch from (v_ends_at - now())) / 86400.0)::int;
  end if;

  if v_status in ('legacy', 'active') then
    v_locked := false;
    v_reason := 'ok';
  elsif v_status = 'trialing' and v_ends_at is not null and v_ends_at > now() then
    v_locked := false;
    v_reason := 'trial_active';
  elsif v_status = 'trialing' then
    v_locked := true;
    v_status := 'expired';
    v_reason := 'trial_expired';
  elsif v_status in ('checkout_pending', 'past_due', 'expired', 'canceled', 'blocked') then
    v_locked := true;
    v_reason := 'subscription_required';
  else
    v_locked := false;
    v_reason := 'ok';
  end if;

  return jsonb_build_object(
    'locked', v_locked,
    'status', v_status,
    'reason', v_reason,
    'scope', v_scope,
    'profile_role', v_me_role,
    'blocked_profile_role', case
      when v_locked and v_scope = 'coach' then 'student'
      when v_locked then v_me_role
      else null
    end,
    'coach_id', case when v_scope = 'coach' then v_target_id else null end,
    'coach_name', case when v_scope = 'coach' then v_target_name else null end,
    'ends_at', v_ends_at,
    'daysLeft', v_days_left,
    'days_left', v_days_left
  );
end;
$$;

revoke execute on function public.get_my_platform_access() from public, anon;
grant execute on function public.get_my_platform_access() to authenticated, service_role;

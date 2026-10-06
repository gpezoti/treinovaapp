-- =============================================================================
-- Treinova · Financeiro fase 1 (2026-10-06)
--
-- Escopo:
--   1. Remove o bloqueio de treino por mensalidade de aluno (professor não
--      controla mais pagamentos de alunos nesta fase).
--   2. Corrige o gate de acesso da plataforma:
--        - trial válido não é bloqueado por checkout aberto/abandonado;
--        - assinatura "active" vencida há mais de 7 dias bloqueia;
--        - "past_due" tem carência de 3 dias;
--        - "canceled" mantém acesso até o fim do período pago.
--   3. RPCs do ADM para ver e gerenciar assinaturas dos treinadores.
--   4. Impede que um usuário altere sozinho colunas de cobrança/vínculo do
--      próprio perfil (subscription_*, trial_*, asaas_*, coach_id).
--
-- Não cria tabelas nem colunas novas. Não apaga dados de pagamentos antigos.
-- =============================================================================

-- 1) Mensalidade de aluno não bloqueia mais treino -----------------------------
-- Mantém a assinatura (usada por policies de sessions/set_logs), mas só
-- valida identidade. Para reativar o bloqueio, restaurar a versão de
-- 20260512125000_restore_rls_payment_function_execute.sql.
create or replace function public.is_payment_ok(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and uid = auth.uid();
$$;

revoke execute on function public.is_payment_ok(uuid) from public, anon;
grant execute on function public.is_payment_ok(uuid) to authenticated, service_role;


-- 2) Regra única de acesso (usada pelo gate e pelo painel do ADM) -------------
create or replace function public.platform_access_state(
  p_status text,
  p_trial_ends_at timestamptz,
  p_period_ends_at timestamptz
)
returns table(effective_status text, locked boolean, reason text, ends_at timestamptz)
language sql
stable
set search_path = public
as $$
  select
    case
      when s in ('legacy', 'active') and not active_expired then s
      when s = 'active' then 'past_due'
      when trial_ok then 'trialing'
      when s = 'trialing' then 'expired'
      else s
    end,
    case
      when s = 'legacy' then false
      when s = 'active' then active_expired
      when trial_ok then false
      when s = 'past_due' then not (p_period_ends_at is not null and p_period_ends_at > now() - interval '3 days')
      when s = 'canceled' then not (p_period_ends_at is not null and p_period_ends_at > now())
      when s in ('trialing', 'checkout_pending', 'expired', 'blocked') then true
      else false
    end,
    case
      when s = 'legacy' then 'ok'
      when s = 'active' and active_expired then 'subscription_required'
      when s = 'active' then 'ok'
      when trial_ok then 'trial_active'
      when s = 'trialing' then 'trial_expired'
      when s = 'past_due' and p_period_ends_at is not null and p_period_ends_at > now() - interval '3 days' then 'payment_grace'
      when s = 'canceled' and p_period_ends_at is not null and p_period_ends_at > now() then 'canceled_until_period_end'
      when s in ('checkout_pending', 'past_due', 'expired', 'canceled', 'blocked') then 'subscription_required'
      else 'ok'
    end,
    case
      when trial_ok then p_trial_ends_at
      when s in ('active', 'past_due', 'canceled') then p_period_ends_at
      else coalesce(p_trial_ends_at, p_period_ends_at)
    end
  from (
    select
      coalesce(p_status, 'legacy') as s,
      -- trial ainda válido vale para trialing, checkout aberto e checkout expirado
      (coalesce(p_status, 'legacy') in ('trialing', 'checkout_pending', 'expired')
        and p_trial_ends_at is not null and p_trial_ends_at > now()) as trial_ok,
      (coalesce(p_status, 'legacy') = 'active'
        and p_period_ends_at is not null and p_period_ends_at < now() - interval '7 days') as active_expired
  ) x;
$$;

revoke execute on function public.platform_access_state(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.platform_access_state(text, timestamptz, timestamptz) to authenticated, service_role;


create or replace function public.get_my_platform_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_sub public.coach_subscriptions%rowtype;
  v_scope text := 'self';
  v_state record;
  v_days_left integer := null;
begin
  select * into v_me from public.profiles p where p.id = auth.uid();

  if v_me.id is null then
    return jsonb_build_object('locked', true, 'status', 'profile_not_found', 'reason', 'profile_not_found',
      'scope', 'self', 'profile_role', null);
  end if;

  if coalesce(v_me.status, 'active') = 'blocked' then
    return jsonb_build_object('locked', true, 'status', 'blocked', 'reason', 'profile_blocked',
      'scope', 'self', 'profile_role', v_me.role, 'blocked_profile_role', v_me.role);
  end if;

  if v_me.role = 'coach' then
    v_target := v_me;
  elsif v_me.role = 'student' and v_me.coach_id is not null then
    select * into v_target from public.profiles p where p.id = v_me.coach_id and p.role = 'coach';
    v_scope := 'coach';
  else
    return jsonb_build_object('locked', false, 'status', 'not_applicable', 'reason', 'not_applicable',
      'scope', 'self', 'profile_role', v_me.role);
  end if;

  if v_target.id is null then
    return jsonb_build_object('locked', false, 'status', 'coach_not_found', 'reason', 'coach_not_found',
      'scope', v_scope, 'profile_role', v_me.role);
  end if;

  select * into v_sub from public.coach_subscriptions cs where cs.coach_id = v_target.id limit 1;

  select * into v_state from public.platform_access_state(
    coalesce(v_sub.status, v_target.subscription_status, 'legacy'),
    coalesce(v_sub.trial_ends_at, v_target.trial_ends_at),
    coalesce(v_sub.current_period_ends_at, v_target.subscription_current_period_ends_at)
  );

  if v_state.ends_at is not null then
    v_days_left := ceil(extract(epoch from (v_state.ends_at - now())) / 86400.0)::int;
  end if;

  return jsonb_build_object(
    'locked', v_state.locked,
    'status', v_state.effective_status,
    'reason', v_state.reason,
    'scope', v_scope,
    'profile_role', v_me.role,
    'blocked_profile_role', case
      when v_state.locked and v_scope = 'coach' then 'student'
      when v_state.locked then v_me.role
      else null
    end,
    'coach_id', case when v_scope = 'coach' then v_target.id else null end,
    'coach_name', case when v_scope = 'coach' then v_target.full_name else null end,
    'ends_at', v_state.ends_at,
    'daysLeft', v_days_left,
    'days_left', v_days_left,
    -- dados da própria assinatura só para o treinador
    'plan_amount', case when v_scope = 'self' then coalesce(v_sub.amount, v_target.subscription_price) else null end,
    'has_subscription', case when v_scope = 'self' then v_sub.asaas_subscription_id is not null else null end
  );
end;
$$;

revoke execute on function public.get_my_platform_access() from public, anon;
grant execute on function public.get_my_platform_access() to authenticated, service_role;


-- 3) Painel do ADM ------------------------------------------------------------
create or replace function public.admin_platform_subscriptions()
returns table(
  coach_id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  avatar_emoji text,
  profile_status text,
  created_at timestamptz,
  raw_status text,
  effective_status text,
  locked boolean,
  reason text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  amount numeric,
  last_event text,
  last_event_at timestamptz,
  asaas_subscription_id text,
  asaas_customer_id text,
  students_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas ADM master' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    p.avatar_emoji,
    p.status,
    p.created_at,
    coalesce(cs.status, p.subscription_status, 'legacy'),
    st.effective_status,
    st.locked,
    st.reason,
    coalesce(cs.trial_ends_at, p.trial_ends_at),
    coalesce(cs.current_period_ends_at, p.subscription_current_period_ends_at),
    coalesce(cs.amount, p.subscription_price, 59.90),
    cs.last_webhook_event,
    cs.last_webhook_at,
    coalesce(cs.asaas_subscription_id, p.asaas_subscription_id),
    coalesce(cs.asaas_customer_id, p.asaas_customer_id),
    (select count(*) from public.profiles s
      where s.coach_id = p.id and s.role = 'student' and s.status = 'approved')
  from public.profiles p
  left join public.coach_subscriptions cs on cs.coach_id = p.id
  cross join lateral public.platform_access_state(
    coalesce(cs.status, p.subscription_status, 'legacy'),
    coalesce(cs.trial_ends_at, p.trial_ends_at),
    coalesce(cs.current_period_ends_at, p.subscription_current_period_ends_at)
  ) st
  where p.role = 'coach'
  order by p.full_name nulls last;
end;
$$;

revoke execute on function public.admin_platform_subscriptions() from public, anon;
grant execute on function public.admin_platform_subscriptions() to authenticated, service_role;


-- Ações manuais do ADM:
--   extend_trial  → +N dias de teste
--   grant_paid    → pagamento recebido por fora do Asaas (PIX/dinheiro): ativo por +N dias
--   set_legacy    → cortesia / acesso liberado sem cobrança
--   block         → bloqueia treinador (e, pelo gate, os alunos dele)
create or replace function public.admin_set_coach_subscription(
  p_coach_id uuid,
  p_action text,
  p_days integer default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_sub public.coach_subscriptions%rowtype;
  v_profile public.profiles%rowtype;
  v_status text;
  v_trial_ends timestamptz;
  v_period_ends timestamptz;
  v_days integer := greatest(1, least(coalesce(p_days, 30), 366));
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas ADM master' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_coach_id and role = 'coach';
  if v_profile.id is null then
    raise exception 'Treinador não encontrado' using errcode = 'P0002';
  end if;

  select * into v_sub from public.coach_subscriptions where coach_id = p_coach_id;
  v_trial_ends := coalesce(v_sub.trial_ends_at, v_profile.trial_ends_at);
  v_period_ends := coalesce(v_sub.current_period_ends_at, v_profile.subscription_current_period_ends_at);

  if p_action = 'extend_trial' then
    v_status := 'trialing';
    v_trial_ends := greatest(coalesce(v_trial_ends, now()), now()) + make_interval(days => v_days);
  elsif p_action = 'grant_paid' then
    v_status := 'active';
    v_period_ends := greatest(coalesce(v_period_ends, now()), now()) + make_interval(days => v_days);
  elsif p_action = 'set_legacy' then
    v_status := 'legacy';
  elsif p_action = 'block' then
    v_status := 'blocked';
  else
    raise exception 'Ação inválida: %', p_action using errcode = '22023';
  end if;

  insert into public.coach_subscriptions as cs (
    coach_id, status, plan_code, amount, trial_started_at, trial_ends_at,
    current_period_ends_at, last_webhook_event, last_webhook_at
  ) values (
    p_coach_id, v_status, coalesce(v_profile.subscription_plan, 'coach_monthly'),
    coalesce(v_profile.subscription_price, 59.90), v_profile.trial_started_at, v_trial_ends,
    v_period_ends, 'ADMIN:' || p_action, now()
  )
  on conflict (coach_id) do update set
    status = excluded.status,
    trial_ends_at = excluded.trial_ends_at,
    current_period_ends_at = excluded.current_period_ends_at,
    last_webhook_event = excluded.last_webhook_event,
    last_webhook_at = excluded.last_webhook_at;

  update public.profiles set
    subscription_status = v_status,
    trial_ends_at = v_trial_ends,
    subscription_current_period_ends_at = v_period_ends,
    subscription_locked_at = case when v_status = 'blocked' then now() else null end,
    subscription_updated_at = now()
  where id = p_coach_id;

  return jsonb_build_object('ok', true, 'status', v_status,
    'trial_ends_at', v_trial_ends, 'current_period_ends_at', v_period_ends);
end;
$$;

revoke execute on function public.admin_set_coach_subscription(uuid, text, integer) from public, anon;
grant execute on function public.admin_set_coach_subscription(uuid, text, integer) to authenticated, service_role;


-- 4) Proteção de colunas sensíveis no auto-update do perfil -------------------
-- A policy "profiles self update" só fixa role/status. Sem este trigger, um
-- usuário logado conseguia alterar o próprio trial/assinatura ou trocar o
-- próprio coach_id (e passar a ler alunos de outro treinador).
-- ADM e service_role (edge functions, webhook) não são afetados.
create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> old.id or public.is_admin(auth.uid()) then
    return new;
  end if;

  new.coach_id := old.coach_id;
  new.trial_started_at := old.trial_started_at;
  new.trial_ends_at := old.trial_ends_at;
  new.subscription_status := old.subscription_status;
  new.subscription_plan := old.subscription_plan;
  new.subscription_price := old.subscription_price;
  new.subscription_current_period_ends_at := old.subscription_current_period_ends_at;
  new.subscription_locked_at := old.subscription_locked_at;
  new.asaas_customer_id := old.asaas_customer_id;
  new.asaas_checkout_id := old.asaas_checkout_id;
  new.asaas_checkout_url := old.asaas_checkout_url;
  new.asaas_subscription_id := old.asaas_subscription_id;
  return new;
end;
$$;

revoke execute on function public.guard_profile_self_update() from public, anon, authenticated;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update
  before update on public.profiles
  for each row execute function public.guard_profile_self_update();


-- 5) payments: professor não pode reatribuir cobrança para outro usuário ------
-- A policy de UPDATE não tinha WITH CHECK: o professor podia trocar user_id de
-- uma cobrança dele para qualquer perfil e depois gerar cobrança no Asaas.
do $$
begin
  if to_regclass('public.payments') is not null then
    drop policy if exists "payments coach update" on public.payments;
    create policy "payments coach update" on public.payments
      for update
      using (
        public.is_coach(auth.uid())
        and (
          receiver_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = user_id and p.coach_id = auth.uid())
        )
      )
      with check (
        public.is_coach(auth.uid())
        and exists (select 1 from public.profiles p where p.id = user_id and p.coach_id = auth.uid())
        and (receiver_id is null or receiver_id = auth.uid())
        and (invoice_url is null or invoice_url ~* '^https://')
        and (boleto_url is null or boleto_url ~* '^https://')
      );
  end if;
end $$;


-- 6) notifications: só para si mesmo, para alunos próprios (professor) ou ADM -
do $$
begin
  if to_regclass('public.notifications') is not null then
    -- em produção a policy permissiva se chama "notif staff create"
    drop policy if exists "notif staff create" on public.notifications;
    drop policy if exists "notif_insert" on public.notifications;
    create policy "notif_insert" on public.notifications
      for insert to authenticated
      with check (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
        or (
          public.is_coach(auth.uid())
          and exists (select 1 from public.profiles p where p.id = user_id and p.coach_id = auth.uid())
        )
      );
  end if;
end $$;

-- =============================================================================
-- Treinova - fallback SQL seguro para gerenciamento de treinador
-- 2026-05-07
--
-- Usado pelo app quando a Edge Function admin-user ainda estiver desatualizada.
-- Mantem permissao restrita ao ADM MASTER aprovado.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_update_trainer(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text default null,
  p_avatar_emoji text default null,
  p_status text default 'approved',
  p_role text default 'coach',
  p_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_role text;
  clean_email text;
  clean_name text;
begin
  if not public.is_admin(auth.uid()) then
    return jsonb_build_object('error', 'Apenas admin pode executar esta acao.');
  end if;

  clean_email := lower(trim(coalesce(p_email, '')));
  clean_name := trim(coalesce(p_full_name, ''));

  if clean_name = '' or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error', 'Nome e email valido sao obrigatorios.');
  end if;

  if coalesce(p_status, '') not in ('approved', 'blocked', 'pending') then
    return jsonb_build_object('error', 'Status invalido.');
  end if;

  if coalesce(p_role, '') not in ('coach', 'student') then
    return jsonb_build_object('error', 'Papel invalido.');
  end if;

  if p_password is not null and length(p_password) > 0 and length(p_password) < 6 then
    return jsonb_build_object('error', 'A nova senha precisa ter pelo menos 6 caracteres.');
  end if;

  select role into current_role
  from public.profiles
  where id = p_user_id;

  if current_role is null then
    return jsonb_build_object('error', 'Treinador nao encontrado.');
  end if;

  if current_role = 'admin' then
    return jsonb_build_object('error', 'Admin Master nao pode ser alterado por esta acao.');
  end if;

  update auth.users
  set
    email = clean_email,
    encrypted_password = case
      when p_password is not null and length(p_password) >= 6
        then extensions.crypt(p_password, extensions.gen_salt('bf'))
      else encrypted_password
    end,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('full_name', clean_name, 'role', p_role),
    updated_at = now()
  where id = p_user_id;

  update public.profiles
  set
    email = clean_email,
    full_name = clean_name,
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    avatar_emoji = coalesce(nullif(trim(coalesce(p_avatar_emoji, '')), ''), '🎯'),
    status = p_status,
    role = p_role,
    coach_id = case when p_role = 'coach' then null else coach_id end,
    must_reset_password = case
      when p_password is not null and length(p_password) >= 6 then false
      else must_reset_password
    end
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'action', 'admin_update_trainer');
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;

create or replace function public.admin_remove_trainer(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_role text;
begin
  if not public.is_admin(auth.uid()) then
    return jsonb_build_object('error', 'Apenas admin pode executar esta acao.');
  end if;

  select role into current_role
  from public.profiles
  where id = p_user_id;

  if current_role is null then
    return jsonb_build_object('error', 'Treinador nao encontrado.');
  end if;

  if current_role = 'admin' then
    return jsonb_build_object('error', 'Admin Master nao pode ser removido.');
  end if;

  update public.profiles
  set coach_id = null
  where coach_id = p_user_id
    and role = 'student';

  update public.profiles
  set
    role = 'student',
    status = 'blocked',
    coach_id = null,
    must_reset_password = true
  where id = p_user_id;

  update auth.users
  set
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'student', 'removed_trainer', true),
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'action', 'admin_remove_trainer');
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;

grant execute on function public.admin_update_trainer(uuid, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_remove_trainer(uuid) to authenticated, service_role;

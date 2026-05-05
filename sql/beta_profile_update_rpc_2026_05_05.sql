-- Treinova beta: safe profile/avatar updates without recursive profiles RLS.
-- Fixes production error:
-- "infinite recursion detected in policy for relation profiles"
--
-- The frontend should update profile fields through these SECURITY DEFINER
-- functions instead of direct table updates when profiles policies are complex.

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.update_my_avatar_url(p_avatar_url text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar_url text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  update public.profiles
  set avatar_url = nullif(p_avatar_url, '')
  where id = auth.uid()
  returning avatar_url into v_avatar_url;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  return v_avatar_url;
end;
$$;

grant execute on function public.update_my_avatar_url(text) to authenticated;

create or replace function public.clear_my_avatar_url()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  update public.profiles
  set avatar_url = null
  where id = auth.uid();

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
end;
$$;

grant execute on function public.clear_my_avatar_url() to authenticated;

create or replace function public.update_my_profile_basic(
  p_full_name text,
  p_avatar_emoji text
)
returns table(full_name text, avatar_emoji text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_avatar_emoji text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  update public.profiles
  set
    full_name = nullif(trim(coalesce(p_full_name, '')), ''),
    avatar_emoji = coalesce(nullif(trim(coalesce(p_avatar_emoji, '')), ''), '💪')
  where id = auth.uid()
  returning profiles.full_name, profiles.avatar_emoji
  into v_full_name, v_avatar_emoji;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  return query select v_full_name, v_avatar_emoji;
end;
$$;

grant execute on function public.update_my_profile_basic(text, text) to authenticated;

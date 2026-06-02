-- Treinova beta: hardening da busca social e do grafo de follows.
-- Fecha vazamento de PII/contexto entre treinadores sem remover o feed social.

drop policy if exists "profiles approved social discovery" on public.profiles;

create or replace function public.can_social_discover(
  requester uuid,
  target uuid,
  include_self boolean default true
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, role, status, coach_id
      from public.profiles
     where id = requester
  ),
  other_profile as (
    select id, role, status, coach_id
      from public.profiles
     where id = target
  )
  select exists (
    select 1
      from me, other_profile other
     where me.status = 'approved'
       and other.status = 'approved'
       and (
         (include_self and me.id = other.id)
         or me.role = 'admin'
         or other.role = 'admin'
         or (
           me.role = 'coach'
           and other.role = 'student'
           and other.coach_id = me.id
         )
         or (
           me.role = 'student'
           and me.coach_id is not null
           and (
             other.id = me.coach_id
             or (
               other.role = 'student'
               and other.coach_id = me.coach_id
             )
           )
         )
       )
  );
$$;

grant execute on function public.can_social_discover(uuid, uuid, boolean) to authenticated, service_role;

drop policy if exists "profiles social scoped read" on public.profiles;
create policy "profiles social scoped read"
  on public.profiles
  for select
  using (public.can_social_discover(auth.uid(), id, true));

alter table public.follows enable row level security;

delete from public.follows f
where not public.can_social_discover(f.follower_id, f.following_id, false);

drop policy if exists "follows insert self" on public.follows;
create policy "follows insert self"
  on public.follows
  for insert
  with check (
    follower_id = auth.uid()
    and following_id <> auth.uid()
    and public.can_social_discover(auth.uid(), following_id, false)
  );

drop policy if exists "feed social read" on public.feed_posts;
create policy "feed social read"
  on public.feed_posts
  for select
  using (
    public.is_admin(auth.uid())
    or student_id = auth.uid()
    or (
      public.is_coach(auth.uid())
      and exists (
        select 1
          from public.profiles s
         where s.id = feed_posts.student_id
           and s.coach_id = auth.uid()
      )
    )
    or exists (
      select 1
        from public.follows f
       where f.follower_id = auth.uid()
         and f.following_id = feed_posts.student_id
         and public.can_social_discover(auth.uid(), feed_posts.student_id, true)
    )
  );

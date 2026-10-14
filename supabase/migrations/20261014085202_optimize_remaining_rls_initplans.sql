-- Continue caching request-invariant RLS checks. The predicates stay the same;
-- only auth and role helpers are evaluated once per statement instead of once
-- per candidate row. The authenticated branding policy is expressed with TO
-- rather than the deprecated auth.role() helper.

alter policy "coach_branding admin all" on public.coach_branding
  using ((select is_admin((select auth.uid()))))
  with check ((select is_admin((select auth.uid()))));

alter policy "coach_branding coach delete own" on public.coach_branding
  using (
    coach_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  );

alter policy "coach_branding coach insert own" on public.coach_branding
  with check (
    coach_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  );

alter policy "coach_branding coach update own" on public.coach_branding
  using (
    coach_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  )
  with check (
    coach_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  );

alter policy "coach_branding read authenticated" on public.coach_branding
  to authenticated
  using (true);

alter policy "coach subscriptions admin read all" on public.coach_subscriptions
  using (
    (select exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    ))
  );

alter policy "coach subscriptions owner read" on public.coach_subscriptions
  using ((select auth.uid()) = coach_id);

alter policy "feed delete own or coach" on public.feed_posts
  using (
    student_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
    or (
      (select is_coach((select auth.uid())))
      and exists (
        select 1
        from public.profiles s
        where s.id = feed_posts.student_id
          and s.coach_id = (select auth.uid())
      )
    )
  );

alter policy "feed insert own" on public.feed_posts
  with check (student_id = (select auth.uid()));

alter policy "feed social read" on public.feed_posts
  using (
    (select is_admin((select auth.uid())))
    or student_id = (select auth.uid())
    or (
      (select is_coach((select auth.uid())))
      and exists (
        select 1
        from public.profiles s
        where s.id = feed_posts.student_id
          and s.coach_id = (select auth.uid())
      )
    )
    or exists (
      select 1
      from public.follows f
      where f.follower_id = (select auth.uid())
        and f.following_id = feed_posts.student_id
        and can_social_discover((select auth.uid()), feed_posts.student_id, true)
    )
  );

alter policy "follows delete self" on public.follows
  using (
    follower_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
  );

alter policy "follows insert self" on public.follows
  with check (
    follower_id = (select auth.uid())
    and following_id <> (select auth.uid())
    and can_social_discover((select auth.uid()), following_id, false)
  );

alter policy "follows read own graph" on public.follows
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
  );

alter policy "msgs delete pair" on public.messages
  using (
    from_user = (select auth.uid())
    or to_user = (select auth.uid())
    or (select is_admin((select auth.uid())))
  );

alter policy "notif_insert" on public.notifications
  with check (
    user_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
    or (
      (select is_coach((select auth.uid())))
      and exists (
        select 1
        from public.profiles p
        where p.id = notifications.user_id
          and p.coach_id = (select auth.uid())
      )
    )
  );

alter policy "payments coach update" on public.payments
  using (
    (select is_coach((select auth.uid())))
    and (
      receiver_id = (select auth.uid())
      or exists (
        select 1
        from public.profiles p
        where p.id = payments.user_id
          and p.coach_id = (select auth.uid())
      )
    )
  )
  with check (
    (select is_coach((select auth.uid())))
    and exists (
      select 1
      from public.profiles p
      where p.id = payments.user_id
        and p.coach_id = (select auth.uid())
    )
    and (receiver_id is null or receiver_id = (select auth.uid()))
    and (invoice_url is null or invoice_url ~* '^https://')
    and (boleto_url is null or boleto_url ~* '^https://')
  );

alter policy "progress delete self or admin" on public.progress_photos
  using (
    student_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
  );

alter policy "progress insert self" on public.progress_photos
  with check ((select auth.uid()) = student_id);

alter policy "progress read self coach or admin" on public.progress_photos
  using (
    student_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
    or exists (
      select 1
      from public.profiles p
      where p.id = progress_photos.student_id
        and p.coach_id = (select auth.uid())
    )
  );

alter policy "push subscriptions owner delete" on public.push_subscriptions
  using ((select auth.uid()) = user_id);

alter policy "push subscriptions owner insert" on public.push_subscriptions
  with check ((select auth.uid()) = user_id);

alter policy "push subscriptions owner read" on public.push_subscriptions
  using ((select auth.uid()) = user_id);

alter policy "push subscriptions owner update" on public.push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "rest timer jobs owner insert" on public.rest_timer_push_jobs
  with check ((select auth.uid()) = user_id);

alter policy "rest timer jobs owner read" on public.rest_timer_push_jobs
  using ((select auth.uid()) = user_id);

alter policy "rest timer jobs owner update" on public.rest_timer_push_jobs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "trainer payment accounts admin all" on public.trainer_payment_accounts
  using ((select is_admin((select auth.uid()))))
  with check ((select is_admin((select auth.uid()))));

alter policy "trainer payment accounts owner delete" on public.trainer_payment_accounts
  using (
    trainer_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  );

alter policy "trainer payment accounts owner insert" on public.trainer_payment_accounts
  with check (
    (select is_coach((select auth.uid())))
    and trainer_id = (select auth.uid())
  );

alter policy "trainer payment accounts owner read" on public.trainer_payment_accounts
  using (
    trainer_id = (select auth.uid())
    or (select is_admin((select auth.uid())))
  );

alter policy "trainer payment accounts owner update" on public.trainer_payment_accounts
  using (
    trainer_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  )
  with check (
    trainer_id = (select auth.uid())
    and (select is_coach((select auth.uid())))
  );

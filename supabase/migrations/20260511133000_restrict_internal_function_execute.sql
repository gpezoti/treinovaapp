revoke execute on function public.handle_coach_branding_default() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_payment_change() from public, anon, authenticated;
revoke execute on function public.handle_session_completed() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.sync_coach_student_follow() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.add_template_week(uuid)') is not null then
    revoke execute on function public.add_template_week(uuid) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.remove_template_week(uuid)') is not null then
    revoke execute on function public.remove_template_week(uuid) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.repeat_periodization_week(uuid,date,integer)') is not null then
    revoke execute on function public.repeat_periodization_week(uuid,date,integer) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.has_overdue_payment(uuid)') is not null then
    revoke execute on function public.has_overdue_payment(uuid) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.is_payment_ok(uuid)') is not null then
    revoke execute on function public.is_payment_ok(uuid) from public, anon, authenticated;
  end if;
end $$;


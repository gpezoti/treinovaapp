-- Treinova: funções SECURITY DEFINER não devem estar disponíveis para sessões anônimas.
-- Os fluxos abaixo são usados apenas por usuários autenticados ou Edge Functions com service_role.

revoke execute on function public.admin_update_trainer(
  uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.admin_update_trainer(
  uuid, text, text, text, text, text, text, text
) to authenticated, service_role;

revoke execute on function public.admin_update_trainer(
  uuid, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.admin_update_trainer(
  uuid, text, text, text, text, text, text, text, text
) to authenticated, service_role;

revoke execute on function public.can_manage_periodization_student(uuid) from public;
grant execute on function public.can_manage_periodization_student(uuid) to authenticated, service_role;

revoke execute on function public.can_social_discover(uuid, uuid, boolean) from public;
grant execute on function public.can_social_discover(uuid, uuid, boolean) to authenticated, service_role;

revoke execute on function public.ensure_coach_owns_student(uuid) from public;
grant execute on function public.ensure_coach_owns_student(uuid) to authenticated, service_role;

alter function public.set_updated_at() set search_path = public;
alter function public.touch_updated_at() set search_path = public;

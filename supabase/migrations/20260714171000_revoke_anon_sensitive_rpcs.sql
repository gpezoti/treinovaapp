-- Algumas funções legadas receberam GRANT explícito para anon.
-- Mantém apenas chamadas autenticadas ou service_role.

revoke execute on function public.can_manage_periodization_student(uuid) from anon;
revoke execute on function public.can_social_discover(uuid, uuid, boolean) from anon;
revoke execute on function public.ensure_coach_owns_student(uuid) from anon;

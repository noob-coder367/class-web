-- Hardening: các SECURITY DEFINER function nội bộ không được gọi qua PostgREST.
-- Trigger vẫn chạy được sau khi revoke EXECUTE khỏi các role API.
do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke execute on function public.handle_new_user() from public, anon, authenticated;
  end if;
  if to_regprocedure('public.is_admin()') is not null then
    revoke execute on function public.is_admin() from public, anon, authenticated;
  end if;
  if to_regprocedure('public.protect_profile_privileges()') is not null then
    revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
  end if;
  if to_regprocedure('public.current_user_is_google()') is not null then
    revoke execute on function public.current_user_is_google() from anon;
  end if;
  -- Không để object resolution phụ thuộc search_path của caller.
  if to_regprocedure('public.update_updated_at()') is not null then
    alter function public.update_updated_at() set search_path = public;
  end if;
end $$;

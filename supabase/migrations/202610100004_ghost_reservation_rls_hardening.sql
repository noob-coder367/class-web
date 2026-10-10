-- Ensure all ghost-account reservation RPCs run independently of caller RLS.
alter function public.ghost_cleanup_orphaned_reservations() set row_security = off;
alter function public.ghost_reserve_account() set row_security = off;
alter function public.ghost_release_reservation(uuid) set row_security = off;

revoke all on function public.ghost_cleanup_orphaned_reservations() from public, anon, authenticated;
revoke all on function public.ghost_reserve_account() from public, anon, authenticated;
revoke all on function public.ghost_release_reservation(uuid) from public, anon, authenticated;
grant execute on function public.ghost_cleanup_orphaned_reservations() to service_role;
grant execute on function public.ghost_reserve_account() to service_role;
grant execute on function public.ghost_release_reservation(uuid) to service_role;

-- The reservation user_id FK uses ON DELETE SET NULL, so orphaned Auth users
-- are represented by created rows with user_id IS NULL. Avoid querying auth.users
-- from the API role; this removes the production 42501 permission failure.
create or replace function public.ghost_cleanup_orphaned_reservations()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_released integer;
begin
  update public.ghost_account_reservations
    set status = 'released', finalized_at = now(), expires_at = now()
    where status = 'reserved' and expires_at < now();

  update public.ghost_account_reservations
    set status = 'released', finalized_at = now(), expires_at = now()
    where status = 'created' and user_id is null;

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

revoke all on function public.ghost_cleanup_orphaned_reservations() from public, anon, authenticated;
grant execute on function public.ghost_cleanup_orphaned_reservations() to service_role;
select public.ghost_cleanup_orphaned_reservations();

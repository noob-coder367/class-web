-- Restore the trusted server-only finalization RPC without changing user data.
-- Applied to production as migration restore_ghost_finalize_production_safe.
-- Keep this file in source control so the repository matches production.

create or replace function public.ghost_finalize_account(
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_updated integer;
begin
  if p_reservation_id is null or p_user_id is null then
    return false;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return false;
  end if;

  update public.ghost_account_reservations
     set status = 'created',
         user_id = p_user_id,
         finalized_at = pg_catalog.now(),
         expires_at = pg_catalog.now()
   where id = p_reservation_id
     and status = 'reserved'
     and user_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

alter function public.ghost_finalize_account(uuid, uuid) owner to postgres;
grant usage on schema public to service_role;
grant select, update on table public.ghost_account_reservations to postgres, service_role;
revoke all on function public.ghost_finalize_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ghost_finalize_account(uuid, uuid) to service_role;

-- Ensure the ghost reservation RPC can update its RLS-protected table through PostgREST.
create or replace function public.ghost_finalize_account(p_reservation_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.ghost_account_reservations
    set status = 'created', user_id = p_user_id, finalized_at = now(), expires_at = now()
    where id = p_reservation_id and status = 'reserved';
  return found;
end;
$$;

revoke all on function public.ghost_finalize_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ghost_finalize_account(uuid, uuid) to service_role;

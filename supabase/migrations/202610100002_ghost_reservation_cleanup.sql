-- Ghost-account reservation cleanup and finalize-order hardening.
-- Additive and safe to re-run. Apply before deploying the matching backend.

create or replace function public.ghost_cleanup_orphaned_reservations()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_released integer;
begin
  update public.ghost_account_reservations r
    set status = 'released', finalized_at = now(), expires_at = now()
    where r.status = 'reserved' and r.expires_at < now();

  update public.ghost_account_reservations r
    set status = 'released', finalized_at = now(), expires_at = now()
    where r.status = 'created'
      and (r.user_id is null or not exists (
        select 1 from auth.users u where u.id = r.user_id
      ));

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

-- Repair existing quota-consuming rows that were finalized without a valid user.
select public.ghost_cleanup_orphaned_reservations();

create or replace function public.ghost_reserve_account()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_index bigint;
  v_reservation uuid;
begin
  perform pg_advisory_xact_lock(hashtext('quizly:ghost-account-sequence'));
  perform public.ghost_cleanup_orphaned_reservations();

  if (select count(*) from public.ghost_account_reservations
      where local_day = v_day and status in ('reserved', 'created')) >= 2 then
    raise exception 'ghost_daily_limit' using errcode = 'P0001';
  end if;

  select next_index into v_index from public.ghost_account_sequence where id = true for update;
  update public.ghost_account_sequence set next_index = v_index + 1, updated_at = now() where id = true;
  insert into public.ghost_account_reservations (ghost_index, local_day)
    values (v_index, v_day) returning id into v_reservation;
  return jsonb_build_object('id', v_reservation, 'ghost_index', v_index, 'local_day', v_day);
end;
$$;

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

create or replace function public.ghost_release_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.ghost_account_reservations
    set status = 'released', finalized_at = now(), expires_at = now()
    where id = p_reservation_id
      and (status = 'reserved' or (status = 'created' and user_id is null));
  return found;
end;
$$;

revoke all on function public.ghost_cleanup_orphaned_reservations() from public, anon, authenticated;
revoke all on function public.ghost_reserve_account() from public, anon, authenticated;
revoke all on function public.ghost_finalize_account(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ghost_release_reservation(uuid) from public, anon, authenticated;
grant execute on function public.ghost_cleanup_orphaned_reservations() to service_role;
grant execute on function public.ghost_reserve_account() to service_role;
grant execute on function public.ghost_finalize_account(uuid, uuid) to service_role;
grant execute on function public.ghost_release_reservation(uuid) to service_role;

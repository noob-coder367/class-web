-- Account management for Quizly: atomic ghost-account reservations and safe profile helpers.
-- Additive only; does not restore removed class-management or AI schema.

create table if not exists public.ghost_account_sequence (
  id boolean primary key default true check (id),
  next_index bigint not null default 1 check (next_index > 0),
  updated_at timestamptz not null default now()
);

insert into public.ghost_account_sequence (id, next_index)
values (true, 1)
on conflict (id) do nothing;

create table if not exists public.ghost_account_reservations (
  id uuid primary key default gen_random_uuid(),
  ghost_index bigint not null unique,
  local_day date not null,
  status text not null default 'reserved',
  user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint ghost_reservation_status_check check (status in ('reserved', 'created', 'released'))
);

create index if not exists ghost_reservations_day_status_idx
  on public.ghost_account_reservations (local_day, status);

alter table public.ghost_account_sequence enable row level security;
alter table public.ghost_account_reservations enable row level security;
revoke all on table public.ghost_account_sequence from anon, authenticated;
revoke all on table public.ghost_account_reservations from anon, authenticated;
grant all on table public.ghost_account_sequence, public.ghost_account_reservations to service_role;

create or replace function public.ghost_reserve_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_index bigint;
  v_reservation uuid;
begin
  perform pg_advisory_xact_lock(hashtext('quizly:ghost-account-sequence'));
  update public.ghost_account_reservations
    set status = 'released', finalized_at = now()
    where status = 'reserved' and expires_at < now();

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
as $$
begin
  update public.ghost_account_reservations
    set status = 'released', finalized_at = now(), expires_at = now()
    where id = p_reservation_id and status = 'reserved';
  return found;
end;
$$;

revoke all on function public.ghost_reserve_account() from public, anon, authenticated;
revoke all on function public.ghost_finalize_account(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ghost_release_reservation(uuid) from public, anon, authenticated;
grant execute on function public.ghost_reserve_account() to service_role;
grant execute on function public.ghost_finalize_account(uuid, uuid) to service_role;
grant execute on function public.ghost_release_reservation(uuid) to service_role;

-- Public room lifecycle: allow joining an active public room only after its host leaves.
-- Visibility is stored in game_rooms.settings->>'is_public' so existing rooms remain public.
create or replace function public.join_game_room_atomic(
  p_room_id uuid,
  p_user_id uuid,
  p_team_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.game_rooms%rowtype;
  v_game_id uuid;
  v_existing_team uuid;
  v_selected_team uuid;
  v_capacity integer;
  v_occupancy integer;
  v_host_present boolean;
begin
  if p_room_id is null or p_user_id is null then
    raise exception 'Room and user identifiers are required' using errcode = '22023';
  end if;

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found' using errcode = 'P0002'; end if;

  select exists (
    select 1 from public.game_room_players
    where room_id = p_room_id and user_id = v_room.host_id
  ) into v_host_present;

  if v_room.status = 'lobby' then
    null;
  elsif v_room.status = 'playing'
    and coalesce((v_room.settings->>'is_public')::boolean, true)
    and not v_host_present then
    null;
  else
    raise exception 'Room has already started' using errcode = '40001';
  end if;

  if coalesce((v_room.settings->>'single_device_mode')::boolean, false) and v_room.host_id <> p_user_id then
    raise exception 'Single-device rooms cannot be joined by other users' using errcode = '42501';
  end if;

  select id into v_game_id from public.game_games where room_id = p_room_id;
  if not found then raise exception 'Game not found' using errcode = 'P0002'; end if;

  select team_id into v_existing_team from public.game_room_players
  where room_id = p_room_id and user_id = p_user_id;
  if found then return v_existing_team; end if;

  v_capacity := coalesce((v_room.settings->>'max_players_per_team')::integer, 4);
  if v_capacity < 1 or v_capacity > 12 then
    raise exception 'Invalid team capacity in room settings' using errcode = '22023';
  end if;

  if p_team_id is not null then
    select id into v_selected_team from public.game_teams where id = p_team_id and game_id = v_game_id;
    if not found then raise exception 'Selected team does not belong to this room' using errcode = '22023'; end if;
    select count(*)::integer into v_occupancy from public.game_room_players
    where room_id = p_room_id and team_id = v_selected_team;
    if v_occupancy >= v_capacity then return null; end if;
  else
    select t.id, count(p.id)::integer into v_selected_team, v_occupancy
    from public.game_teams t
    left join public.game_room_players p on p.room_id = p_room_id and p.team_id = t.id
    where t.game_id = v_game_id
    group by t.id
    having count(p.id) < v_capacity
    order by count(p.id), t.turn_order asc nulls last, t.created_at asc, t.id asc
    limit 1;
    if not found then return null; end if;
  end if;

  insert into public.game_room_players (room_id, user_id, team_id)
  values (p_room_id, p_user_id, v_selected_team);
  return v_selected_team;
end;
$$;
revoke all on function public.join_game_room_atomic(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_game_room_atomic(uuid, uuid, uuid) to service_role;

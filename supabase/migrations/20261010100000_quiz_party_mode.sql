-- Quiz Party game mode. This is additive: Treasure Race continues to use its existing engine.
alter table public.game_rooms
  drop constraint if exists game_rooms_mode_check;

alter table public.game_rooms
  add constraint game_rooms_mode_check
  check (game_mode in ('treasure_race', 'quiz_party'));

-- Keep the existing atomic room aggregate creation, but choose the mode in the
-- same transaction so the room can never be visible with the wrong game mode.
create or replace function public.create_game_room_atomic_v2(
  p_room_id uuid,
  p_game_id uuid,
  p_host_id uuid,
  p_quiz_id uuid,
  p_code text,
  p_settings jsonb,
  p_team_count integer,
  p_question_limit integer,
  p_game_mode text,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_id uuid;
  v_existing_mode text;
begin
  if p_game_mode not in ('treasure_race', 'quiz_party') then
    raise exception 'Unsupported game mode' using errcode = '22023';
  end if;

  -- Take the same lock as the legacy RPC before checking the key. Otherwise
  -- two calls can both observe no claim, then serialize only inside the legacy
  -- RPC and let the later call change the already-created room's mode.
  if p_request_id is not null and p_host_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_host_id::text || ':' || p_request_id::text || ':create_room', 0)
    );

    -- A reused idempotency key may return an existing room. Do not silently
    -- convert it to another game mode.
    select r.game_mode into v_existing_mode
    from public.game_action_claims c
    join public.game_rooms r on r.id = c.room_id
    where c.user_id = p_host_id
      and c.request_id = p_request_id
      and c.action = 'create_room';

    if v_existing_mode is not null and v_existing_mode <> p_game_mode then
      raise exception 'Idempotency key already used for a different game mode' using errcode = '22023';
    end if;
  end if;

  v_room_id := public.create_game_room_atomic(
    p_room_id,
    p_game_id,
    p_host_id,
    p_quiz_id,
    p_code,
    p_settings,
    p_team_count,
    p_question_limit,
    p_request_id
  );

  update public.game_rooms
  set game_mode = p_game_mode
  where id = v_room_id;

  return v_room_id;
end;
$$;

revoke all on function public.create_game_room_atomic_v2(uuid, uuid, uuid, uuid, text, jsonb, integer, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.create_game_room_atomic_v2(uuid, uuid, uuid, uuid, text, jsonb, integer, integer, text, uuid) to service_role;

-- Enforce the opening phrase as the first link in online games.
create or replace function public.apply_word_chain_turn_atomic(
  p_room_id uuid, p_user_id uuid, p_action text, p_phrase text, p_payload_hash text, p_request_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_room public.word_chain_rooms%rowtype;
  v_player_team uuid;
  v_current_team public.word_chain_teams%rowtype;
  v_last_phrase text;
  v_last_parts text[];
  v_next_team uuid;
  v_existing_hash text;
begin
  if p_action not in ('answer','skip') or p_request_id is null or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid action request' using errcode = '22023';
  end if;
  select * into v_room from public.word_chain_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.word_chain_players where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'Player is not in room' using errcode = '42501';
  end if;
  if exists (select 1 from public.word_chain_action_claims where user_id = p_user_id and request_id = p_request_id) then
    select payload_hash into v_existing_hash from public.word_chain_action_claims
    where user_id = p_user_id and request_id = p_request_id and room_id = p_room_id and action = p_action;
    if found then
      if v_existing_hash is distinct from p_payload_hash then raise exception 'Idempotency key payload changed' using errcode = '22023'; end if;
      return true;
    end if;
    raise exception 'Idempotency key reused' using errcode = '22023';
  end if;
  if v_room.status <> 'playing' then raise exception 'Room is not playing' using errcode = '40001'; end if;
  select team_id into v_player_team from public.word_chain_players where room_id = p_room_id and user_id = p_user_id;
  if v_player_team is distinct from v_room.current_team_id then raise exception 'Not your team turn' using errcode = '42501'; end if;
  select * into v_current_team from public.word_chain_teams where id = v_room.current_team_id and room_id = p_room_id for update;
  if not found or v_current_team.turns_used >= v_current_team.turn_quota then raise exception 'Current team has no turns' using errcode = '40001'; end if;
  if p_action = 'answer' then
    if p_phrase is null or char_length(p_phrase) not between 1 and 80 or not (p_phrase = any(v_room.allowed_phrases)) then
      raise exception 'Phrase is not in this game''s source' using errcode = '22023';
    end if;
    select coalesce(
      (select phrase from public.word_chain_turns where room_id = p_room_id and action = 'answer' order by turn_number desc limit 1),
      v_room.starting_phrase
    ) into v_last_phrase;
    if v_last_phrase is not null then
      v_last_parts := string_to_array(v_last_phrase, ' ');
      if split_part(p_phrase, ' ', 1) <> v_last_parts[array_length(v_last_parts,1)] then
        raise exception 'Phrase does not continue the final word' using errcode = '22023';
      end if;
    end if;
    if p_phrase = v_room.starting_phrase or exists (select 1 from public.word_chain_turns where room_id = p_room_id and phrase = p_phrase) then
      raise exception 'Phrase already used' using errcode = '23505';
    end if;
  elsif p_phrase is not null then
    raise exception 'Skip action cannot include phrase' using errcode = '22023';
  end if;
  insert into public.word_chain_action_claims(user_id, request_id, room_id, action, payload_hash)
  values (p_user_id, p_request_id, p_room_id, p_action, p_payload_hash);
  insert into public.word_chain_turns(room_id, turn_number, team_id, player_id, action, phrase)
  values (p_room_id, v_room.turns_used + 1, v_current_team.id, p_user_id, p_action, p_phrase);
  update public.word_chain_teams set turns_used = turns_used + 1 where id = v_current_team.id;
  if v_room.turns_used + 1 >= v_room.total_turns then
    update public.word_chain_rooms set status = 'finished', turns_used = turns_used + 1, current_team_id = null, updated_at = now() where id = p_room_id;
    return true;
  end if;
  select id into v_next_team from public.word_chain_teams
  where room_id = p_room_id and turns_used < turn_quota and turn_order > v_current_team.turn_order
  order by turn_order limit 1;
  if v_next_team is null then
    select id into v_next_team from public.word_chain_teams
    where room_id = p_room_id and turns_used < turn_quota order by turn_order limit 1;
  end if;
  update public.word_chain_rooms set turns_used = turns_used + 1, current_team_id = v_next_team, updated_at = now() where id = p_room_id;
  return true;
end;
$$;

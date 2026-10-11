-- Add unrestricted word-chain answers while preserving turn order, chaining and duplicate checks.
alter table public.word_chain_rooms drop constraint if exists word_chain_rooms_validation_mode_check;
alter table public.word_chain_rooms add constraint word_chain_rooms_validation_mode_check check (validation_mode in ('strict','expanded','free'));

create or replace function public.create_word_chain_room_atomic(
  p_room_id uuid, p_host_id uuid, p_code text, p_title text,
  p_source_mode text, p_topic text, p_validation_mode text, p_total_turns integer,
  p_team_names text[], p_turn_quotas integer[], p_allowed_phrases text[], p_dictionary_version text,
  p_payload_hash text,
  p_request_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
  v_first_team uuid;
  v_existing_room uuid;
  v_existing_hash text;
begin
  v_count := coalesce(array_length(p_team_names, 1), 0);
  if p_room_id is null or p_host_id is null or p_code !~ '^[A-Z0-9]{6}$'
     or p_title is null or char_length(trim(p_title)) not between 1 and 80
     or p_source_mode not in ('topic','text','combined')
     or p_validation_mode not in ('strict','expanded','free')
     or p_total_turns < 2 or p_total_turns > 200
     or v_count < 2 or v_count > 8 or array_length(p_turn_quotas,1) <> v_count
     or cardinality(p_allowed_phrases) < 2 or cardinality(p_allowed_phrases) > 10000
     or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid word-chain room configuration' using errcode = '22023';
  end if;
  if (select sum(q.value) from unnest(p_turn_quotas) as q(value)) <> p_total_turns
     or exists (select 1 from unnest(p_turn_quotas) as q(value) where q.value < 1 or q.value > p_total_turns)
     or exists (select 1 from unnest(p_team_names) as q(value) where q.value is null or char_length(trim(q.value)) not between 1 and 32)
     or (select count(distinct lower(trim(q.value))) from unnest(p_team_names) as q(value)) <> v_count then
    raise exception 'Invalid team names or turn allocation' using errcode = '22023';
  end if;
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_host_id::text || ':' || p_request_id::text || ':word_chain_create', 0));
    select room_id, payload_hash into v_existing_room, v_existing_hash from public.word_chain_action_claims
    where user_id = p_host_id and request_id = p_request_id and action = 'create';
    if v_existing_room is not null then
      if v_existing_hash is distinct from p_payload_hash then raise exception 'Idempotency key payload changed' using errcode = '22023'; end if;
      return v_existing_room;
    end if;
    if exists (select 1 from public.word_chain_action_claims where user_id = p_host_id and request_id = p_request_id) then
      raise exception 'Idempotency key already used' using errcode = '22023';
    end if;
  end if;
  insert into public.word_chain_rooms(id, code, host_id, title, source_mode, topic, validation_mode, total_turns, allowed_phrases, dictionary_version)
  values (p_room_id, p_code, p_host_id, trim(p_title), p_source_mode, nullif(trim(p_topic),''), p_validation_mode, p_total_turns, p_allowed_phrases, p_dictionary_version);
  insert into public.word_chain_teams(room_id, name, turn_order, turn_quota)
  select p_room_id, p_team_names[s.i], s.i - 1, p_turn_quotas[s.i] from generate_subscripts(p_team_names, 1) as s(i);
  select id into v_first_team from public.word_chain_teams where room_id = p_room_id order by turn_order limit 1;
  update public.word_chain_rooms set current_team_id = v_first_team where id = p_room_id;
  insert into public.word_chain_players(room_id, user_id, team_id) values (p_room_id, p_host_id, v_first_team);
  if p_request_id is not null then
    insert into public.word_chain_action_claims(user_id, request_id, room_id, action, payload_hash)
    values (p_host_id, p_request_id, p_room_id, 'create', p_payload_hash);
  end if;
  return p_room_id;
end;
$$;


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
    if p_phrase is null or char_length(p_phrase) not between 1 and 80 or (v_room.validation_mode <> 'free' and not (p_phrase = any(v_room.allowed_phrases))) then
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


-- Add an authoritative opening phrase for Nối Từ games.
alter table public.word_chain_rooms
  add column if not exists starting_phrase text;

create or replace function public.start_word_chain_room_atomic(p_room_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_room public.word_chain_rooms%rowtype;
  v_active integer;
  v_starting_phrase text;
begin
  select * into v_room from public.word_chain_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found' using errcode = 'P0002'; end if;
  if v_room.host_id <> p_user_id then raise exception 'Only host can start the room' using errcode = '42501'; end if;
  if v_room.status <> 'lobby' then return false; end if;
  select count(distinct team_id) into v_active from public.word_chain_players where room_id = p_room_id;
  if v_active < 2 then raise exception 'At least two teams need players' using errcode = '22023'; end if;

  -- Pick an opening phrase that has at least one possible continuation from this room's source.
  select candidate.phrase into v_starting_phrase
  from unnest(v_room.allowed_phrases) as candidate(phrase)
  where array_length(string_to_array(candidate.phrase, ' '), 1) >= 2
    and exists (
      select 1 from unnest(v_room.allowed_phrases) as next_phrase(phrase)
      where split_part(next_phrase.phrase, ' ', 1) = (string_to_array(candidate.phrase, ' '))[array_length(string_to_array(candidate.phrase, ' '), 1)]
        and next_phrase.phrase <> candidate.phrase
    )
  order by random()
  limit 1;

  if v_starting_phrase is null then
    raise exception 'Source has no valid opening chain. Add more text or choose another source.' using errcode = '22023';
  end if;

  update public.word_chain_rooms
  set status = 'playing', starting_phrase = v_starting_phrase, updated_at = now()
  where id = p_room_id;
  return true;
end;
$$;

-- Game atomicity helpers. Additive and safe to apply after existing game migrations.
-- Do not run this file on production from the audit workspace.

create table if not exists public.game_action_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  room_id uuid references public.game_rooms(id) on delete cascade,
  game_id uuid references public.game_games(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint game_action_claims_action_check check (action in ('answer', 'create_room', 'move', 'move_batch', 'dice_complete', 'switch_turn')),
  unique (user_id, request_id, action)
);

alter table public.game_action_claims enable row level security;
revoke all on table public.game_action_claims from anon, authenticated;
grant all on table public.game_action_claims to service_role;

create or replace function public.create_game_room_atomic(
  p_room_id uuid,
  p_game_id uuid,
  p_host_id uuid,
  p_quiz_id uuid,
  p_code text,
  p_settings jsonb,
  p_team_count integer,
  p_question_limit integer,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_first_team uuid;
begin
  if p_room_id is null or p_game_id is null or p_host_id is null or p_quiz_id is null then
    raise exception 'Required room identifiers are missing' using errcode = '22023';
  end if;
  if p_code is null or p_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Invalid room code' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object' then
    raise exception 'Room settings must be a JSON object' using errcode = '22023';
  end if;
  if p_team_count is null or p_team_count < 2 or p_team_count > 8 then
    raise exception 'Team count must be between 2 and 8' using errcode = '22023';
  end if;
  if p_question_limit is null or p_question_limit < 1 then
    raise exception 'Question limit must be positive' using errcode = '22023';
  end if;
  if p_question_limit > (select count(*) from public.questions where quiz_id = p_quiz_id) then
    raise exception 'Question limit exceeds quiz question count' using errcode = '22023';
  end if;

  -- Serialize requests sharing the same idempotency key before checking or creating.
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_host_id::text || ':' || p_request_id::text || ':create_room', 0));
    select room_id into v_existing
    from public.game_action_claims
    where user_id = p_host_id and request_id = p_request_id and action = 'create_room';
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  if not exists (
    select 1 from public.quizzes q
    where q.id = p_quiz_id and q.owner_id = p_host_id
  ) then
    raise exception 'Quiz is not owned by host' using errcode = '42501';
  end if;

  insert into public.game_rooms (id, code, host_id, quiz_id, game_mode, status, settings)
  values (p_room_id, p_code, p_host_id, p_quiz_id, 'treasure_race', 'lobby', p_settings);

  insert into public.game_games (id, room_id, status, phase, total_questions)
  values (p_game_id, p_room_id, 'ordering', 'question', p_question_limit);

  insert into public.game_teams (game_id, name, token, position, maze_x, maze_y)
  select p_game_id,
         'Đội ' || n,
         (array['blue','green','purple','orange','pink','cyan','red','gold'])[n],
         0, 0, 0
  from generate_series(1, p_team_count) as n;

  select id into v_first_team
  from public.game_teams
  where game_id = p_game_id
  order by created_at, id
  limit 1;

  insert into public.game_room_players (room_id, user_id, team_id)
  values (p_room_id, p_host_id, v_first_team);

  if p_request_id is not null then
    insert into public.game_action_claims (user_id, request_id, action, room_id, game_id)
    values (p_host_id, p_request_id, 'create_room', p_room_id, p_game_id);
  end if;

  return p_room_id;
end;
$$;

revoke all on function public.create_game_room_atomic(uuid, uuid, uuid, uuid, text, jsonb, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_game_room_atomic(uuid, uuid, uuid, uuid, text, jsonb, integer, integer, uuid) to service_role;

create or replace function public.start_game_atomic(
  p_user_id uuid,
  p_room_id uuid,
  p_game_id uuid,
  p_team_layout jsonb,
  p_maze_seed bigint,
  p_maze_layout jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_room public.game_rooms%rowtype;
  v_game public.game_games%rowtype;
  v_team_count integer;
  v_active_team_count integer;
begin
  if p_user_id is null or p_room_id is null or p_game_id is null or p_maze_seed is null then
    raise exception 'Required start-game fields are missing' using errcode = '22023';
  end if;
  if jsonb_typeof(p_team_layout) <> 'array' or jsonb_typeof(p_maze_layout) <> 'object' then
    raise exception 'Invalid start-game layout' using errcode = '22023';
  end if;

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found' using errcode = 'P0002'; end if;
  if v_room.host_id <> p_user_id then
    raise exception 'Only the host can start the game' using errcode = '42501';
  end if;

  select * into v_game from public.game_games where id = p_game_id and room_id = p_room_id for update;
  if not found then raise exception 'Game not found' using errcode = 'P0002'; end if;
  if v_room.status <> 'lobby' or v_game.status <> 'ordering' then
    return false;
  end if;

  select count(*) into v_team_count from public.game_teams where game_id = p_game_id;
  if v_team_count < 2 or v_team_count > 8 or jsonb_array_length(p_team_layout) <> v_team_count then
    raise exception 'Invalid team layout count' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_team_layout) e
    where nullif(e->>'team_id','') is null
       or nullif(e->>'turn_order','') is null
       or nullif(e->>'maze_x','') is null
       or nullif(e->>'maze_y','') is null
  ) then
    raise exception 'Incomplete team layout entry' using errcode = '22023';
  end if;
  if (select count(distinct e->>'team_id') from jsonb_array_elements(p_team_layout) e) <> v_team_count
     or exists (
       select 1 from jsonb_array_elements(p_team_layout) e
       where not exists (
         select 1 from public.game_teams t
         where t.id = (e->>'team_id')::uuid and t.game_id = p_game_id
       )
     ) then
    raise exception 'Team layout does not match this game' using errcode = '22023';
  end if;

  select count(distinct rp.team_id) into v_active_team_count
  from public.game_room_players rp
  where rp.room_id = p_room_id and rp.team_id is not null;
  if not coalesce((v_room.settings->>'single_device_mode')::boolean, false) and v_active_team_count < 2 then
    raise exception 'At least two teams must have players' using errcode = '22023';
  end if;

  update public.game_teams t set
    turn_order = (e->>'turn_order')::integer,
    maze_x = (e->>'maze_x')::integer,
    maze_y = (e->>'maze_y')::integer,
    position = 0
  from jsonb_array_elements(p_team_layout) e
  where t.id = (e->>'team_id')::uuid and t.game_id = p_game_id;

  update public.game_games set
    status = 'playing',
    phase = 'question',
    current_turn = 0,
    question_index = 0,
    maze_seed = p_maze_seed,
    maze_layout = p_maze_layout,
    dice_result = null,
    remaining_moves = 0,
    started_at = now(),
    finished_at = null,
    winner_team_id = null
  where id = p_game_id;

  update public.game_rooms set status = 'playing' where id = p_room_id;
  return true;
end;
$;

revoke all on function public.start_game_atomic(uuid, uuid, uuid, jsonb, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.start_game_atomic(uuid, uuid, uuid, jsonb, bigint, jsonb) to service_role;

create or replace function public.submit_game_answer_atomic(
  p_user_id uuid,
  p_request_id uuid,
  p_room_id uuid,
  p_game_id uuid,
  p_expected_question_index integer,
  p_team_id uuid,
  p_question_id uuid,
  p_answer jsonb,
  p_is_correct boolean,
  p_response_time integer,
  p_game_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.game_games%rowtype;
  v_room public.game_rooms%rowtype;
  v_player_team uuid;
  v_current_team uuid;
  v_single_device boolean;
begin
  if p_user_id is null or p_room_id is null or p_game_id is null or p_team_id is null or p_question_id is null then
    raise exception 'Required answer identifiers are missing' using errcode = '22023';
  end if;
  if p_expected_question_index is null or p_expected_question_index < 0 then
    raise exception 'Invalid question index' using errcode = '22023';
  end if;
  if p_is_correct is null or p_response_time is null or p_response_time < 0 or p_response_time > 120000 then
    raise exception 'Invalid answer result or response time' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_game_patch, '{}'::jsonb)) <> 'object'
     or (p_game_patch - array['current_turn','question_index','status','phase','winner_team_id','remaining_moves','dice_result','finished_at']) <> '{}'::jsonb then
    raise exception 'Game patch contains unsupported fields' using errcode = '22023';
  end if;

  select * into v_game from public.game_games
  where id = p_game_id and room_id = p_room_id
  for update;
  if not found then
    raise exception 'Game not found' using errcode = 'P0002';
  end if;

  -- Claim inside the same transaction as the game writes. A failed write rolls the claim back.
  if p_request_id is not null then
    insert into public.game_action_claims (user_id, request_id, action, room_id, game_id)
    values (p_user_id, p_request_id, 'answer', p_room_id, p_game_id)
    on conflict (user_id, request_id, action) do nothing;
    if not found then
      return false;
    end if;
  end if;

  if v_game.status <> 'playing' or v_game.phase <> 'question'
     or v_game.question_index <> p_expected_question_index then
    raise exception 'Game state changed; reload room' using errcode = '40001';
  end if;

  select host_id, settings into v_room.host_id, v_room.settings
  from public.game_rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;
  v_single_device := coalesce((v_room.settings->>'single_device_mode')::boolean, false);
  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id and q.quiz_id = v_room.quiz_id
  ) then
    raise exception 'Question does not belong to room quiz' using errcode = '22023';
  end if;

  select team_id into v_player_team
  from public.game_room_players
  where room_id = p_room_id and user_id = p_user_id;
  if not found then
    raise exception 'Player is not in room' using errcode = '42501';
  end if;

  select id into v_current_team
  from public.game_teams
  where game_id = p_game_id
  order by turn_order asc nulls last, created_at asc, id asc
  offset v_game.current_turn limit 1;
  if v_current_team is null or v_current_team <> p_team_id then
    raise exception 'Team is not the current turn' using errcode = '40001';
  end if;
  if not (v_single_device and v_room.host_id = p_user_id) and v_player_team is distinct from v_current_team then
    raise exception 'Player does not control the current team' using errcode = '42501';
  end if;

  insert into public.game_turns (
    game_id, team_id, question_id, turn_number, answer, is_correct, movement, response_time
  ) values (
    p_game_id, p_team_id, p_question_id, p_expected_question_index, coalesce(p_answer, '{}'::jsonb),
    p_is_correct, case when p_is_correct then null else 0 end, nullif(p_response_time, 0)
  );

  update public.game_games set
    current_turn = case when p_game_patch ? 'current_turn' then (p_game_patch->>'current_turn')::integer else current_turn end,
    question_index = case when p_game_patch ? 'question_index' then (p_game_patch->>'question_index')::integer else question_index end,
    status = case when p_game_patch ? 'status' then p_game_patch->>'status' else status end,
    phase = case when p_game_patch ? 'phase' then p_game_patch->>'phase' else phase end,
    winner_team_id = case when p_game_patch ? 'winner_team_id' then nullif(p_game_patch->>'winner_team_id', '')::uuid else winner_team_id end,
    remaining_moves = case when p_game_patch ? 'remaining_moves' then (p_game_patch->>'remaining_moves')::integer else remaining_moves end,
    dice_result = case when p_game_patch ? 'dice_result' then nullif(p_game_patch->>'dice_result', '')::integer else dice_result end,
    finished_at = case when p_game_patch ? 'finished_at' then nullif(p_game_patch->>'finished_at', '')::timestamptz else finished_at end
  where id = p_game_id;

  update public.game_teams set
    correct_count = correct_count + case when p_is_correct then 1 else 0 end,
    wrong_count = wrong_count + case when p_is_correct then 0 else 1 end,
    total_response_time = coalesce(total_response_time, 0) + p_response_time
  where id = p_team_id and game_id = p_game_id;

  if not found then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;

  if (p_game_patch->>'status') = 'finished' then
    update public.game_rooms set status = 'finished' where id = p_room_id;
  end if;

  return true;
end;
$$;

revoke all on function public.submit_game_answer_atomic(uuid, uuid, uuid, uuid, integer, uuid, uuid, jsonb, boolean, integer, jsonb) from public, anon, authenticated;
grant execute on function public.submit_game_answer_atomic(uuid, uuid, uuid, uuid, integer, uuid, uuid, jsonb, boolean, integer, jsonb) to service_role;

create or replace function public.claim_game_action(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_room_id uuid,
  p_game_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'User is required' using errcode = '22023';
  end if;
  if p_action not in ('answer', 'create_room', 'move', 'move_batch', 'dice_complete', 'switch_turn') then
    raise exception 'Invalid action' using errcode = '22023';
  end if;
  if p_request_id is null then return true; end if;

  insert into public.game_action_claims (user_id, request_id, action, room_id, game_id)
  values (p_user_id, p_request_id, p_action, p_room_id, p_game_id)
  on conflict (user_id, request_id, action) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_game_action(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_game_action(uuid, uuid, text, uuid, uuid) to service_role;

-- Public quizzes can be selected by other signed-in room creators.
-- Existing quizzes stay private unless their owner or an admin opts in.
alter table public.quizzes
  add column if not exists is_public boolean not null default false;

create index if not exists quizzes_public_created_idx
  on public.quizzes (created_at desc)
  where is_public = true;

-- Versioned RPC avoids breaking already-running backend instances while the migration deploys.
create or replace function public.save_quiz_with_questions_v2(
  p_quiz_id uuid,
  p_owner_id uuid,
  p_title text,
  p_description text,
  p_is_public boolean,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_question jsonb;
  v_index integer := 0;
begin
  if p_quiz_id is null or p_owner_id is null then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 100 then
    raise exception 'invalid questions' using errcode = '22023';
  end if;

  select owner_id into v_owner from public.quizzes where id = p_quiz_id for update;
  if found and v_owner <> p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.quizzes (id, owner_id, title, description, status, is_public)
  values (p_quiz_id, p_owner_id, p_title, p_description, 'draft', coalesce(p_is_public, false))
  on conflict (id) do update
    set title = excluded.title,
        description = excluded.description,
        is_public = excluded.is_public
    where public.quizzes.owner_id = p_owner_id;

  delete from public.questions where quiz_id = p_quiz_id;

  for v_question in select value from jsonb_array_elements(p_questions) loop
    insert into public.questions
      (quiz_id, order_index, type, content, options, correct_option, correct_boolean, reference_answer, explanation)
    values (
      p_quiz_id,
      v_index,
      v_question ->> 'type',
      v_question ->> 'content',
      case when jsonb_typeof(v_question -> 'options') = 'array' then v_question -> 'options' else null end,
      nullif(v_question ->> 'correct_option', '')::smallint,
      nullif(v_question ->> 'correct_boolean', '')::boolean,
      nullif(v_question ->> 'reference_answer', ''),
      nullif(v_question ->> 'explanation', '')
    );
    v_index := v_index + 1;
  end loop;

  return p_quiz_id;
end;
$$;
revoke all on function public.save_quiz_with_questions_v2(uuid, uuid, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz_with_questions_v2(uuid, uuid, text, text, boolean, jsonb) to service_role;

-- Allow room creation by the quiz owner or by another user when the quiz is public.
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
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
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
    where q.id = p_quiz_id
      and (q.owner_id = p_host_id or q.is_public = true)
  ) then
    raise exception 'Quiz is not available to host' using errcode = '42501';
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

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
set search_path = public
as $$
declare
  v_existing uuid;
  v_first_team uuid;
begin
  if p_request_id is not null then
    select room_id into v_existing
    from public.game_action_claims
    where user_id = p_host_id and request_id = p_request_id and action = 'create_room';
    if v_existing is not null then return v_existing; end if;
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
set search_path = public
as $$
begin
  if p_request_id is null then return true; end if;
  insert into public.game_action_claims (user_id, request_id, action, room_id, game_id)
  values (p_user_id, p_request_id, p_action, p_room_id, p_game_id)
  on conflict (user_id, request_id, action) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_game_action(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_game_action(uuid, uuid, text, uuid, uuid) to service_role;

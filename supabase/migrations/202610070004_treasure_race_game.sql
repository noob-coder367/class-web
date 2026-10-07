-- Treasure Race MVP: additive game model, separate from quizzes/questions.
create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete restrict,
  game_mode text not null default 'treasure_race',
  status text not null default 'lobby',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rooms_code_check check (code ~ '^[A-Z0-9]{6}$'),
  constraint game_rooms_mode_check check (game_mode in ('treasure_race')),
  constraint game_rooms_status_check check (status in ('lobby','ordering','playing','finished','cancelled'))
);
create index if not exists game_rooms_host_idx on public.game_rooms(host_id, updated_at desc);
create index if not exists game_rooms_code_idx on public.game_rooms(code);

drop trigger if exists trg_game_rooms_updated_at on public.game_rooms;
create trigger trg_game_rooms_updated_at before update on public.game_rooms for each row execute function public.set_updated_at();

create table if not exists public.game_games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.game_rooms(id) on delete cascade,
  status text not null default 'ordering',
  current_turn integer not null default 0,
  question_index integer not null default 0,
  total_questions integer not null default 0,
  winner_team_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint game_games_status_check check (status in ('ordering','playing','finished'))
);

create table if not exists public.game_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_games(id) on delete cascade,
  name text not null,
  token text not null default 'blue',
  position integer not null default 0,
  turn_order integer,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  total_movement integer not null default 0,
  created_at timestamptz not null default now(),
  unique(game_id, name),
  constraint game_teams_position_check check (position >= 0)
);

create table if not exists public.game_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.game_teams(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

create table if not exists public.game_turns (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_games(id) on delete cascade,
  team_id uuid not null references public.game_teams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  turn_number integer not null,
  answer jsonb,
  is_correct boolean,
  movement integer,
  response_time integer,
  created_at timestamptz not null default now(),
  unique(game_id, turn_number)
);

create table if not exists public.game_answers (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.game_turns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.game_rooms enable row level security;
alter table public.game_games enable row level security;
alter table public.game_teams enable row level security;
alter table public.game_room_players enable row level security;
alter table public.game_turns enable row level security;
alter table public.game_answers enable row level security;
revoke all on table public.game_rooms, public.game_games, public.game_teams, public.game_room_players, public.game_turns, public.game_answers from anon, authenticated;
grant all on table public.game_rooms, public.game_games, public.game_teams, public.game_room_players, public.game_turns, public.game_answers to service_role;
